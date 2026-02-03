import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../roles/roles.service';
import { EmailService } from '../email/email.service';
import { S3Service } from '../storage/services/s3.service';
import { UserRole } from '../../common/enums';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let tenantsService: jest.Mocked<TenantsService>;
  let rolesService: jest.Mocked<RolesService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: '$2b$10$hashedPassword',
    tenantId: 1,
    isActive: true,
    isEmailVerified: true,
    roles: [
      {
        id: 1,
        code: 'analyst',
        name: 'Analyst',
        permissions: [
          { id: 1, code: 'read:reports', name: 'Read Reports', isActive: true },
          { id: 2, code: 'write:reports', name: 'Write Reports', isActive: true },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenant = {
    id: 1,
    name: 'Test Tenant',
    slug: 'test-tenant',
    contactEmail: 'test@example.com',
    isActive: true,
    subscriptionTier: 'free',
  };

  const mockRole = {
    id: 1,
    code: 'analyst',
    name: 'Analyst',
    permissions: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            validatePassword: jest.fn(),
            findOne: jest.fn(),
            updateLastLogin: jest.fn(),
          },
        },
        {
          provide: TenantsService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: RolesService,
          useValue: {
            findByCode: jest.fn(),
            getPermissionCodesForRoles: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendWelcomeEmail: jest.fn(),
            sendPasswordChangedEmail: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            getPresignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'jwt.secret': 'test-secret',
                'jwt.expiresIn': '7d',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.refreshExpiresIn': '30d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    tenantsService = module.get(TenantsService);
    rolesService = module.get(RolesService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'Password123!',
    };

    it('should register a new user and automatically create a new tenant with analyst role', async () => {
      tenantsService.create.mockResolvedValue(mockTenant as any);
      rolesService.findByCode.mockResolvedValue(mockRole as any);
      usersService.create.mockResolvedValue(mockUser as any);
      rolesService.getPermissionCodesForRoles.mockResolvedValue(['read:reports']);
      jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
      jwtService.decode.mockReturnValue({ iat: 1000, exp: 2000 });

      const result = await service.register(registerDto);

      expect(tenantsService.create).toHaveBeenCalled();
      expect(rolesService.findByCode).toHaveBeenCalledWith(UserRole.ANALYST);
      expect(usersService.create).toHaveBeenCalled();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw BadRequestException if role not found', async () => {
      tenantsService.create.mockResolvedValue(mockTenant as any);
      rolesService.findByCode.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
      await expect(service.register(registerDto)).rejects.toThrow('Role analyst not found');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should successfully log in a user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(true);
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      usersService.updateLastLogin.mockResolvedValue(undefined);
      rolesService.getPermissionCodesForRoles.mockResolvedValue(['read:reports', 'write:reports']);
      jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
      jwtService.decode.mockReturnValue({ iat: 1000, exp: 2000 });

      const result = await service.login(loginDto, '127.0.0.1');

      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(usersService.validatePassword).toHaveBeenCalledWith(mockUser, loginDto.password);
      expect(usersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id, '127.0.0.1');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser, isActive: false } as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('User account is deactivated');
    });

    it('should throw UnauthorizedException for inactive tenant', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(true);
      tenantsService.findOne.mockResolvedValue({ ...mockTenant, isActive: false } as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Organization is not active');
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';

    it('should successfully refresh tokens', async () => {
      jwtService.verify.mockReturnValue({ sub: 1, tokenId: 'token-id' });
      usersService.findOne.mockResolvedValue(mockUser as any);
      rolesService.getPermissionCodesForRoles.mockResolvedValue(['read:reports']);
      jwtService.signAsync.mockResolvedValueOnce('new-access-token').mockResolvedValueOnce('new-refresh-token');
      jwtService.decode.mockReturnValue({ iat: 1000, exp: 2000 });

      const result = await service.refreshToken(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(usersService.findOne).toHaveBeenCalledWith(1);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      jwtService.verify.mockReturnValue({ sub: 1, tokenId: 'token-id' });
      usersService.findOne.mockResolvedValue({ ...mockUser, isActive: false } as any);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw UnauthorizedException for deleted user', async () => {
      jwtService.verify.mockReturnValue({ sub: 1, tokenId: 'token-id' });
      usersService.findOne.mockRejectedValue(new Error('User not found'));

      await expect(service.refreshToken(refreshToken)).rejects.toThrow();
    });
  });

  describe('validateUser', () => {
    it('should return user for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(true);
      tenantsService.findOne.mockResolvedValue(mockTenant as any);

      const result = await service.validateUser('test@example.com', 'Password123!');

      expect(result).toEqual(mockUser);
    });

    it('should return null for user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('notfound@example.com', 'Password123!');

      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser, isActive: false } as any);

      await expect(service.validateUser('test@example.com', 'Password123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return null for invalid password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'WrongPassword');

      expect(result).toBeNull();
    });
  });
});
