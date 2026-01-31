import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Post,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ServiceNowConnectionService } from '../services/servicenow-connection.service';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

@Controller('servicenow/connections')
export class ServiceNowConnectionController {
  constructor(private readonly connectionService: ServiceNowConnectionService) {}

  /**
   * Get all ServiceNow connections
   * GET /api/v1/servicenow/connections
   */
  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.connectionService.findAll(tenantId);
  }

  /**
   * Get a single connection
   * GET /api/v1/servicenow/connections/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ) {
    return this.connectionService.findOne(id, tenantId);
  }

  /**
   * Update a connection
   * PATCH /api/v1/servicenow/connections/:id
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
    @Body() updateData: any,
  ) {
    return this.connectionService.update(id, tenantId, updateData);
  }

  /**
   * Delete a connection
   * DELETE /api/v1/servicenow/connections/:id
   */
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ) {
    return this.connectionService.remove(id, tenantId);
  }

  /**
   * Trigger manual sync
   * POST /api/v1/servicenow/connections/:id/sync
   */
  @Post(':id/sync')
  triggerSync(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
    @Body('syncType') syncType: 'full' | 'incremental' = 'incremental',
  ) {
    return this.connectionService.triggerSync(id, tenantId, syncType);
  }

  /**
   * Get sync history
   * GET /api/v1/servicenow/connections/:id/sync-history
   */
  @Get(':id/sync-history')
  getSyncHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
    @Query('limit', ParseIntPipe) limit: number = 50,
  ) {
    return this.connectionService.getSyncHistory(id, tenantId, limit);
  }
}
