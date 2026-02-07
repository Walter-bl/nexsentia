import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MetricDefinitionService } from '../services/metric-definition.service';
import { MetricAggregationService } from '../services/metric-aggregation.service';
import { BusinessImpactService } from '../services/business-impact.service';
import { KpiValidationService } from '../services/kpi-validation.service';
import { MetricValue } from '../entities/metric-value.entity';
import { MetricDefinition } from '../entities/metric-definition.entity';
import { KpiSnapshot } from '../entities/kpi-snapshot.entity';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { WeakSignal } from '../../weak-signals/entities/weak-signal.entity';

@Controller('kpi/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    @InjectRepository(MetricValue)
    private readonly metricValueRepository: Repository<MetricValue>,
    @InjectRepository(MetricDefinition)
    private readonly metricDefinitionRepository: Repository<MetricDefinition>,
    @InjectRepository(KpiSnapshot)
    private readonly snapshotRepository: Repository<KpiSnapshot>,
    @InjectRepository(JiraIssue)
    private readonly jiraIssueRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowIncidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(SlackMessage)
    private readonly slackMessageRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsMessageRepository: Repository<TeamsMessage>,
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
    private readonly definitionService: MetricDefinitionService,
    private readonly aggregationService: MetricAggregationService,
    private readonly impactService: BusinessImpactService,
    private readonly validationService: KpiValidationService,
  ) {}

  @Get('organizational-pulse')
  async getOrganizationalPulse(
    @CurrentTenant() tenantId: number,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('timeRange') timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
  ) {
    console.log('[OrganizationalPulse] Starting for tenant:', tenantId);

    // Calculate date range based on timeRange parameter or custom dates
    const { start, end } = this.calculateDateRange(periodStart, periodEnd, timeRange);
    console.log('[OrganizationalPulse] Date range:', { start, end });

    // Get org health metrics and calculate them from raw ingestion data
    const metrics = await this.definitionService.getMetrics(tenantId, 'org_health');
    console.log('[OrganizationalPulse] Found metrics:', metrics.length);
    const metricData = [];

    for (const metric of metrics) {
      // Calculate metric directly from ingestion data in real-time
      const result = await this.aggregationService.calculateMetric(metric, {
        tenantId,
        periodStart: start,
        periodEnd: end,
        granularity: 'daily',
      });

      if (result && result.value !== undefined) {
        // Calculate comparison with previous period for trend
        const previousPeriodStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
        const previousResult = await this.aggregationService.calculateMetric(metric, {
          tenantId,
          periodStart: previousPeriodStart,
          periodEnd: start,
          granularity: 'daily',
        });

        const previousValue = previousResult?.value || result.value;
        const changePercent = previousValue ? ((result.value - previousValue) / previousValue) * 100 : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (Math.abs(changePercent) > 5) {
          trend = changePercent > 0 ? 'up' : 'down';
        }

        metricData.push({
          key: metric.metricKey,
          name: metric.name,
          value: result.value,
          unit: metric.displayConfig?.unit,
          trend: trend,
          changePercent: parseFloat(changePercent.toFixed(2)),
          status: this.determineStatus(result.value, metric.thresholds),
          breakdown: result.breakdown,
        });
      }
    }

    // Calculate overall health score
    const summary = this.calculateSummary(metricData);
    console.log('[OrganizationalPulse] Summary calculated:', summary);

    // Get business impacts for escalations chart
    const impacts = await this.impactService.getImpacts(tenantId, start, end);
    const totalLoss = await this.impactService.getTotalRevenueLoss(tenantId, start, end);
    console.log('[OrganizationalPulse] Business impacts:', impacts.length, 'Total loss:', totalLoss);

    // Group impacts by month for business escalations chart
    const escalationsByMonth = this.groupImpactsByMonth(impacts, start, end);

    // Calculate strategic alignment metrics
    const strategicAlignment = this.calculateStrategicAlignment(metricData);

    // Get team signals breakdown
    const teamSignals = this.getTeamSignals(metricData);

    // Get recent signals (timeline events)
    console.log('[OrganizationalPulse] Fetching recent signals for tenant:', tenantId);
    const recentSignals = await this.getRecentSignals(tenantId, end);
    console.log('[OrganizationalPulse] Recent signals found:', recentSignals.length);

    // Get signal distribution by theme
    const signalDistribution = await this.getSignalDistributionByTheme(tenantId, start, end);
    console.log('[OrganizationalPulse] Signal distribution:', signalDistribution.length);

    return {
      overallHealth: {
        score: Math.round(summary.overallHealth),
        status: this.getHealthStatus(summary.overallHealth),
        totalMetrics: summary.totalMetrics,
        excellentCount: summary.excellentCount,
        goodCount: summary.goodCount,
        warningCount: summary.warningCount,
        criticalCount: summary.criticalCount,
      },
      strategicAlignment: {
        overall: strategicAlignment.overall,
        categories: strategicAlignment.categories,
      },
      businessEscalations: {
        chartData: escalationsByMonth,
        totalCount: impacts.length,
        totalLoss: parseFloat(totalLoss.total.toString()),
      },
      teamSignals: teamSignals,
      recentSignals: recentSignals,
      signalDistribution: signalDistribution,
      metrics: metricData,
      period: { start, end },
    };
  }

  @Get('signals/:signalId')
  async getSignalDetails(
    @CurrentTenant() tenantId: number,
    @Param('signalId') signalId: string,
  ) {
    // Parse signal ID format: {source}_{id}
    const parts = signalId.split('_');
    if (parts.length !== 2) {
      throw new NotFoundException(`Invalid signal ID format: ${signalId}`);
    }

    const [source, id] = parts;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      throw new NotFoundException(`Invalid signal ID: ${signalId}`);
    }

    let signal: any = null;

    switch (source) {
      case 'jira':
        const jiraIssue = await this.jiraIssueRepository.findOne({
          where: { tenantId, id: numericId },
          relations: ['project'],
        });

        if (!jiraIssue) {
          throw new NotFoundException(`Jira issue not found: ${signalId}`);
        }

        signal = {
          id: signalId,
          type: jiraIssue.issueType === 'incident' ? 'incident' : 'task',
          title: jiraIssue.summary,
          description: jiraIssue.description || '',
          source: 'jira',
          severity: this.mapJiraPriorityToSeverity(jiraIssue.priority),
          timestamp: jiraIssue.jiraCreatedAt,
          team: 'Engineering',
          details: {
            issueKey: jiraIssue.jiraIssueKey,
            issueType: jiraIssue.issueType,
            status: jiraIssue.status,
            priority: jiraIssue.priority,
            assignee: jiraIssue.assigneeDisplayName,
            reporter: jiraIssue.reporterDisplayName,
            projectKey: jiraIssue.project?.jiraProjectKey,
            projectName: jiraIssue.project?.name,
            labels: jiraIssue.labels,
            createdAt: jiraIssue.jiraCreatedAt,
            updatedAt: jiraIssue.jiraUpdatedAt,
            resolvedAt: jiraIssue.resolvedAt,
            resolution: jiraIssue.resolution,
          },
        };
        break;

      case 'servicenow':
        const incident = await this.serviceNowIncidentRepository.findOne({
          where: { tenantId, id: numericId },
        });

        if (!incident) {
          throw new NotFoundException(`ServiceNow incident not found: ${signalId}`);
        }

        signal = {
          id: signalId,
          type: 'incident',
          title: incident.shortDescription,
          description: incident.description || '',
          source: 'servicenow',
          severity: this.mapServiceNowPriorityToSeverity(incident.priority),
          timestamp: incident.openedAt,
          team: incident.assignmentGroupName || 'Unknown',
          details: {
            number: incident.number,
            state: incident.state,
            priority: incident.priority,
            urgency: incident.urgency,
            impact: incident.impact,
            category: incident.category,
            subcategory: incident.subcategory,
            assignedTo: incident.assignedToName,
            assignmentGroup: incident.assignmentGroupName,
            openedAt: incident.openedAt,
            resolvedAt: incident.resolvedAt,
            closedAt: incident.closedAt,
            closeNotes: incident.closeNotes,
          },
        };
        break;

      case 'slack':
        const slackMessage = await this.slackMessageRepository.findOne({
          where: { tenantId, id: numericId },
          relations: ['channel'],
        });

        if (!slackMessage) {
          throw new NotFoundException(`Slack message not found: ${signalId}`);
        }

        signal = {
          id: signalId,
          type: 'communication',
          title: this.truncateText(slackMessage.text || '', 80),
          description: slackMessage.text || '',
          source: 'slack',
          timestamp: slackMessage.slackCreatedAt,
          team: this.mapChannelToTeam(slackMessage.channel?.name),
          details: {
            channelName: slackMessage.channel?.name,
            channelId: slackMessage.slackChannelId,
            userId: slackMessage.slackUserId,
            messageType: slackMessage.type,
            subtype: slackMessage.subtype,
            threadTs: slackMessage.slackThreadTs,
            replyCount: slackMessage.replyCount,
            createdAt: slackMessage.slackCreatedAt,
          },
        };
        break;

      case 'teams':
        const teamsMessage = await this.teamsMessageRepository.findOne({
          where: { tenantId, id: numericId },
          relations: ['user', 'channel'],
        });

        if (!teamsMessage) {
          throw new NotFoundException(`Teams message not found: ${signalId}`);
        }

        signal = {
          id: signalId,
          type: 'communication',
          title: this.truncateText(teamsMessage.content || '', 80),
          description: teamsMessage.content || '',
          source: 'teams',
          timestamp: teamsMessage.createdDateTime,
          team: 'Product',
          details: {
            channelId: teamsMessage.teamsChannelId,
            teamId: teamsMessage.teamId,
            from: teamsMessage.user?.displayName,
            fromUserId: teamsMessage.teamsUserId,
            messageType: teamsMessage.messageType,
            replyToId: teamsMessage.replyToId,
            createdAt: teamsMessage.createdDateTime,
            lastModified: teamsMessage.lastModifiedDateTime,
          },
        };
        break;

      default:
        throw new NotFoundException(`Unknown signal source: ${source}`);
    }

    return signal;
  }

  @Get('org-health')
  async getOrgHealthDashboard(
    @CurrentTenant() tenantId: number,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('timeRange') timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
  ) {
    const { start, end } = this.calculateDateRange(periodStart, periodEnd, timeRange);

    const metrics = await this.definitionService.getMetrics(tenantId, 'org_health');
    const metricData = [];

    for (const metric of metrics) {
      const values = await this.aggregationService.getMetricValues(
        tenantId,
        metric.metricKey,
        start,
        end,
      );

      const latestValue = values[values.length - 1];

      if (latestValue) {
        metricData.push({
          key: metric.metricKey,
          name: metric.name,
          value: latestValue.value,
          unit: metric.displayConfig?.unit,
          trend: latestValue.comparisonData?.trend,
          changePercent: latestValue.comparisonData?.changePercent,
          status: this.determineStatus(latestValue.value, metric.thresholds),
          chartData: values.map(v => ({
            date: v.periodStart,
            value: v.value,
          })),
        });
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(metricData);

    return {
      category: 'org_health',
      period: { start, end },
      metrics: metricData,
      summary,
    };
  }

  @Get('business-impact')
  async getBusinessImpactDashboard(
    @CurrentTenant() tenantId: number,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('timeRange') timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
  ) {
    const { start, end } = this.calculateDateRange(periodStart, periodEnd, timeRange);

    const totalLoss = await this.impactService.getTotalRevenueLoss(tenantId, start, end);
    const impacts = await this.impactService.getImpacts(tenantId, start, end);

    return {
      period: { start, end },
      totalLoss,
      impactCount: impacts.length,
      validatedCount: impacts.filter(i => i.isValidated).length,
      impacts: impacts.slice(0, 10), // Top 10 impacts
      byType: totalLoss.byType,
      bySeverity: totalLoss.bySeverity,
    };
  }

  @Get('health-report')
  async getHealthReport(
    @CurrentTenant() tenantId: number,
  ) {
    // Get latest metric values
    const metricValues = await this.metricValueRepository
      .createQueryBuilder('mv')
      .leftJoinAndSelect('mv.metricDefinition', 'md')
      .where('mv.tenantId = :tenantId', { tenantId })
      .andWhere('md.isActive = :isActive', { isActive: true })
      .orderBy('mv.createdAt', 'DESC')
      .limit(100)
      .getMany();

    // Build definition map
    const definitionMap = new Map<number, MetricDefinition>();
    for (const value of metricValues) {
      if (value.metricDefinition) {
        definitionMap.set(value.metricDefinitionId, value.metricDefinition);
      }
    }

    const report = this.validationService.generateHealthReport(
      metricValues,
      definitionMap,
    );

    this.validationService.logValidationIssues(report);

    return report;
  }

  @Post('snapshot')
  async createSnapshot(
    @CurrentTenant() tenantId: number,
  ) {
    const categories = ['org_health', 'business_impact'];
    const snapshots = [];

    for (const category of categories) {
      const metrics = await this.definitionService.getMetrics(tenantId, category);
      const metricsData: Record<string, any> = {};

      for (const metric of metrics) {
        const values = await this.aggregationService.getMetricValues(
          tenantId,
          metric.metricKey,
          new Date(Date.now() - 24 * 60 * 60 * 1000),
          new Date(),
        );

        const latest = values[values.length - 1];
        if (latest) {
          metricsData[metric.metricKey] = {
            value: latest.value,
            trend: latest.comparisonData?.trend,
            changePercent: latest.comparisonData?.changePercent,
            status: this.determineStatus(latest.value, metric.thresholds),
          };
        }
      }

      const summary = this.calculateSummary(
        Object.values(metricsData).map(m => ({ status: m.status })),
      );

      const snapshot = this.snapshotRepository.create({
        tenantId,
        snapshotDate: new Date(),
        category,
        metrics: metricsData,
        summary,
      });

      snapshots.push(await this.snapshotRepository.save(snapshot));
    }

    return snapshots;
  }

  private determineStatus(
    value: number,
    thresholds?: MetricDefinition['thresholds'],
  ): 'excellent' | 'good' | 'warning' | 'critical' {
    if (!thresholds) return 'good';

    if (thresholds.critical) {
      if (
        (thresholds.critical.min !== undefined && value < thresholds.critical.min) ||
        (thresholds.critical.max !== undefined && value > thresholds.critical.max)
      ) {
        return 'critical';
      }
    }

    if (thresholds.warning) {
      if (
        (thresholds.warning.min !== undefined && value < thresholds.warning.min) ||
        (thresholds.warning.max !== undefined && value > thresholds.warning.max)
      ) {
        return 'warning';
      }
    }

    if (thresholds.excellent) {
      if (
        (thresholds.excellent.min === undefined || value >= thresholds.excellent.min) &&
        (thresholds.excellent.max === undefined || value <= thresholds.excellent.max)
      ) {
        return 'excellent';
      }
    }

    return 'good';
  }

  private calculateSummary(metrics: Array<{ status?: string }>) {
    const excellentCount = metrics.filter(m => m.status === 'excellent').length;
    const goodCount = metrics.filter(m => m.status === 'good').length;
    const warningCount = metrics.filter(m => m.status === 'warning').length;
    const criticalCount = metrics.filter(m => m.status === 'critical').length;

    const totalMetrics = metrics.length;
    const overallHealth = totalMetrics > 0
      ? ((excellentCount * 100 + goodCount * 75 + warningCount * 50 + criticalCount * 25) / totalMetrics)
      : 0;

    return {
      totalMetrics,
      excellentCount,
      goodCount,
      warningCount,
      criticalCount,
      overallHealth,
    };
  }

  private getHealthStatus(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  }

  private calculateDateRange(
    periodStart?: string,
    periodEnd?: string,
    timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
  ): { start: Date; end: Date } {
    const end = periodEnd ? new Date(periodEnd) : new Date();

    // If custom start date provided, use it
    if (periodStart) {
      return { start: new Date(periodStart), end };
    }

    // Otherwise, calculate based on timeRange
    const now = new Date();
    let start: Date;

    switch (timeRange) {
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '14d':
        start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        // Default to last 7 days
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  private groupImpactsByMonth(impacts: any[], start: Date, end: Date) {
    const monthlyData = [];
    const current = new Date(start);

    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

      const monthImpacts = impacts.filter(i => {
        const impactDate = new Date(i.impactDate);
        return impactDate >= monthStart && impactDate <= monthEnd;
      });

      monthlyData.push({
        month: monthStart.toISOString().slice(0, 7),
        count: monthImpacts.length,
        totalLoss: monthImpacts.reduce((sum, i) => sum + (parseFloat(i.estimatedRevenueLoss) || 0), 0),
        bySeverity: {
          critical: monthImpacts.filter(i => i.severity === 'critical').length,
          high: monthImpacts.filter(i => i.severity === 'high').length,
          medium: monthImpacts.filter(i => i.severity === 'medium').length,
          low: monthImpacts.filter(i => i.severity === 'low').length,
        },
      });

      current.setMonth(current.getMonth() + 1);
    }

    return monthlyData;
  }

  private calculateStrategicAlignment(metrics: any[]) {
    const categories = {
      incident_management: ['incident_resolution_time', 'mttr', 'incident_volume'],
      team_productivity: ['team_velocity', 'issue_throughput', 'cycle_time'],
      communication: ['response_time', 'collaboration_index'],
      quality: ['defect_density', 'rework_rate'],
      engagement: ['team_engagement'],
    };

    const categoryScores: Record<string, { score: number; trend: 'up' | 'down' | 'stable'; metricsCount: number }> = {};
    let totalScore = 0;
    let categoryCount = 0;

    for (const [category, metricKeys] of Object.entries(categories)) {
      const categoryMetrics = metrics.filter(m => metricKeys.includes(m.key));

      if (categoryMetrics.length > 0) {
        const categoryScore = categoryMetrics.reduce((sum, m) => {
          const status = m.status || 'good';
          const score = status === 'excellent' ? 100 : status === 'good' ? 75 : status === 'warning' ? 50 : 25;
          return sum + score;
        }, 0) / categoryMetrics.length;

        categoryScores[category] = {
          score: Math.round(categoryScore),
          trend: this.calculateCategoryTrend(categoryMetrics),
          metricsCount: categoryMetrics.length,
        };

        totalScore += categoryScore;
        categoryCount++;
      }
    }

    return {
      overall: categoryCount > 0 ? Math.round(totalScore / categoryCount) : 0,
      categories: categoryScores,
    };
  }

  private calculateCategoryTrend(metrics: any[]): 'up' | 'down' | 'stable' {
    const trends = metrics.map(m => m.trend).filter(t => t);

    if (trends.length === 0) return 'stable';

    const upCount = trends.filter(t => t === 'up').length;
    const downCount = trends.filter(t => t === 'down').length;

    if (upCount > downCount * 1.5) return 'up';
    if (downCount > upCount * 1.5) return 'down';
    return 'stable';
  }

  private getTeamSignals(metrics: any[]): {
    byMetric: Array<{
      key: string;
      name: string;
      unit?: string;
      value: number;
      status: 'excellent' | 'good' | 'warning' | 'critical';
    }>;
    byTeam: Array<{
      team: string;
      metrics: Array<{
        key: string;
        name: string;
        value: number;
        unit?: string;
        status: 'excellent' | 'good' | 'warning' | 'critical';
      }>;
      overallScore: number;
    }>;
  } {
    const byMetric: Array<{
      key: string;
      name: string;
      unit?: string;
      value: number;
      status: 'excellent' | 'good' | 'warning' | 'critical';
    }> = [];

    const byTeam: Array<{
      team: string;
      metrics: Array<{
        key: string;
        name: string;
        value: number;
        unit?: string;
        status: 'excellent' | 'good' | 'warning' | 'critical';
      }>;
      overallScore: number;
    }> = [];

    // Group by metric key - calculate overall value across all teams
    for (const metric of metrics) {
      if (metric.breakdown?.byTeam) {
        // Calculate overall value (average across all teams)
        const teamValues = Object.values(metric.breakdown.byTeam) as number[];
        const overallValue = teamValues.length > 0
          ? teamValues.reduce((sum, val) => sum + val, 0) / teamValues.length
          : metric.value;

        byMetric.push({
          key: metric.key,
          name: metric.name,
          unit: metric.unit,
          value: parseFloat(overallValue.toFixed(2)),
          status: metric.status,
        });
      }
    }

    // Group by team (for team-specific views)
    const teamMap: Map<string, Array<{
      key: string;
      name: string;
      value: number;
      unit?: string;
      status: 'excellent' | 'good' | 'warning' | 'critical';
    }>> = new Map();

    for (const metric of metrics) {
      if (metric.breakdown?.byTeam) {
        for (const [team, value] of Object.entries(metric.breakdown.byTeam)) {
          if (!teamMap.has(team)) {
            teamMap.set(team, []);
          }
          teamMap.get(team)!.push({
            key: metric.key,
            name: metric.name,
            value: value as number,
            unit: metric.unit,
            status: this.determineStatus(value as number, undefined),
          });
        }
      }
    }

    // Calculate overall score for each team
    for (const [team, teamMetrics] of teamMap.entries()) {
      const statusScores = teamMetrics.map(m => {
        const status = m.status;
        return status === 'excellent' ? 100 : status === 'good' ? 75 : status === 'warning' ? 50 : 25;
      });

      const overallScore = statusScores.length > 0
        ? Math.round(statusScores.reduce((a, b) => a + b, 0) / statusScores.length)
        : 0;

      byTeam.push({
        team,
        metrics: teamMetrics,
        overallScore,
      });
    }

    return {
      byMetric,
      byTeam,
    };
  }

  private async getRecentSignals(tenantId: number, endDate: Date): Promise<Array<{
    id: number;
    signalType: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    confidenceScore: number;
    status: string;
    timestamp: Date;
    category?: string;
    affectedEntities: any;
  }>> {
    console.log('[getRecentSignals] Querying weak signals for tenant:', tenantId);

    // Get recent detected weak signals (last 15)
    const weakSignals = await this.weakSignalRepository.find({
      where: {
        tenantId,
      },
      order: {
        detectedAt: 'DESC',
      },
      take: 15,
    });

    console.log('[getRecentSignals] Found weak signals:', weakSignals.length);
    if (weakSignals.length > 0) {
      console.log('[getRecentSignals] First signal:', {
        id: weakSignals[0].id,
        type: weakSignals[0].signalType,
        title: weakSignals[0].title,
        detectedAt: weakSignals[0].detectedAt,
      });
    }

    return weakSignals.map(signal => ({
      id: signal.id,
      signalType: signal.signalType,
      title: signal.title,
      description: signal.description,
      severity: signal.severity,
      confidenceScore: Number(signal.confidenceScore),
      status: signal.status,
      timestamp: signal.detectedAt,
      category: signal.category || undefined,
      affectedEntities: signal.affectedEntities,
    }));
  }

  private async getSignalDistributionByTheme(
    tenantId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    theme: string;
    incidentCount: number;
    signalCount: number;
    color: string;
  }>> {
    // Count incidents and signals by theme/category
    const [
      jiraIssues,
      serviceNowIncidents,
      slackMessages,
      teamsMessages,
    ] = await Promise.all([
      this.jiraIssueRepository.count({
        where: {
          tenantId,
          jiraCreatedAt: Between(startDate, endDate),
        },
      }),
      this.serviceNowIncidentRepository.count({
        where: {
          tenantId,
          openedAt: Between(startDate, endDate),
        },
      }),
      this.slackMessageRepository.count({
        where: {
          tenantId,
          slackCreatedAt: Between(startDate, endDate),
        },
      }),
      this.teamsMessageRepository.count({
        where: {
          tenantId,
          createdDateTime: Between(startDate, endDate),
        },
      }),
    ]);

    // Get incidents by category for more detailed breakdown
    const incidents = await this.serviceNowIncidentRepository.find({
      where: {
        tenantId,
        openedAt: Between(startDate, endDate),
      },
      select: ['category', 'priority'],
    });

    const issues = await this.jiraIssueRepository.find({
      where: {
        tenantId,
        jiraCreatedAt: Between(startDate, endDate),
      },
      select: ['issueType', 'priority'],
    });

    // Categorize by theme
    const themes = {
      Communication: {
        incidentCount: 0,
        signalCount: slackMessages + teamsMessages,
        color: '#10b981', // green
      },
      System: {
        incidentCount: incidents.filter(i =>
          i.category === 'Infrastructure' || i.category === 'Network'
        ).length,
        signalCount: incidents.filter(i =>
          i.category === 'Infrastructure' || i.category === 'Network'
        ).length,
        color: '#06b6d4', // cyan
      },
      Product: {
        incidentCount: issues.filter(i => i.issueType === 'bug' || i.issueType === 'incident').length,
        signalCount: issues.filter(i => i.issueType === 'bug' || i.issueType === 'incident').length,
        color: '#8b5cf6', // purple
      },
      Checkout: {
        incidentCount: incidents.filter(i =>
          i.category === 'Application' &&
          incidents.filter(inc => inc.category === 'Application').indexOf(i) < incidents.filter(inc => inc.category === 'Application').length / 2
        ).length,
        signalCount: incidents.filter(i =>
          i.category === 'Application'
        ).length,
        color: '#22c55e', // green
      },
      Stock: {
        incidentCount: issues.filter(i => i.issueType === 'task').length,
        signalCount: issues.filter(i => i.issueType === 'task' || i.issueType === 'story').length,
        color: '#f59e0b', // amber
      },
    };

    return Object.entries(themes).map(([theme, data]) => ({
      theme,
      incidentCount: data.incidentCount,
      signalCount: data.signalCount,
      color: data.color,
    }));
  }

  private mapJiraPriorityToSeverity(priority?: string): 'critical' | 'high' | 'medium' | 'low' {
    if (!priority) return 'medium';
    const p = priority.toLowerCase();
    if (p === 'critical' || p === 'highest') return 'critical';
    if (p === 'high') return 'high';
    if (p === 'low' || p === 'lowest') return 'low';
    return 'medium';
  }

  private mapServiceNowPriorityToSeverity(priority?: string): 'critical' | 'high' | 'medium' | 'low' {
    if (!priority) return 'medium';
    if (priority.includes('1') || priority.toLowerCase().includes('critical')) return 'critical';
    if (priority.includes('2') || priority.toLowerCase().includes('high')) return 'high';
    if (priority.includes('4') || priority.toLowerCase().includes('low')) return 'low';
    return 'medium';
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private mapChannelToTeam(channelName: string): string {
    if (!channelName) return 'Unknown';

    const name = channelName.toLowerCase();
    if (name.includes('engineering') || name.includes('dev')) {
      return 'Engineering';
    } else if (name.includes('product')) {
      return 'Product';
    } else if (name.includes('support')) {
      return 'Support';
    }
    return 'Engineering'; // Default
  }
}
