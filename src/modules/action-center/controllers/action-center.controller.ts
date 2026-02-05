import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ActionGeneratorService } from '../services/action-generator.service';

@Controller('action-center')
@UseGuards(JwtAuthGuard)
export class ActionCenterController {
  constructor(private readonly actionGeneratorService: ActionGeneratorService) {}

  /**
   * GET /api/v1/action-center
   * Get all generated action items from ingested data
   */
  @Get()
  async getActions(
    @CurrentTenant() tenantId: number,
    @Query('status') status?: 'open' | 'in_progress' | 'done',
    @Query('priority') priority?: 'critical' | 'high' | 'medium' | 'low',
    @Query('search') search?: string,
  ) {
    if (search) {
      const actions = await this.actionGeneratorService.searchActions(tenantId, search);
      return { actions, total: actions.length };
    }

    if (status) {
      const actions = await this.actionGeneratorService.getActionsByStatus(tenantId, status);
      return { actions, total: actions.length };
    }

    if (priority) {
      const actions = await this.actionGeneratorService.getActionsByPriority(tenantId, priority);
      return { actions, total: actions.length };
    }

    return await this.actionGeneratorService.generateActions(tenantId);
  }

  /**
   * GET /api/v1/action-center/statistics
   * Get action center dashboard statistics
   */
  @Get('statistics')
  async getStatistics(@CurrentTenant() tenantId: number) {
    const { stats, byStatus } = await this.actionGeneratorService.generateActions(tenantId);
    return {
      ...stats,
      byStatus,
    };
  }
}
