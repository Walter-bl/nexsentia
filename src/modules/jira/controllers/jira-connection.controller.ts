import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JiraConnectionService } from '../services/jira-connection.service';
import { JiraIngestionService } from '../services/jira-ingestion.service';
import { UpdateJiraConnectionDto } from '../dto/update-jira-connection.dto';
import { QueryJiraConnectionDto } from '../dto/query-jira-connection.dto';
import { SyncJiraDto } from '../dto/sync-jira.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { UserRole } from '../../../common/enums';

@ApiTags('Jira Connections')
@Controller('jira/connections')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class JiraConnectionController {
  constructor(
    private readonly connectionService: JiraConnectionService,
    private readonly ingestionService: JiraIngestionService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.ANALYST)
  @ApiOperation({ summary: 'Get all Jira connections for tenant' })
  @ApiResponse({ status: 200, description: 'List of Jira connections' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query() query: QueryJiraConnectionDto,
  ) {
    return await this.connectionService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.ANALYST)
  @ApiOperation({ summary: 'Get Jira connection by ID' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'Connection found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async findOne(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.connectionService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update Jira connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'Connection successfully updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async update(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJiraConnectionDto,
  ) {
    return await this.connectionService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete Jira connection (soft delete)' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 204, description: 'Connection successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async remove(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.connectionService.remove(tenantId, id);
  }

  @Post(':id/sync')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Trigger manual sync for Jira connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'Sync started successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Sync already in progress' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async sync(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SyncJiraDto,
  ) {
    return await this.ingestionService.syncConnection(
      tenantId,
      id,
      dto.syncType as 'full' | 'incremental',
      dto.projectKeys,
    );
  }

  @Get(':id/sync-history')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.ANALYST)
  @ApiOperation({ summary: 'Get sync history for connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'Sync history' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async getSyncHistory(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.ingestionService.getSyncHistory(tenantId, id);
  }

}
