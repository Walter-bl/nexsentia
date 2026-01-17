import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: jest.Mocked<Repository<Tenant>>;

  const mockTenant = {
    id: 1,
    name: 'Test Tenant',
    slug: 'test-tenant',
    contactEmail: 'contact@tenant.com',
    isActive: true,
    subscriptionTier: 'free',
    subscriptionExpiresAt: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    repository = module.get(getRepositoryToken(Tenant));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createTenantData = {
      name: 'New Tenant',
      slug: 'new-tenant',
      contactEmail: 'new@tenant.com',
      isActive: true,
      subscriptionTier: 'free',
    };

    it('should create a new tenant', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockTenant as any);
      repository.save.mockResolvedValue(mockTenant as any);

      const result = await service.create(createTenantData as any);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: [{ name: createTenantData.name }, { slug: createTenantData.slug }],
      });
      expect(repository.create).toHaveBeenCalledWith(createTenantData);
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTenant);
    });

    it('should throw ConflictException if tenant with same name exists', async () => {
      repository.findOne.mockResolvedValue(mockTenant as any);

      await expect(service.create(createTenantData as any)).rejects.toThrow('Tenant with this name or slug already exists');
    });

    it('should throw ConflictException if tenant with same slug exists', async () => {
      repository.findOne.mockResolvedValue(mockTenant as any);

      await expect(service.create(createTenantData as any)).rejects.toThrow('Tenant with this name or slug already exists');
    });
  });

  describe('findAll', () => {
    it('should return all tenants', async () => {
      const tenants = [mockTenant, { ...mockTenant, id: 2, name: 'Tenant 2', slug: 'tenant-2' }];
      repository.find.mockResolvedValue(tenants as any);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalled();
      expect(result).toEqual(tenants);
    });

    it('should return empty array if no tenants found', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findAllActive', () => {
    it('should return all active tenants', async () => {
      const activeTenants = [mockTenant];
      repository.find.mockResolvedValue(activeTenants as any);

      const result = await service.findAllActive();

      expect(repository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toEqual(activeTenants);
    });

    it('should return empty array if no active tenants', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findAllActive();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a tenant by ID', async () => {
      repository.findOne.mockResolvedValue(mockTenant as any);

      const result = await service.findOne(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockTenant);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('Tenant not found');
    });
  });

  describe('findBySlug', () => {
    it('should return a tenant by slug', async () => {
      repository.findOne.mockResolvedValue(mockTenant as any);

      const result = await service.findBySlug('test-tenant');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-tenant' },
      });
      expect(result).toEqual(mockTenant);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findBySlug('nonexistent')).rejects.toThrow('Tenant not found');
    });
  });

  describe('update', () => {
    const updateData = {
      name: 'Updated Tenant Name',
      contactEmail: 'updated@tenant.com',
    };

    it('should update a tenant', async () => {
      repository.findOne.mockResolvedValue(mockTenant as any);
      repository.save.mockResolvedValue({ ...mockTenant, ...updateData } as any);

      const result = await service.update(1, updateData);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.name).toBe(updateData.name);
      expect(result.contactEmail).toBe(updateData.contactEmail);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateData)).rejects.toThrow(NotFoundException);
      await expect(service.update(999, updateData)).rejects.toThrow('Tenant not found');
    });

    it('should update subscription tier', async () => {
      const subscriptionUpdate = {
        subscriptionTier: 'professional',
        subscriptionExpiresAt: new Date('2026-12-31'),
      };
      repository.findOne.mockResolvedValue(mockTenant as any);
      repository.save.mockResolvedValue({ ...mockTenant, ...subscriptionUpdate } as any);

      const result = await service.update(1, subscriptionUpdate as any);

      expect(result.subscriptionTier).toBe('professional');
      expect(result.subscriptionExpiresAt).toEqual(subscriptionUpdate.subscriptionExpiresAt);
    });

    it('should update tenant settings', async () => {
      const settingsUpdate = {
        settings: { theme: 'dark', notifications: true },
      };
      repository.findOne.mockResolvedValue(mockTenant as any);
      repository.save.mockResolvedValue({ ...mockTenant, ...settingsUpdate } as any);

      const result = await service.update(1, settingsUpdate);

      expect(result.settings).toEqual(settingsUpdate.settings);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a tenant', async () => {
      repository.softDelete.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      await service.softDelete(1);

      expect(repository.softDelete).toHaveBeenCalledWith(1);
    });

    it('should not throw error if tenant not found during soft delete', async () => {
      repository.softDelete.mockResolvedValue({ affected: 0, raw: {}, generatedMaps: [] });

      await expect(service.softDelete(999)).resolves.not.toThrow();
    });
  });

  describe('activate/deactivate', () => {
    it('should activate a tenant', async () => {
      const inactiveTenant = { ...mockTenant, isActive: false };
      repository.findOne.mockResolvedValue(inactiveTenant as any);
      repository.save.mockResolvedValue({ ...inactiveTenant, isActive: true } as any);

      const result = await service.update(1, { isActive: true });

      expect(result.isActive).toBe(true);
    });

    it('should deactivate a tenant', async () => {
      repository.findOne.mockResolvedValue(mockTenant as any);
      repository.save.mockResolvedValue({ ...mockTenant, isActive: false } as any);

      const result = await service.update(1, { isActive: false });

      expect(result.isActive).toBe(false);
    });
  });

  describe('subscription management', () => {
    it('should upgrade subscription tier', async () => {
      repository.findOne.mockResolvedValue(mockTenant as any);
      const upgradedTenant = {
        ...mockTenant,
        subscriptionTier: 'enterprise',
        subscriptionExpiresAt: new Date('2026-12-31'),
      };
      repository.save.mockResolvedValue(upgradedTenant as any);

      const result = await service.update(1, {
        subscriptionTier: 'enterprise',
        subscriptionExpiresAt: new Date('2026-12-31'),
      } as any);

      expect(result.subscriptionTier).toBe('enterprise');
      expect(result.subscriptionExpiresAt).toBeDefined();
    });

    it('should handle subscription expiration', async () => {
      const expiredTenant = {
        ...mockTenant,
        subscriptionTier: 'professional',
        subscriptionExpiresAt: new Date('2024-01-01'),
      };
      repository.findOne.mockResolvedValue(expiredTenant as any);

      const result = await service.findOne(1);

      expect(result.subscriptionExpiresAt).toEqual(expiredTenant.subscriptionExpiresAt);
    });
  });
});
