import { Controller, Get, Query, UseGuards, Param, StreamableFile, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions, CurrentTenant, CurrentUser } from '../../common/decorators';
import { Permission } from '../../common/enums';

@ApiTags('Audit Logs')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT')
@ApiSecurity('TenantId')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Query audit logs with filters',
    description: 'Retrieve audit logs with comprehensive filtering options including user, action, resource, date range, and pagination. Supports querying activity across your tenant.'
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 1,
            userId: 10,
            action: 'users.update',
            resource: 'users',
            resourceId: 15,
            metadata: { duration: 120, requestBody: { firstName: 'John' } },
            changes: { before: { firstName: 'Jane' }, after: { firstName: 'John' } },
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...',
            httpMethod: 'PUT',
            requestPath: '/api/users/15',
            statusCode: 200,
            errorMessage: null,
            createdAt: '2024-01-15T10:30:00Z',
          }
        ],
        total: 150,
        page: 1,
        limit: 10,
        totalPages: 15
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async findAll(@CurrentTenant() tenantId: number, @Query() queryDto: QueryAuditLogDto) {
    return await this.auditService.findAll(tenantId, queryDto);
  }

  @Get('user/:userId')
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Get audit logs for a specific user',
    description: 'Retrieve all audit log entries for a particular user ID, useful for tracking user activity and compliance.'
  })
  @ApiParam({ name: 'userId', description: 'User ID to filter audit logs', example: 10 })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of logs to return', example: 50 })
  @ApiResponse({
    status: 200,
    description: 'User audit logs retrieved successfully',
    schema: {
      example: [
        {
          id: 1,
          action: 'users.update',
          resource: 'users',
          resourceId: 15,
          httpMethod: 'PUT',
          requestPath: '/api/users/15',
          statusCode: 200,
          createdAt: '2024-01-15T10:30:00Z',
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findByUser(
    @CurrentTenant() tenantId: number,
    @Param('userId') userId: number,
    @Query('limit') limit?: number,
  ) {
    return await this.auditService.findByUser(tenantId, userId, limit);
  }

  @Get('resource/:resource/:resourceId')
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Get audit logs for a specific resource',
    description: 'Retrieve all audit log entries for a particular resource type and ID, useful for tracking changes to specific entities.'
  })
  @ApiParam({ name: 'resource', description: 'Resource type (e.g., users, tenants, roles)', example: 'users' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID to filter audit logs', example: 15 })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of logs to return', example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Resource audit logs retrieved successfully',
    schema: {
      example: [
        {
          id: 1,
          userId: 10,
          action: 'users.update',
          httpMethod: 'PUT',
          requestPath: '/api/users/15',
          statusCode: 200,
          changes: { before: { firstName: 'Jane' }, after: { firstName: 'John' } },
          createdAt: '2024-01-15T10:30:00Z',
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findByResource(
    @CurrentTenant() tenantId: number,
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: number,
    @Query('limit') limit?: number,
  ) {
    return await this.auditService.findByResource(tenantId, resource, resourceId, limit);
  }

  @Get('export')
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({
    summary: 'Export audit logs to CSV',
    description: 'Export filtered audit logs to a CSV file for external analysis and compliance reporting.'
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file generated successfully',
    headers: {
      'Content-Type': { description: 'text/csv' },
      'Content-Disposition': { description: 'attachment; filename=audit-logs.csv' }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=audit-logs.csv')
  async exportToCsv(
    @CurrentTenant() tenantId: number,
    @Query() queryDto: QueryAuditLogDto,
  ): Promise<StreamableFile> {
    const csv = await this.auditService.exportToCsv(tenantId, queryDto);
    return new StreamableFile(Buffer.from(csv));
  }
}
