import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AlertRule } from '../entities/alert-rule.entity';
import { AlertSubscription } from '../entities/alert-subscription.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { AlertOrchestratorService } from '../services/alert-orchestrator.service';
import { AlertDeliveryService } from '../services/alert-delivery.service';
import { AlertRateLimiterService } from '../services/alert-rate-limiter.service';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    @InjectRepository(AlertRule)
    private readonly ruleRepository: Repository<AlertRule>,
    @InjectRepository(AlertSubscription)
    private readonly subscriptionRepository: Repository<AlertSubscription>,
    @InjectRepository(AlertHistory)
    private readonly historyRepository: Repository<AlertHistory>,
    private readonly orchestrator: AlertOrchestratorService,
    private readonly delivery: AlertDeliveryService,
    private readonly rateLimiter: AlertRateLimiterService,
  ) {}

  /**
   * GET /api/v1/alerts/rules
   * Get all alert rules for the tenant
   */
  @Get('rules')
  async getRules(@CurrentTenant() tenantId: number) {
    const rules = await this.ruleRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    return { rules, total: rules.length };
  }

  /**
   * POST /api/v1/alerts/rules
   * Create a new alert rule
   */
  @Post('rules')
  async createRule(
    @CurrentTenant() tenantId: number,
    @CurrentUser() user: any,
    @Body() createDto: Partial<AlertRule>,
  ) {
    const rule = this.ruleRepository.create({
      ...createDto,
      tenantId,
      createdBy: user.userId,
    });

    return await this.ruleRepository.save(rule);
  }

  /**
   * PUT /api/v1/alerts/rules/:id
   * Update an alert rule
   */
  @Put('rules/:id')
  async updateRule(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<AlertRule>,
  ) {
    await this.ruleRepository.update(
      { id, tenantId },
      updateDto,
    );

    return await this.ruleRepository.findOne({ where: { id, tenantId } });
  }

  /**
   * DELETE /api/v1/alerts/rules/:id
   * Delete an alert rule
   */
  @Delete('rules/:id')
  async deleteRule(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.ruleRepository.delete({ id, tenantId });
    return { success: true };
  }

  /**
   * GET /api/v1/alerts/subscriptions
   * Get user's alert subscriptions
   */
  @Get('subscriptions')
  async getSubscriptions(
    @CurrentTenant() tenantId: number,
    @CurrentUser() user: any,
  ) {
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        tenantId,
        userId: user.userId,
      },
      relations: ['rule'],
      order: { createdAt: 'DESC' },
    });

    return { subscriptions, total: subscriptions.length };
  }

  /**
   * POST /api/v1/alerts/subscriptions
   * Subscribe to an alert rule
   */
  @Post('subscriptions')
  async subscribe(
    @CurrentTenant() tenantId: number,
    @CurrentUser() user: any,
    @Body()
    createDto: {
      ruleId: number;
      channels: {
        email?: { enabled: boolean; address?: string };
        slack?: { enabled: boolean; webhookUrl?: string; channel?: string };
      };
      preferences?: any;
    },
  ) {
    const subscription = this.subscriptionRepository.create({
      tenantId,
      userId: user.userId,
      ruleId: createDto.ruleId,
      channels: createDto.channels,
      preferences: createDto.preferences,
      isActive: true,
    });

    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * PUT /api/v1/alerts/subscriptions/:id
   * Update a subscription
   */
  @Put('subscriptions/:id')
  async updateSubscription(
    @CurrentTenant() tenantId: number,
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<AlertSubscription>,
  ) {
    await this.subscriptionRepository.update(
      { id, tenantId, userId: user.userId },
      updateDto,
    );

    return await this.subscriptionRepository.findOne({
      where: { id, tenantId, userId: user.userId },
    });
  }

  /**
   * DELETE /api/v1/alerts/subscriptions/:id
   * Unsubscribe from an alert rule
   */
  @Delete('subscriptions/:id')
  async unsubscribe(
    @CurrentTenant() tenantId: number,
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.subscriptionRepository.delete({
      id,
      tenantId,
      userId: user.userId,
    });

    return { success: true };
  }

  /**
   * GET /api/v1/alerts/history
   * Get alert history
   */
  @Get('history')
  async getHistory(
    @CurrentTenant() tenantId: number,
    @CurrentUser() user: any,
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
  ) {
    const where: any = {
      tenantId,
      userId: user.userId,
    };

    if (status) {
      where.status = status;
    }

    const history = await this.historyRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: parseInt(limit),
      relations: ['rule'],
    });

    return { history, total: history.length };
  }

  /**
   * GET /api/v1/alerts/stats
   * Get alert statistics
   */
  @Get('stats')
  async getStats(
    @CurrentTenant() tenantId: number,
    @Query('hours') hours: string = '24',
  ) {
    const deliveryStats = await this.delivery.getDeliveryStats(
      tenantId,
      parseInt(hours),
    );

    return deliveryStats;
  }

  /**
   * GET /api/v1/alerts/rate-limits
   * Get user's rate limit status
   */
  @Get('rate-limits')
  async getRateLimits(@CurrentUser() user: any) {
    const stats = await this.rateLimiter.getRateLimitStats(user.userId);

    return stats;
  }

  /**
   * POST /api/v1/alerts/process
   * Manually trigger alert processing
   */
  @Post('process')
  async manualProcess(
    @CurrentTenant() tenantId: number,
    @Body() body: { hoursBack?: number },
  ) {
    const result = await this.orchestrator.manualProcessAll(
      tenantId,
      body.hoursBack || 1,
    );

    return {
      success: true,
      ...result,
    };
  }
}
