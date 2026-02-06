import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../roles/roles.service';
import { EmailService } from '../email/email.service';
import { S3Service } from '../storage/services/s3.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto, UserResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { User } from '../users/entities/user.entity';
import { JwtPayload, JwtRefreshPayload } from '../../common/interfaces';
import { UserRole } from '../../common/enums';
import { JiraConnection } from '../jira/entities/jira-connection.entity';
import { ServiceNowConnection } from '../servicenow/entities/servicenow-connection.entity';
import { SlackConnection } from '../slack/entities/slack-connection.entity';
import { TeamsConnection } from '../teams/entities/teams-connection.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly rolesService: RolesService,
    private readonly emailService: EmailService,
    private readonly s3Service: S3Service,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(JiraConnection)
    private readonly jiraConnectionRepository: Repository<JiraConnection>,
    @InjectRepository(ServiceNowConnection)
    private readonly serviceNowConnectionRepository: Repository<ServiceNowConnection>,
    @InjectRepository(SlackConnection)
    private readonly slackConnectionRepository: Repository<SlackConnection>,
    @InjectRepository(TeamsConnection)
    private readonly teamsConnectionRepository: Repository<TeamsConnection>,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user with this email already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Always create a new tenant for each registration (analyst-focused platform)
    const tenantSlug = this.generateSlug(registerDto.email);
    const tenant = await this.tenantsService.create({
      name: `${registerDto.firstName} ${registerDto.lastName}'s Organization`,
      slug: tenantSlug,
      contactEmail: registerDto.email,
      isActive: true,
    });
    const tenantId = tenant.id;

    // Assign ANALYST role (default role for the platform)
    const role = await this.rolesService.findByCode(UserRole.ANALYST);

    if (!role) {
      throw new BadRequestException(`Role ${UserRole.ANALYST} not found`);
    }

    // Create user
    const user = await this.usersService.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: registerDto.password,
      tenantId,
      isActive: true,
      isEmailVerified: false,
    }, [role.id]);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: await this.mapUserToResponse(user),
      tokens,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id, ipAddress);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: await this.mapUserToResponse(user),
      tokens,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const isPasswordValid = await this.usersService.validatePassword(user, password);

    if (!isPasswordValid) {
      return null;
    }

    // Verify tenant is active
    const tenant = await this.tenantsService.findOne(user.tenantId);
    if (!tenant.isActive) {
      throw new UnauthorizedException('Organization is not active');
    }

    return user;
  }

  async refreshToken(refreshToken: string): Promise<AuthTokensDto> {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.usersService.findOne(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return await this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(user: User): Promise<AuthTokensDto> {
    // Get primary role (first role) and all permissions
    const primaryRole = user.roles && user.roles.length > 0 ? user.roles[0].code : null;
    const permissions = await this.rolesService.getPermissionCodesForRoles(user.roles || []);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: primaryRole as UserRole,
      permissions,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      tokenId: this.generateTokenId(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret') || 'default-secret',
        expiresIn: (this.configService.get<string>('jwt.expiresIn') || '7d') as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('jwt.refreshSecret') || 'default-refresh-secret',
        expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') || '30d') as any,
      }),
    ]);

    const decoded = this.jwtService.decode(accessToken) as any;
    const expiresIn = decoded.exp - decoded.iat;

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async mapUserToResponse(user: User): Promise<UserResponseDto> {
    // Get primary role (first role) and all permissions
    const primaryRole = user.roles && user.roles.length > 0 ? user.roles[0].code : null;
    const permissions = await this.rolesService.getPermissionCodesForRoles(user.roles || []);

    // Generate presigned URL for profile image if it exists
    let profileImageUrl = null;
    if (user.profileImage) {
      try {
        profileImageUrl = await this.s3Service.getPresignedUrl(user.profileImage);
      } catch (error) {
        // Log error but don't fail the request
        console.error('Failed to generate presigned URL for profile image:', error);
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: primaryRole,
      permissions,
      tenantId: user.tenantId,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      profileImage: profileImageUrl,
    };
  }

  private generateSlug(email: string): string {
    const username = email.split('@')[0];
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${username}-${timestamp}-${randomSuffix}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  private generateTokenId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email, tenantId } = forgotPasswordDto;

    const user = await this.usersService.findByEmail(email, tenantId);

    // Don't reveal if user exists or not for security
    if (!user) {
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    if (!user.isActive) {
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // Generate reset token
    const resetToken = await this.usersService.generatePasswordResetToken(user.id);

    // Send email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);

    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.usersService.findByPasswordResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token is expired
    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Reset the password
    await this.usersService.resetPassword(user.id, newPassword);

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail(user.email, user.firstName);

    return { message: 'Password has been reset successfully' };
  }

  async getIntegrationConnections(tenantId: number): Promise<{
    jiraConnected: boolean;
    serviceNowConnected: boolean;
    slackConnected: boolean;
    teamsConnected: boolean;
  }> {
    const [jiraConnection, serviceNowConnection, slackConnection, teamsConnection] = await Promise.all([
      this.jiraConnectionRepository.findOne({
        where: { tenantId, isActive: true },
      }),
      this.serviceNowConnectionRepository.findOne({
        where: { tenantId, isActive: true },
      }),
      this.slackConnectionRepository.findOne({
        where: { tenantId, isActive: true },
      }),
      this.teamsConnectionRepository.findOne({
        where: { tenantId, isActive: true },
      }),
    ]);

    return {
      jiraConnected: !!jiraConnection,
      serviceNowConnected: !!serviceNowConnection,
      slackConnected: !!slackConnection,
      teamsConnected: !!teamsConnection,
    };
  }
}
