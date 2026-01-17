import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../enums';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user;

    // Skip if no user (public endpoint)
    if (!user) {
      return next.handle();
    }

    const { method, path, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const tenantId = user.tenantId;
    const userId = user.id;

    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (data) => {
        const statusCode = response.statusCode;
        const responseTime = Date.now() - startTime;

        // Determine action based on HTTP method
        const action = this.mapMethodToAction(method);

        if (action) {
          try {
            await this.auditService.log(tenantId, action, path, {
              userId,
              ipAddress: ip,
              userAgent,
              httpMethod: method,
              requestPath: path,
              statusCode,
              metadata: {
                responseTime,
              },
            });
          } catch (error) {
            this.logger.error('Failed to create audit log', error);
          }
        }
      }),
      catchError((error) => {
        const statusCode = error.status || 500;

        // Log failed requests
        const action = this.mapMethodToAction(method);
        if (action) {
          this.auditService
            .log(tenantId, action, path, {
              userId,
              ipAddress: ip,
              userAgent,
              httpMethod: method,
              requestPath: path,
              statusCode,
              errorMessage: error.message,
            })
            .catch((err) => this.logger.error('Failed to create audit log for error', err));
        }

        return throwError(() => error);
      }),
    );
  }

  private mapMethodToAction(method: string): AuditAction | null {
    const methodActionMap: Record<string, AuditAction> = {
      GET: AuditAction.READ,
      POST: AuditAction.CREATE,
      PUT: AuditAction.UPDATE,
      PATCH: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };

    return methodActionMap[method.toUpperCase()] || null;
  }
}
