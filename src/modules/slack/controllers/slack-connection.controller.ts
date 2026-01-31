import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Post,
  ParseIntPipe,
} from '@nestjs/common';
import { SlackConnectionService } from '../services/slack-connection.service';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

@Controller('slack/connections')
export class SlackConnectionController {
  constructor(private readonly connectionService: SlackConnectionService) {}

  /**
   * Get all Slack connections
   * GET /api/v1/slack/connections
   */
  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.connectionService.findAll(tenantId);
  }

  /**
   * Get a single connection
   * GET /api/v1/slack/connections/:id
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
   * PATCH /api/v1/slack/connections/:id
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
   * DELETE /api/v1/slack/connections/:id
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
   * POST /api/v1/slack/connections/:id/sync
   */
  @Post(':id/sync')
  triggerSync(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
    @Body('syncType') syncType: 'full' | 'incremental' = 'incremental',
  ) {
    return this.connectionService.triggerSync(id, tenantId, syncType);
  }
}
