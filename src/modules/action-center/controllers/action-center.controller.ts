import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
  NotFoundException,
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
    console.log(`[ActionCenterController] getActions called with tenantId: ${tenantId}, status: ${status}, priority: ${priority}, search: ${search}`);

    try {
      if (search) {
        console.log(`[ActionCenterController] Searching actions with term: ${search}`);
        const actions = await this.actionGeneratorService.searchActions(tenantId, search);
        console.log(`[ActionCenterController] Search returned ${actions.length} actions`);
        return { actions, total: actions.length };
      }

      if (status) {
        console.log(`[ActionCenterController] Filtering actions by status: ${status}`);
        const actions = await this.actionGeneratorService.getActionsByStatus(tenantId, status);
        console.log(`[ActionCenterController] Status filter returned ${actions.length} actions`);
        return { actions, total: actions.length };
      }

      if (priority) {
        console.log(`[ActionCenterController] Filtering actions by priority: ${priority}`);
        const actions = await this.actionGeneratorService.getActionsByPriority(tenantId, priority);
        console.log(`[ActionCenterController] Priority filter returned ${actions.length} actions`);
        return { actions, total: actions.length };
      }

      console.log('[ActionCenterController] Generating all actions...');
      const result = await this.actionGeneratorService.generateActions(tenantId);
      console.log(`[ActionCenterController] Generated ${result.actions.length} total actions`);
      return result;
    } catch (error) {
      console.error('[ActionCenterController] Error in getActions:', error);
      throw error;
    }
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

  /**
   * GET /api/v1/action-center/:id
   * Get detailed information about a specific action with resolution steps
   */
  @Get(':id')
  async getActionDetail(
    @CurrentTenant() tenantId: number,
    @Param('id') id: string,
  ) {
    console.log(`[ActionCenterController] Getting action detail for id: ${id}`);

    // Get all actions and find the specific one
    const { actions } = await this.actionGeneratorService.generateActions(tenantId);
    const action = actions.find(a => a.id === id);

    if (!action) {
      throw new NotFoundException(`Action with id ${id} not found`);
    }

    // Generate detailed resolution steps based on action type
    const resolutionPlan = await this.actionGeneratorService.generateResolutionPlan(action);

    return {
      ...action,
      resolutionPlan,
    };
  }
}
