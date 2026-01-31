import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { TeamsConnectionService } from '../services/teams-connection.service';
import { TeamsIngestionService } from '../services/teams-ingestion.service';
import { TeamsConnection } from '../entities/teams-connection.entity';

@Controller('teams/connections')
@UseGuards(JwtAuthGuard)
export class TeamsConnectionController {
  constructor(
    private readonly connectionService: TeamsConnectionService,
    private readonly ingestionService: TeamsIngestionService,
  ) {}

  /**
   * Get all Teams connections
   * GET /teams/connections
   */
  @Get()
  async findAll(@CurrentTenant() tenantId: number): Promise<TeamsConnection[]> {
    return this.connectionService.findAll(tenantId);
  }

  /**
   * Get a specific Teams connection
   * GET /teams/connections/:id
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ): Promise<TeamsConnection> {
    return this.connectionService.findOne(id, tenantId);
  }

  /**
   * Update a Teams connection
   * PATCH /teams/connections/:id
   */
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
    @Body() updateData: Partial<TeamsConnection>,
  ): Promise<TeamsConnection> {
    return this.connectionService.update(id, tenantId, updateData);
  }

  /**
   * Delete a Teams connection
   * DELETE /teams/connections/:id
   */
  @Delete(':id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ): Promise<{ message: string }> {
    await this.connectionService.delete(id, tenantId);
    return { message: 'Connection deleted successfully' };
  }

  /**
   * Manually trigger sync for a connection
   * POST /teams/connections/:id/sync
   */
  @Post(':id/sync')
  async triggerSync(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ): Promise<any> {
    const syncHistory = await this.ingestionService.syncConnection(tenantId, id);
    return {
      message: 'Sync completed successfully',
      syncHistory,
    };
  }

  /**
   * Get sync history for a connection
   * GET /teams/connections/:id/sync-history
   */
  @Get(':id/sync-history')
  async getSyncHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ): Promise<any[]> {
    return this.connectionService.getSyncHistory(id, tenantId);
  }
}
