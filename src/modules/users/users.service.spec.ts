import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { RolesService } from '../roles/roles.service';
import { S3Service } from '../storage/services/s3.service';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;
  let rolesService: jest.Mocked<RolesService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: '$2b$10$hashedPassword',
    tenantId: 1,
    isActive: true,
    isEmailVerified: false,
    roles: [
      {
        id: 1,
        code: 'analyst',
        name: 'Analyst',
        permissions: [
          { id: 1, code: 'read:reports', name: 'Read Reports', isActive: true },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRole = {
    id: 1,
    code: 'analyst',
    name: 'Analyst',
    permissions: [
      { id: 1, code: 'read:reports', name: 'Read Reports', isActive: true },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: RolesService,
          useValue: {
            findByIds: jest.fn(),
            getPermissionCodesForRoles: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(10),
          },
        },
        {
          provide: S3Service,
          useValue: {
            getPresignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
    rolesService = module.get(RolesService);
    configService = module.get(ConfigService);

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('$2b$10$salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedPassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserData = {
      email: 'newuser@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'Password123!',
      tenantId: 1,
      isActive: true,
    };

    it('should create a new user with roles', async () => {
      repository.findOne.mockResolvedValue(null);
      rolesService.findByIds.mockResolvedValue([mockRole] as any);
      repository.create.mockReturnValue({ ...mockUser, ...createUserData } as any);
      repository.save.mockResolvedValue({ ...mockUser, ...createUserData } as any);

      const result = await service.create(createUserData, [1]);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: createUserData.email },
      });
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(rolesService.findByIds).toHaveBeenCalledWith([1]);
      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create user without roles if roleIds not provided', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser as any);
      repository.save.mockResolvedValue(mockUser as any);

      const result = await service.create(createUserData);

      expect(rolesService.findByIds).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ConflictException if user already exists', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);

      await expect(service.create(createUserData, [1])).rejects.toThrow('User with this email already exists');
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.findOne(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['roles', 'roles.permissions'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('User not found');
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email and tenantId', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.findByEmail('test@example.com', 1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', tenantId: 1 },
        relations: ['roles', 'roles.permissions'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com', 1);

      expect(result).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('should return all users in a tenant', async () => {
      const users = [mockUser, { ...mockUser, id: 2, email: 'user2@example.com' }];
      repository.find.mockResolvedValue(users as any);

      const result = await service.findByTenant(1);

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 1 },
        relations: ['roles', 'roles.permissions'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(users);
    });

    it('should return empty array if no users found', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findByTenant(1);

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update a user', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);
      repository.save.mockResolvedValue({ ...mockUser, ...updateData } as any);

      const result = await service.update(1, updateData);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['roles', 'roles.permissions'],
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.firstName).toBe(updateData.firstName);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateData)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      repository.softDelete.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      await service.softDelete(1);

      expect(repository.softDelete).toHaveBeenCalledWith(1);
    });
  });

  describe('assignRoles', () => {
    it('should assign roles to user', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);
      rolesService.findByIds.mockResolvedValue([mockRole] as any);
      repository.save.mockResolvedValue({ ...mockUser, roles: [mockRole] } as any);

      const result = await service.assignRoles(1, [1]);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['roles', 'roles.permissions'],
      });
      expect(rolesService.findByIds).toHaveBeenCalledWith([1]);
      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.assignRoles(999, [1])).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRoles', () => {
    it('should remove roles from user', async () => {
      const userWithMultipleRoles = {
        ...mockUser,
        roles: [mockRole, { id: 2, code: 'admin', name: 'Admin', permissions: [] }],
      };
      repository.findOne.mockResolvedValue(userWithMultipleRoles as any);
      repository.save.mockResolvedValue({ ...mockUser, roles: [mockRole] } as any);

      const result = await service.removeRoles(1, [2]);

      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.removeRoles(999, [1])).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      repository.findOne.mockResolvedValue(mockUser as any);
      rolesService.getPermissionCodesForRoles.mockResolvedValue(['read:reports']);

      const result = await service.getUserPermissions(1);

      expect(repository.findOne).toHaveBeenCalled();
      expect(rolesService.getPermissionCodesForRoles).toHaveBeenCalledWith(mockUser.roles);
      expect(result).toEqual(['read:reports']);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getUserPermissions(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(mockUser as any, 'Password123!');

      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', mockUser.password);
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(mockUser as any, 'WrongPassword');

      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp and IP', async () => {
      repository.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      await service.updateLastLogin(1, '127.0.0.1');

      expect(repository.update).toHaveBeenCalledWith(1, {
        lastLoginAt: expect.any(Date),
        lastLoginIp: '127.0.0.1',
      });
    });
  });
});
