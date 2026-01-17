import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions, CurrentTenant, CurrentUser } from '../../common/decorators';
import { Permission } from '../../common/enums';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT')
@ApiSecurity('TenantId')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Get audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@CurrentTenant() tenantId: number, @Query() queryDto: QueryAuditLogDto) {
    return await this.auditService.findAll(tenantId, queryDto);
  }

  @Get('user/:userId')
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  @ApiResponse({ status: 200, description: 'User audit logs retrieved successfully' })
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
  @ApiOperation({ summary: 'Get audit logs for a specific resource' })
  @ApiResponse({ status: 200, description: 'Resource audit logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findByResource(
    @CurrentTenant() tenantId: number,
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: number,
    @Query('limit') limit?: number,
  ) {
    return await this.auditService.findByResource(tenantId, resource, resourceId, limit);
  }
}
