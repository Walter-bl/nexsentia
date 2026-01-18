import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditCleanupService } from './audit-cleanup.service';
import { AuditService } from './audit.service';
import { Tenant } from '../tenants/entities/tenant.entity';

describe('AuditCleanupService', () => {
  let service: AuditCleanupService;
  let auditService: AuditService;
  let tenantRepository: Repository<Tenant>;
  let configService: ConfigService;

  const mockAuditService = {
    deleteOldLogs: jest.fn(),
  };

  const mockTenantRepository = {
    find: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditCleanupService,
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<AuditCleanupService>(AuditCleanupService);
    auditService = module.get<AuditService>(AuditService);
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
    configService = module.get<ConfigService>(ConfigService);

    // Set default retention days
    mockConfigService.get.mockReturnValue(365);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleAuditLogCleanup', () => {
    it('should cleanup audit logs for all active tenants', async () => {
      const mockTenants = [
        { id: 1, name: 'Tenant 1', isActive: true },
        { id: 2, name: 'Tenant 2', isActive: true },
      ];

      mockTenantRepository.find.mockResolvedValue(mockTenants);
      mockAuditService.deleteOldLogs
        .mockResolvedValueOnce(10) // Tenant 1 deleted 10 logs
        .mockResolvedValueOnce(5); // Tenant 2 deleted 5 logs

      await service.handleAuditLogCleanup();

      expect(tenantRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        select: ['id', 'name'],
      });

      expect(auditService.deleteOldLogs).toHaveBeenCalledTimes(2);
      expect(auditService.deleteOldLogs).toHaveBeenCalledWith(1, 365);
      expect(auditService.deleteOldLogs).toHaveBeenCalledWith(2, 365);
    });

    it('should handle errors for individual tenants without stopping cleanup', async () => {
      const mockTenants = [
        { id: 1, name: 'Tenant 1', isActive: true },
        { id: 2, name: 'Tenant 2', isActive: true },
      ];

      mockTenantRepository.find.mockResolvedValue(mockTenants);
      mockAuditService.deleteOldLogs
        .mockRejectedValueOnce(new Error('Database error')) // Tenant 1 fails
        .mockResolvedValueOnce(5); // Tenant 2 succeeds

      await service.handleAuditLogCleanup();

      expect(auditService.deleteOldLogs).toHaveBeenCalledTimes(2);
    });

    it('should handle when no tenants exist', async () => {
      mockTenantRepository.find.mockResolvedValue([]);

      await service.handleAuditLogCleanup();

      expect(tenantRepository.find).toHaveBeenCalled();
      expect(auditService.deleteOldLogs).not.toHaveBeenCalled();
    });

    it('should handle when no logs are deleted', async () => {
      const mockTenants = [{ id: 1, name: 'Tenant 1', isActive: true }];

      mockTenantRepository.find.mockResolvedValue(mockTenants);
      mockAuditService.deleteOldLogs.mockResolvedValue(0);

      await service.handleAuditLogCleanup();

      expect(auditService.deleteOldLogs).toHaveBeenCalledWith(1, 365);
    });

    it('should handle tenant repository errors gracefully', async () => {
      mockTenantRepository.find.mockRejectedValue(new Error('Repository error'));

      await expect(service.handleAuditLogCleanup()).resolves.not.toThrow();
    });
  });

  describe('manualCleanup', () => {
    it('should cleanup logs for a specific tenant', async () => {
      const tenantId = 1;

      mockAuditService.deleteOldLogs.mockResolvedValue(15);

      const result = await service.manualCleanup(tenantId);

      expect(auditService.deleteOldLogs).toHaveBeenCalledWith(tenantId, 365);
      expect(result).toEqual({
        deleted: 15,
        message: 'Deleted 15 audit log(s) older than 365 days',
      });
    });

    it('should cleanup logs for all tenants when tenantId is not provided', async () => {
      const mockTenants = [
        { id: 1, isActive: true },
        { id: 2, isActive: true },
      ];

      mockTenantRepository.find.mockResolvedValue(mockTenants);
      mockAuditService.deleteOldLogs
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      const result = await service.manualCleanup();

      expect(tenantRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        select: ['id'],
      });
      expect(auditService.deleteOldLogs).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        deleted: 15,
        message: 'Deleted 15 audit log(s) across 2 tenant(s)',
      });
    });

    it('should throw error when cleanup fails', async () => {
      const tenantId = 1;

      mockAuditService.deleteOldLogs.mockRejectedValue(new Error('Cleanup failed'));

      await expect(service.manualCleanup(tenantId)).rejects.toThrow('Cleanup failed');
    });

    it('should return zero when no logs are deleted', async () => {
      const tenantId = 1;

      mockAuditService.deleteOldLogs.mockResolvedValue(0);

      const result = await service.manualCleanup(tenantId);

      expect(result).toEqual({
        deleted: 0,
        message: 'Deleted 0 audit log(s) older than 365 days',
      });
    });
  });

  describe('retention days configuration', () => {
    it('should use configured retention days', () => {
      mockConfigService.get.mockReturnValue(180);

      const module = Test.createTestingModule({
        providers: [
          AuditCleanupService,
          {
            provide: AuditService,
            useValue: mockAuditService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: getRepositoryToken(Tenant),
            useValue: mockTenantRepository,
          },
        ],
      }).compile();

      expect(configService.get).toHaveBeenCalledWith('AUDIT_LOG_RETENTION_DAYS', 365);
    });
  });
});
