import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RolesService } from '../roles/roles.service';
import { S3Service } from '../storage/services/s3.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly rolesService: RolesService,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {}

  async create(userData: Partial<User>, roleIds?: number[]): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: {
        email: userData.email,
        tenantId: userData.tenantId,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists in this tenant');
    }

    // Hash password
    if (userData.password) {
      const salt = await bcrypt.genSalt(this.configService.get<number>('bcrypt.rounds', 10));
      userData.password = await bcrypt.hash(userData.password, salt);
    }

    const user = this.userRepository.create(userData);

    // Assign roles if provided
    if (roleIds && roleIds.length > 0) {
      const roles = await this.rolesService.findByIds(roleIds);
      user.roles = roles;
    }

    return await this.userRepository.save(user);
  }

  async findAll(tenantId: number): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { tenantId },
      relations: ['roles', 'roles.permissions'],
      order: { createdAt: 'DESC' },
    });

    // Transform users to include presigned URLs for profile images
    return await Promise.all(users.map(user => this.transformUserWithPresignedUrl(user)));
  }

  async findByTenant(tenantId: number): Promise<User[]> {
    return await this.findAll(tenantId);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Transform user to include presigned URL for profile image
    return await this.transformUserWithPresignedUrl(user);
  }

  async findByEmail(email: string, tenantId?: number): Promise<User | null> {
    const where: any = { email };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    return await this.userRepository.findOne({
      where,
      relations: ['roles', 'roles.permissions'],
    });
  }

  async update(id: number, updateData: Partial<User>): Promise<User> {
    const user = await this.findOne(id);

    // Don't allow updating sensitive fields directly
    delete updateData.password;
    delete updateData.tenantId;
    delete updateData.id;

    Object.assign(user, updateData);

    return await this.userRepository.save(user);
  }

  async updatePassword(id: number, newPassword: string): Promise<void> {
    const user = await this.findOne(id);

    const salt = await bcrypt.genSalt(this.configService.get<number>('bcrypt.rounds', 10));
    user.password = await bcrypt.hash(newPassword, salt);

    await this.userRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.softRemove(user);
  }

  async softDelete(id: number): Promise<void> {
    await this.userRepository.softDelete(id);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password);
  }

  async updateLastLogin(userId: number, ipAddress?: string): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    });
  }

  async assignRoles(userId: number, roleIds: number[]): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.rolesService.findByIds(roleIds);
    user.roles = roles;
    const savedUser = await this.userRepository.save(user);
    return await this.transformUserWithPresignedUrl(savedUser);
  }

  async removeRoles(userId: number, roleIds: number[]): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.roles = user.roles.filter((role) => !roleIds.includes(role.id));
    const savedUser = await this.userRepository.save(user);
    return await this.transformUserWithPresignedUrl(savedUser);
  }

  async getUserPermissions(userId: number): Promise<string[]> {
    const user = await this.findOne(userId);
    return this.rolesService.getPermissionCodesForRoles(user.roles || []);
  }

  async generatePasswordResetToken(userId: number): Promise<string> {
    const user = await this.findOne(userId);

    // Generate a random token
    const token = this.generateRandomToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    user.passwordResetToken = token;
    user.passwordResetExpiresAt = expiresAt;

    await this.userRepository.save(user);

    return token;
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: {
        passwordResetToken: token,
      },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    const user = await this.findOne(userId);

    // Hash the new password
    const salt = await bcrypt.genSalt(this.configService.get<number>('bcrypt.rounds', 10));
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear the reset token
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;

    await this.userRepository.save(user);
  }

  private generateRandomToken(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
  }

  /**
   * Transform user entity to include presigned URL for profile image
   */
  private async transformUserWithPresignedUrl(user: User): Promise<User> {
    if (user.profileImage) {
      try {
        const presignedUrl = await this.s3Service.getPresignedUrl(user.profileImage);
        // Create a new object to avoid mutating the original entity
        const transformedUser = Object.create(Object.getPrototypeOf(user));
        Object.assign(transformedUser, user, { profileImage: presignedUrl });
        return transformedUser;
      } catch (error) {
        console.error('Failed to generate presigned URL for profile image:', error);
      }
    }
    return user;
  }
}
