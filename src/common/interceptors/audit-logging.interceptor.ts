import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { Reflector } from '@nestjs/core';
import { AuditAction } from '../enums';

/**
 * Interceptor to automatically log all API requests to the audit log
 * Skips public routes and GET requests by default
 */
@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user;

    // Skip logging for public routes (no user authenticated)
    if (!user) {
      return next.handle();
    }

    // Check if route has @SkipAudit decorator
    const skipAudit = this.reflector.getAllAndOverride<boolean>('skipAudit', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAudit) {
      return next.handle();
    }

    const httpMethod = request.method;
    const requestPath = request.url;
    const ipAddress = request.ip || request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // Skip GET requests by default (can be changed based on requirements)
    const shouldLog = httpMethod !== 'GET';

    if (!shouldLog) {
      return next.handle();
    }

    // Determine action and resource from the request
    const { action, resource, resourceId } = this.extractAuditInfo(
      httpMethod,
      requestPath,
      request.body,
      request.params,
    );

    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;

        // Log successful request
        this.auditService
          .log({
            userId: user.id,
            tenantId: user.tenantId,
            action,
            resource,
            resourceId,
            metadata: {
              duration,
              requestBody: this.sanitizeData(request.body),
              queryParams: request.query,
            },
            changes: this.extractChanges(request.body, data),
            ipAddress,
            userAgent,
            httpMethod,
            requestPath,
            statusCode: response.statusCode,
          })
          .catch((error) => {
            // Don't fail the request if audit logging fails
            console.error('Failed to log audit entry:', error);
          });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log failed request
        this.auditService
          .log({
            userId: user.id,
            tenantId: user.tenantId,
            action,
            resource,
            resourceId,
            metadata: {
              duration,
              requestBody: this.sanitizeData(request.body),
              queryParams: request.query,
            },
            ipAddress,
            userAgent,
            httpMethod,
            requestPath,
            statusCode: error.status || 500,
            errorMessage: error.message,
          })
          .catch((auditError) => {
            console.error('Failed to log audit entry:', auditError);
          });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Extract action, resource, and resourceId from request
   */
  private extractAuditInfo(
    method: string,
    path: string,
    body: any,
    params: any,
  ): { action: AuditAction; resource: string; resourceId?: number } {
    // Remove query string
    const cleanPath = path.split('?')[0];

    // Extract resource from path (e.g., /api/v1/users/123 -> users)
    const pathSegments = cleanPath.split('/').filter((s) => s);

    // Find the first meaningful segment as the resource
    // Skip: 'api', version prefixes (v1, v2, etc.), and numeric IDs
    let resource = 'unknown';
    let resourceId: number | undefined;

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];

      // Skip 'api' prefix
      if (segment === 'api') continue;

      // Skip version prefixes (v1, v2, etc.)
      if (/^v\d+$/.test(segment)) continue;

      // Check if this is a number (potential ID)
      if (!isNaN(Number(segment)) && segment !== '') {
        resourceId = Number(segment);
        continue;
      }

      // First non-numeric, non-prefix segment is the resource
      if (resource === 'unknown') {
        resource = segment;
      }
    }

    // Check params for id
    if (params?.id && !resourceId) {
      resourceId = Number(params.id);
    }

    // Determine action based on HTTP method - use proper AuditAction enum values
    let action: AuditAction;
    switch (method) {
      case 'POST':
        action = AuditAction.CREATE;
        break;
      case 'PUT':
      case 'PATCH':
        action = AuditAction.UPDATE;
        break;
      case 'DELETE':
        action = AuditAction.DELETE;
        break;
      case 'GET':
        action = AuditAction.READ;
        break;
      default:
        action = AuditAction.CREATE; // Default to CREATE for unknown methods
    }

    return { action, resource, resourceId };
  }

  /**
   * Extract changes from request body and response
   */
  private extractChanges(requestBody: any, responseData: any): any {
    if (!requestBody || Object.keys(requestBody).length === 0) {
      return null;
    }

    return {
      before: null, // We don't have the before state in the interceptor
      after: this.sanitizeData(requestBody),
    };
  }

  /**
   * Sanitize sensitive data from being logged
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'accessToken',
      'refreshToken',
      'token',
      'secret',
      'apiKey',
      'privateKey',
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }
}
