import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction } from '../../common/enums';

describe('AuditService', () => {
  let service: AuditService;
  let repository: Repository<AuditLog>;

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an audit log', async () => {
      const createDto = {
        tenantId: 1,
        userId: 10,
        action: AuditAction.CREATE,
        resource: 'users',
        resourceId: 15,
        metadata: { test: 'data' },
      };

      const mockAuditLog = { id: 1, ...createDto };

      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.create(createDto);

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockAuditLogRepository.save).toHaveBeenCalledWith(mockAuditLog);
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('log', () => {
    it('should log an audit entry with all options', async () => {
      const tenantId = 1;
      const action = AuditAction.UPDATE;
      const resource = 'users';
      const options = {
        userId: 10,
        resourceId: 15,
        metadata: { duration: 120 },
        changes: { before: { name: 'John' }, after: { name: 'Jane' } },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        httpMethod: 'PUT',
        requestPath: '/api/users/15',
        statusCode: 200,
      };

      const mockAuditLog = { id: 1, tenantId, action, resource, ...options };

      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.log(tenantId, action, resource, options);

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        tenantId,
        action,
        resource,
        ...options,
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should log an audit entry with minimal options', async () => {
      const tenantId = 1;
      const action = AuditAction.CREATE;
      const resource = 'users';

      const mockAuditLog = { id: 1, tenantId, action, resource };

      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.log(tenantId, action, resource);

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        tenantId,
        action,
        resource,
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs with filters', async () => {
      const tenantId = 1;
      const queryDto = {
        page: 1,
        limit: 10,
        userId: 10,
        action: AuditAction.UPDATE,
        resource: 'users',
      };

      const mockLogs = [
        { id: 1, tenantId, userId: 10, action: AuditAction.UPDATE, resource: 'users' },
        { id: 2, tenantId, userId: 10, action: AuditAction.UPDATE, resource: 'users' },
      ];

      mockAuditLogRepository.findAndCount.mockResolvedValue([mockLogs, 2]);

      const result = await service.findAll(tenantId, queryDto);

      expect(mockAuditLogRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          tenantId,
          userId: 10,
          action: AuditAction.UPDATE,
          resource: 'users',
        },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });

      expect(result).toEqual({
        items: mockLogs,
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should handle date range filters', async () => {
      const tenantId = 1;
      const fromDate = '2024-01-01';
      const toDate = '2024-01-31';
      const queryDto = {
        page: 1,
        limit: 10,
        fromDate,
        toDate,
      };

      const mockLogs: any[] = [];
      mockAuditLogRepository.findAndCount.mockResolvedValue([mockLogs, 0]);

      await service.findAll(tenantId, queryDto);

      const calledWith = mockAuditLogRepository.findAndCount.mock.calls[0][0];
      expect(calledWith.where.createdAt).toBeDefined();
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

      mockAuditLogRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findByUser(tenantId, userId, limit);

      expect(mockAuditLogRepository.find).toHaveBeenCalledWith({
        where: { tenantId, userId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      expect(result).toEqual(mockLogs);
    });

    it('should use default limit if not provided', async () => {
      const tenantId = 1;
      const userId = 10;

      mockAuditLogRepository.find.mockResolvedValue([]);

      await service.findByUser(tenantId, userId);

      expect(mockAuditLogRepository.find).toHaveBeenCalledWith({
        where: { tenantId, userId },
        order: { createdAt: 'DESC' },
        take: 50,
      });
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

      mockAuditLogRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findByResource(tenantId, resource, resourceId, limit);

      expect(mockAuditLogRepository.find).toHaveBeenCalledWith({
        where: { tenantId, resource, resourceId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: limit,
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('deleteOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      const tenantId = 1;
      const daysToKeep = 365;

      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 10 }),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.deleteOldLogs(tenantId, daysToKeep);

      expect(mockAuditLogRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('tenantId = :tenantId', { tenantId });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(result).toBe(10);
    });

    it('should return 0 if no logs were deleted', async () => {
      const tenantId = 1;

      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.deleteOldLogs(tenantId);

      expect(result).toBe(0);
    });
  });

  describe('exportToCsv', () => {
    it('should export audit logs to CSV format', async () => {
      const tenantId = 1;
      const queryDto = { page: 1, limit: 10 };

      const mockLogs = [
        {
          id: 1,
          createdAt: new Date('2024-01-15T10:30:00Z'),
          userId: 10,
          user: { email: 'test@example.com' },
          action: AuditAction.UPDATE,
          resource: 'users',
          resourceId: 15,
          httpMethod: 'PUT',
          requestPath: '/api/users/15',
          statusCode: 200,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          errorMessage: null,
        },
      ];

      mockAuditLogRepository.find.mockResolvedValue(mockLogs);

      const result = await service.exportToCsv(tenantId, queryDto);

      expect(typeof result).toBe('string');
      expect(result).toContain('ID,Timestamp,User ID');
      expect(result).toContain('test@example.com');
      expect(result).toContain('UPDATE');
    });

    it('should handle CSV cell escaping', async () => {
      const tenantId = 1;
      const queryDto = { page: 1, limit: 10 };

      const mockLogs = [
        {
          id: 1,
          createdAt: new Date('2024-01-15T10:30:00Z'),
          userId: 10,
          user: { email: 'test@example.com' },
          action: AuditAction.UPDATE,
          resource: 'users',
          resourceId: 15,
          httpMethod: 'PUT',
          requestPath: '/api/users/15',
          statusCode: 200,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0, "quoted value"',
          errorMessage: 'Error with, comma',
        },
      ];

      mockAuditLogRepository.find.mockResolvedValue(mockLogs);

      const result = await service.exportToCsv(tenantId, queryDto);

      expect(result).toContain('"Error with, comma"');
      expect(result).toContain('Mozilla/5.0');
    });
  });
});
