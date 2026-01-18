import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditLoggingInterceptor } from './audit-logging.interceptor';
import { AuditService } from '../../modules/audit/audit.service';

describe('AuditLoggingInterceptor', () => {
  let interceptor: AuditLoggingInterceptor;
  let auditService: AuditService;
  let reflector: Reflector;

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggingInterceptor,
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    interceptor = module.get<AuditLoggingInterceptor>(AuditLoggingInterceptor);
    auditService = module.get<AuditService>(AuditService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    method: string,
    url: string,
    user: any = null,
    body: any = {},
    skipAudit = false,
  ): ExecutionContext => {
    const request = {
      method,
      url,
      user,
      body,
      params: {},
      query: {},
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' },
      headers: { 'user-agent': 'Mozilla/5.0' },
    };

    const response = {
      statusCode: 200,
    };

    mockReflector.getAllAndOverride.mockReturnValue(skipAudit);

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  const createMockCallHandler = (data: any = {}, shouldError = false): CallHandler => {
    if (shouldError) {
      return {
        handle: () => throwError(() => new Error('Test error')),
      } as any;
    }

    return {
      handle: () => of(data),
    } as any;
  };

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('Public Routes', () => {
    it('should skip logging for requests without authenticated user', async () => {
      const context = createMockExecutionContext('POST', '/api/users', null);
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('SkipAudit Decorator', () => {
    it('should skip logging when @SkipAudit decorator is present', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('POST', '/api/users', user, {}, true);
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('GET Requests', () => {
    it('should skip logging for GET requests by default', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('GET', '/api/users', user);
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('POST Requests', () => {
    it('should log POST requests successfully', async () => {
      const user = { id: 1, tenantId: 1 };
      const body = { firstName: 'John', lastName: 'Doe' };
      const context = createMockExecutionContext('POST', '/api/users', user, body);
      const next = createMockCallHandler({ id: 10 });

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          tenantId: 1,
          action: 'users.create',
          resource: 'users',
          httpMethod: 'POST',
          requestPath: '/api/users',
          statusCode: 200,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  describe('PUT Requests', () => {
    it('should log PUT requests with resource ID', async () => {
      const user = { id: 1, tenantId: 1 };
      const body = { firstName: 'Jane' };
      const context = createMockExecutionContext('PUT', '/api/users/15', user, body);
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'users.update',
          resource: 'users',
          resourceId: 15,
          httpMethod: 'PUT',
        }),
      );
    });
  });

  describe('DELETE Requests', () => {
    it('should log DELETE requests', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('DELETE', '/api/users/15', user);
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'users.delete',
          resource: 'users',
          resourceId: 15,
          httpMethod: 'DELETE',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should log failed requests with error details', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('POST', '/api/users', user, {});
      const next = createMockCallHandler(null, true);

      mockAuditService.log.mockResolvedValue({});

      try {
        await interceptor.intercept(context, next).toPromise();
      } catch (error) {
        // Expected to throw
      }

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Test error',
          statusCode: 500,
        }),
      );
    });

    it('should not fail the request if audit logging fails', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('POST', '/api/users', user, {});
      const next = createMockCallHandler({ id: 10 });

      mockAuditService.log.mockRejectedValue(new Error('Audit service error'));

      const result = await interceptor.intercept(context, next).toPromise();

      expect(result).toEqual({ id: 10 });
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive fields from request body', async () => {
      const user = { id: 1, tenantId: 1 };
      const body = {
        email: 'test@example.com',
        password: 'secret123',
        currentPassword: 'oldSecret',
        newPassword: 'newSecret',
        confirmPassword: 'newSecret',
        token: 'jwt-token',
      };
      const context = createMockExecutionContext('POST', '/api/users', user, body);
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      const logCall = mockAuditService.log.mock.calls[0][0];
      const metadata = logCall.metadata;

      expect(metadata.requestBody.password).toBe('[REDACTED]');
      expect(metadata.requestBody.currentPassword).toBe('[REDACTED]');
      expect(metadata.requestBody.newPassword).toBe('[REDACTED]');
      expect(metadata.requestBody.confirmPassword).toBe('[REDACTED]');
      expect(metadata.requestBody.token).toBe('[REDACTED]');
      expect(metadata.requestBody.email).toBe('test@example.com');
    });

    it('should sanitize nested sensitive fields', async () => {
      const user = { id: 1, tenantId: 1 };
      const body = {
        user: {
          email: 'test@example.com',
          credentials: {
            password: 'secret123',
          },
        },
      };
      const context = createMockExecutionContext('POST', '/api/users', user, body);
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      const logCall = mockAuditService.log.mock.calls[0][0];
      const metadata = logCall.metadata;

      expect(metadata.requestBody.user.credentials.password).toBe('[REDACTED]');
      expect(metadata.requestBody.user.email).toBe('test@example.com');
    });
  });

  describe('Path Parsing', () => {
    it('should correctly parse resource from nested paths', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('POST', '/api/v1/tenants/5/users', user, {});
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'v1',
        }),
      );
    });

    it('should handle query strings in URL', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('POST', '/api/users?filter=active', user, {});
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          requestPath: '/api/users?filter=active',
        }),
      );
    });
  });

  describe('Metadata', () => {
    it('should include request duration in metadata', async () => {
      const user = { id: 1, tenantId: 1 };
      const context = createMockExecutionContext('POST', '/api/users', user, {});
      const next = createMockCallHandler();

      mockAuditService.log.mockResolvedValue({});

      await interceptor.intercept(context, next).toPromise();

      const logCall = mockAuditService.log.mock.calls[0][0];
      expect(logCall.metadata).toHaveProperty('duration');
      expect(typeof logCall.metadata.duration).toBe('number');
    });
  });
});
