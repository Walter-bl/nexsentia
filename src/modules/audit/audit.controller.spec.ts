import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditAction } from '../../common/enums';
import { StreamableFile } from '@nestjs/common';

describe('AuditController', () => {
  let controller: AuditController;
  let service: AuditService;

  const mockAuditService = {
    findAll: jest.fn(),
    findByUser: jest.fn(),
    findByResource: jest.fn(),
    exportToCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const tenantId = 1;
      const queryDto = {
        page: 1,
        limit: 10,
        userId: 10,
        action: AuditAction.UPDATE,
      };

      const mockResult = {
        items: [
          { id: 1, tenantId, userId: 10, action: AuditAction.UPDATE },
          { id: 2, tenantId, userId: 10, action: AuditAction.UPDATE },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockAuditService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(tenantId, queryDto);

      expect(service.findAll).toHaveBeenCalledWith(tenantId, queryDto);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty results', async () => {
      const tenantId = 1;
      const queryDto = { page: 1, limit: 10 };

      const mockResult = {
        items: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      mockAuditService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(tenantId, queryDto);

      expect(result.items).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findByUser', () => {
    it('should return audit logs for a specific user', async () => {
      const tenantId = 1;
      const userId = 10;
      const limit = 50;

      const mockLogs = [
        { id: 1, tenantId, userId, action: AuditAction.UPDATE },
        { id: 2, tenantId, userId, action: AuditAction.CREATE },
      ];

      mockAuditService.findByUser.mockResolvedValue(mockLogs);

      const result = await controller.findByUser(tenantId, userId, limit);

      expect(service.findByUser).toHaveBeenCalledWith(tenantId, userId, limit);
      expect(result).toEqual(mockLogs);
    });

    it('should handle optional limit parameter', async () => {
      const tenantId = 1;
      const userId = 10;

      mockAuditService.findByUser.mockResolvedValue([]);

      await controller.findByUser(tenantId, userId);

      expect(service.findByUser).toHaveBeenCalledWith(tenantId, userId, undefined);
    });
  });

  describe('findByResource', () => {
    it('should return audit logs for a specific resource', async () => {
      const tenantId = 1;
      const resource = 'users';
      const resourceId = 15;
      const limit = 50;

      const mockLogs = [
        { id: 1, tenantId, resource, resourceId, action: AuditAction.UPDATE },
        { id: 2, tenantId, resource, resourceId, action: AuditAction.CREATE },
      ];

      mockAuditService.findByResource.mockResolvedValue(mockLogs);

      const result = await controller.findByResource(tenantId, resource, resourceId, limit);

      expect(service.findByResource).toHaveBeenCalledWith(tenantId, resource, resourceId, limit);
      expect(result).toEqual(mockLogs);
    });

    it('should handle optional limit parameter', async () => {
      const tenantId = 1;
      const resource = 'users';
      const resourceId = 15;

      mockAuditService.findByResource.mockResolvedValue([]);

      await controller.findByResource(tenantId, resource, resourceId);

      expect(service.findByResource).toHaveBeenCalledWith(tenantId, resource, resourceId, undefined);
    });
  });

  describe('exportToCsv', () => {
    it('should export audit logs as CSV file', async () => {
      const tenantId = 1;
      const queryDto = { page: 1, limit: 10 };

      const mockCsv = 'ID,Timestamp,User ID,Action\n1,2024-01-15T10:30:00Z,10,users.update';

      mockAuditService.exportToCsv.mockResolvedValue(mockCsv);

      const result = await controller.exportToCsv(tenantId, queryDto);

      expect(service.exportToCsv).toHaveBeenCalledWith(tenantId, queryDto);
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('should handle empty CSV export', async () => {
      const tenantId = 1;
      const queryDto = { page: 1, limit: 10 };

      const mockCsv = 'ID,Timestamp,User ID,Action';

      mockAuditService.exportToCsv.mockResolvedValue(mockCsv);

      const result = await controller.exportToCsv(tenantId, queryDto);

      expect(result).toBeInstanceOf(StreamableFile);
    });
  });
});
