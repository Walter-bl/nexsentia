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
import { TeamImpactService } from '../services/team-impact.service';
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
    private readonly teamImpactService: TeamImpactService,
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
      console.log(`[OrganizationalPulse] Calculating metric ${metric.metricKey} for period:`, { start, end });
      const result = await this.aggregationService.calculateMetric(metric, {
        tenantId,
        periodStart: start,
        periodEnd: end,
        granularity: 'daily',
      });
      console.log(`[OrganizationalPulse] Metric ${metric.metricKey} result:`, { value: result?.value, dataPoints: result?.metadata?.dataPoints });

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

        const status = this.determineStatus(result.value, metric.thresholds);
        console.log(`[OrganizationalPulse] ===== Metric: ${metric.metricKey} =====`);
        console.log(`  Value: ${result.value} ${metric.displayConfig?.unit || ''}`);
        console.log(`  DataPoints: ${result.metadata?.dataPoints}`);
        console.log(`  Status: ${status}`);
        console.log(`  Thresholds:`, JSON.stringify(metric.thresholds, null, 2));

        metricData.push({
          key: metric.metricKey,
          name: metric.name,
          value: result.value,
          unit: metric.displayConfig?.unit,
          trend: trend,
          changePercent: parseFloat(changePercent.toFixed(2)),
          status,
          breakdown: result.breakdown,
        });
      }
    }

    // Calculate overall health score
    const summary = this.calculateSummary(metricData);
    console.log('[OrganizationalPulse] Summary calculated:', summary);

    // Get business impacts for escalations chart
    console.log('[OrganizationalPulse] Fetching impacts for date range:', { start, end, timeRange });
    const impacts = await this.impactService.getImpacts(tenantId, start, end);

    // Calculate total time loss in hours from all business impacts
    // Time loss is calculated from incident/issue duration across all impacts
    const totalHoursLost = this.calculateTotalHoursLost(impacts);
    console.log('[OrganizationalPulse] Business impacts:', impacts.length, 'Total hours lost:', totalHoursLost);

    // Group impacts by month for business escalations chart
    const escalationsByMonth = this.groupImpactsByMonthWithHours(impacts, start, end, timeRange);
    console.log('[OrganizationalPulse] Escalations by month:', JSON.stringify(escalationsByMonth, null, 2));

    // Calculate strategic alignment metrics
    const strategicAlignment = this.calculateStrategicAlignment(metricData);

    // Get team signals breakdown
    const teamSignals = this.getTeamSignals(metricData);

    // Get recent signals (timeline events) grouped by source
    console.log('[OrganizationalPulse] Fetching recent signals for tenant:', tenantId);
    const recentSignals = await this.getRecentSignals(tenantId, end);
    const totalSignals = recentSignals.jira.length + recentSignals.servicenow.length + recentSignals.slack.length + recentSignals.teams.length;
    console.log('[OrganizationalPulse] Recent signals found:', totalSignals, {
      jira: recentSignals.jira.length,
      servicenow: recentSignals.servicenow.length,
      slack: recentSignals.slack.length,
      teams: recentSignals.teams.length,
    });

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
        // totalHoursLost: Sum of time lost in hours across all business impacts in the period
        // This includes incident resolution time, downtime duration, and time to fix bugs
        // Calculated from durationMinutes field converted to hours
        totalHoursLost: Math.round(totalHoursLost * 10) / 10, // Round to 1 decimal place
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

    // Helper to check if value is within a range
    const isInRange = (min?: number, max?: number): boolean => {
      const aboveMin = min === undefined || value >= min;
      const belowMax = max === undefined || value <= max;
      return aboveMin && belowMax;
    };

    // Check in order from best to worst
    if (thresholds.excellent && isInRange(thresholds.excellent.min, thresholds.excellent.max)) {
      return 'excellent';
    }

    if (thresholds.good && isInRange(thresholds.good.min, thresholds.good.max)) {
      return 'good';
    }

    if (thresholds.warning && isInRange(thresholds.warning.min, thresholds.warning.max)) {
      return 'warning';
    }

    if (thresholds.critical && isInRange(thresholds.critical.min, thresholds.critical.max)) {
      return 'critical';
    }

    // Default: if value doesn't fall in any defined range, determine by extremes
    // If value is outside all ranges, it's likely critical
    return 'critical';
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

  private calculateTotalHoursLost(impacts: any[]): number {
    return impacts.reduce((total, impact) => {
      const durationMinutes = parseFloat(impact.durationMinutes) || 0;
      return total + (durationMinutes / 60);
    }, 0);
  }

  private groupImpactsByMonthWithHours(impacts: any[], start: Date, end: Date, timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y') {
    const monthlyData = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    console.log('[groupImpactsByMonthWithHours] Processing', impacts.length, 'impacts from', start, 'to', end);
    console.log('[groupImpactsByMonthWithHours] Month range:', current, 'to', endMonth);
    console.log('[groupImpactsByMonthWithHours] TimeRange:', timeRange);

    while (current <= endMonth) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);

      const monthImpacts = impacts.filter(i => {
        const impactDate = new Date(i.impactDate);
        return impactDate >= monthStart && impactDate <= monthEnd;
      });

      console.log('[groupImpactsByMonthWithHours]', monthStart.toISOString().slice(0, 7), ':', monthImpacts.length, 'impacts');

      // Calculate total hours lost for the month
      const monthTotalHours = monthImpacts.reduce((sum, i) => {
        const durationMinutes = parseFloat(i.durationMinutes) || 0;
        return sum + (durationMinutes / 60);
      }, 0);

      monthlyData.push({
        month: monthStart.toISOString().slice(0, 7),
        count: monthImpacts.length,
        totalHoursLost: Math.round(monthTotalHours * 10) / 10, // Round to 1 decimal place
        bySeverity: {
          critical: monthImpacts.filter(i => i.severity === 'critical').length,
          high: monthImpacts.filter(i => i.severity === 'high').length,
          medium: monthImpacts.filter(i => i.severity === 'medium').length,
          low: monthImpacts.filter(i => i.severity === 'low').length,
        },
      });

      current.setMonth(current.getMonth() + 1);
    }

    // Sort by month descending (newest first)
    monthlyData.sort((a, b) => b.month.localeCompare(a.month));

    // Limit the number of months based on timeRange
    // For 1m show 1 month, for 3m show 3 months, etc.
    let monthsToShow = monthlyData.length;
    if (timeRange === '1m') {
      monthsToShow = 1;
    } else if (timeRange === '3m') {
      monthsToShow = 3;
    } else if (timeRange === '6m') {
      monthsToShow = 6;
    } else if (timeRange === '1y') {
      monthsToShow = 12;
    }

    console.log('[groupImpactsByMonthWithHours] Limiting to', monthsToShow, 'months');
    return monthlyData.slice(0, monthsToShow);
  }

  private calculateStrategicAlignment(metrics: any[]) {
    // Map actual metric keys to strategic categories
    const categories = {
      incident_management: ['incident_resolution_time', 'mttr', 'incident_volume', 'critical_incidents_rate'],
      team_productivity: ['team_velocity', 'issue_throughput', 'cycle_time', 'issue_backlog_count', 'deployment_frequency'],
      communication: ['response_time', 'collaboration_index', 'team_engagement'],
      quality: ['defect_density', 'rework_rate', 'deployment_frequency'],
      engagement: ['team_engagement'],
    };

    // Category display titles (specific, actionable)
    const categoryTitles: Record<string, string> = {
      incident_management: 'Incident Response & Resolution',
      team_productivity: 'Delivery & Output Velocity',
      communication: 'Collaboration & Engagement',
      quality: 'Code Quality & Deployment Success',
      engagement: 'Team Morale & Participation',
    };

    // Category descriptions for user clarity
    const categoryDescriptions: Record<string, string> = {
      incident_management: 'How effectively your team handles and resolves incidents',
      team_productivity: 'Team output, velocity, and work completion rates',
      communication: 'Team collaboration and engagement levels',
      quality: 'Code quality and deployment success rates',
      engagement: 'Overall team morale and participation',
    };

    const categoryScores: Record<string, any> = {};
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

        const score = Math.round(categoryScore);

        // Determine overall status
        let status: 'excellent' | 'good' | 'warning' | 'critical';
        if (score >= 90) status = 'excellent';
        else if (score >= 70) status = 'good';
        else if (score >= 50) status = 'warning';
        else status = 'critical';

        // Build detailed metrics array
        const detailedMetrics = categoryMetrics.map(m => ({
          key: m.key,
          name: m.name,
          value: m.value,
          unit: m.unit || '',
          status: m.status,
          threshold: m.threshold,
        }));

        // Generate insight and recommendation based on status
        const { insight, recommendation } = this.generateCategoryInsight(category, detailedMetrics, status);

        categoryScores[category] = {
          score,
          status,
          trend: this.calculateCategoryTrend(categoryMetrics),
          title: categoryTitles[category],
          description: categoryDescriptions[category],
          metrics: detailedMetrics,
          insight,
          recommendation,
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

  /**
   * Generate actionable insights and recommendations for a category
   */
  private generateCategoryInsight(
    category: string,
    metrics: any[],
    status: 'excellent' | 'good' | 'warning' | 'critical',
  ): { insight: string; recommendation: string } {
    // Find the worst performing metric (critical or warning)
    const criticalMetric = metrics.find(m => m.status === 'critical');
    const warningMetric = metrics.find(m => m.status === 'warning');
    const problemMetric = criticalMetric || warningMetric;

    if (status === 'excellent') {
      return {
        insight: `All metrics in ${category.replace(/_/g, ' ')} are performing excellently. Keep up the good work!`,
        recommendation: 'Continue current practices and monitor for any changes in trends.',
      };
    }

    if (status === 'good') {
      const insights: string[] = [];
      if (problemMetric) {
        insights.push(`${problemMetric.name} (${problemMetric.value}${problemMetric.unit}) needs attention.`);
      } else {
        insights.push(`Performance is solid but has room for improvement.`);
      }

      return {
        insight: insights.join(' '),
        recommendation: problemMetric
          ? this.getMetricRecommendation(problemMetric.key, problemMetric.status)
          : 'Look for opportunities to optimize existing processes.',
      };
    }

    if (status === 'warning' && problemMetric) {
      return {
        insight: `${problemMetric.name} is ${problemMetric.status}. Current value: ${problemMetric.value}${problemMetric.unit}${problemMetric.threshold ? `, threshold: ${JSON.stringify(problemMetric.threshold)}` : ''}.`,
        recommendation: this.getMetricRecommendation(problemMetric.key, problemMetric.status),
      };
    }

    if (status === 'critical' && problemMetric) {
      return {
        insight: `CRITICAL: ${problemMetric.name} requires immediate attention. Current value: ${problemMetric.value}${problemMetric.unit}.`,
        recommendation: `Priority action needed: ${this.getMetricRecommendation(problemMetric.key, 'critical')}`,
      };
    }

    return {
      insight: `${category.replace(/_/g, ' ')} performance needs improvement.`,
      recommendation: 'Review all metrics in this category and identify areas for optimization.',
    };
  }

  /**
   * Get specific recommendations based on metric type
   */
  private getMetricRecommendation(metricKey: string, status: string): string {
    const recommendations: Record<string, Record<string, string>> = {
      incident_resolution_time: {
        warning: 'Consider implementing automated incident triage or improving runbook documentation.',
        critical: 'Set up on-call rotations and invest in incident management training. Review current escalation processes.',
      },
      critical_incidents_rate: {
        warning: 'Increase monitoring coverage and implement proactive alerting to catch issues earlier.',
        critical: 'Conduct root cause analysis for recurring incidents. Implement preventive measures and improve testing.',
      },
      team_engagement: {
        warning: 'Schedule team retrospectives and gather feedback on potential blockers or morale issues.',
        critical: 'Urgent: Address team burnout. Review workload distribution and consider process improvements.',
      },
      issue_backlog_count: {
        warning: 'Prioritize backlog grooming sessions. Consider increasing sprint capacity or reducing scope.',
        critical: 'Backlog is overwhelming. Implement aggressive prioritization and consider archiving stale issues.',
      },
      deployment_frequency: {
        warning: 'Identify deployment bottlenecks. Consider improving CI/CD pipeline efficiency.',
        critical: 'Deployment velocity is too low. Review release process and eliminate manual steps.',
      },
    };

    const metricRecs = recommendations[metricKey];
    if (metricRecs && metricRecs[status]) {
      return metricRecs[status];
    }

    // Generic fallback
    return status === 'critical'
      ? 'Immediate investigation and action required to bring this metric back to healthy levels.'
      : 'Monitor closely and implement process improvements to address this metric.';
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
      // Filter out randomly generated team names (Team_[8 alphanumeric chars])
      if (/^Team_[A-Z0-9]{8}$/.test(team)) {
        continue;
      }

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

  private async getRecentSignals(tenantId: number, endDate: Date): Promise<{
    jira: Array<{
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
    }>;
    servicenow: Array<{
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
    }>;
    slack: Array<{
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
    }>;
    teams: Array<{
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
    }>;
  }> {
    console.log('[getRecentSignals] Querying weak signals by category for tenant:', tenantId);

    // Query each category separately to ensure representation from all sources
    // This prevents one high-volume source from dominating the results
    const [engineeringSignals, operationsSignals, communicationSignals] = await Promise.all([
      // Engineering (Jira) signals
      this.weakSignalRepository.find({
        where: {
          tenantId,
          category: 'Engineering',
        },
        order: {
          detectedAt: 'DESC',
        },
        take: 15,
      }),
      // Operations (ServiceNow) signals
      this.weakSignalRepository.find({
        where: {
          tenantId,
          category: 'Operations',
        },
        order: {
          detectedAt: 'DESC',
        },
        take: 15,
      }),
      // Communication (Slack/Teams) signals
      this.weakSignalRepository.find({
        where: {
          tenantId,
          category: 'Communication',
        },
        order: {
          detectedAt: 'DESC',
        },
        take: 15,
      }),
    ]);

    console.log('[getRecentSignals] Found signals by category:', {
      engineering: engineeringSignals.length,
      operations: operationsSignals.length,
      communication: communicationSignals.length,
    });

    // Combine all signals
    const allSignals = [...engineeringSignals, ...operationsSignals, ...communicationSignals];

    // Map signals to common format
    const mappedSignals = allSignals.map(signal => ({
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
      source: this.extractSourceFromSignal(signal),
    }));

    // Group signals by source
    const jiraSignals = mappedSignals.filter(s => s.source === 'jira').slice(0, 15);
    const servicenowSignals = mappedSignals.filter(s => s.source === 'servicenow').slice(0, 15);
    const slackSignals = mappedSignals.filter(s => s.source === 'slack').slice(0, 15);
    const teamsSignals = mappedSignals.filter(s => s.source === 'teams').slice(0, 15);

    console.log('[getRecentSignals] Source extraction sample (first 3 from each category):');
    console.log('Engineering:', engineeringSignals.slice(0, 3).map(s => ({
      id: s.id,
      category: s.category,
      description: s.description.substring(0, 50),
    })));
    console.log('Operations:', operationsSignals.slice(0, 3).map(s => ({
      id: s.id,
      category: s.category,
      description: s.description.substring(0, 50),
    })));

    console.log('[getRecentSignals] Final grouped signals:', {
      jira: jiraSignals.length,
      servicenow: servicenowSignals.length,
      slack: slackSignals.length,
      teams: teamsSignals.length,
    });

    // Remove source property before returning
    const removeSource = (signals: any[]) => signals.map(({ source, ...rest }) => rest);

    return {
      jira: removeSource(jiraSignals),
      servicenow: removeSource(servicenowSignals),
      slack: removeSource(slackSignals),
      teams: removeSource(teamsSignals),
    };
  }

  private extractSourceFromSignal(signal: any): 'jira' | 'servicenow' | 'slack' | 'teams' {
    // Extract source from affectedEntities (which is an array of entity objects)
    if (signal.affectedEntities && Array.isArray(signal.affectedEntities)) {
      // Check each entity in the array for source identifiers
      for (const entity of signal.affectedEntities) {
        const entityId = (entity.id || '').toLowerCase();
        const entityName = (entity.name || '').toLowerCase();

        // Direct match on entity id (most reliable)
        if (entityId === 'jira' || entityId.includes('jira')) return 'jira';
        if (entityId === 'servicenow' || entityId.includes('servicenow')) return 'servicenow';
        if (entityId === 'slack' || entityId.includes('slack')) return 'slack';
        if (entityId === 'teams' || entityId.includes('teams')) return 'teams';

        // Match on entity name
        if (entityName.includes('jira')) return 'jira';
        if (entityName.includes('servicenow')) return 'servicenow';
        if (entityName.includes('slack')) return 'slack';
        if (entityName.includes('teams')) return 'teams';
      }
    }

    // Fallback: try to infer from category or description
    const category = (signal.category || '').toLowerCase();
    const description = (signal.description || '').toLowerCase();

    if (category.includes('jira') || description.includes('jira')) return 'jira';
    if (category.includes('servicenow') || category.includes('incident') || description.includes('incident')) return 'servicenow';
    if (category.includes('slack') || description.includes('slack')) return 'slack';
    if (category.includes('teams') || description.includes('teams')) return 'teams';

    // Check signal type - pattern_recurring is typically from ServiceNow
    if (signal.signalType === 'pattern_recurring' && description.includes('recurring incident pattern')) {
      return 'servicenow';
    }

    // trend_acceleration signals - check description for source
    if (signal.signalType === 'trend_acceleration') {
      if (description.includes('jira')) return 'jira';
      if (description.includes('slack')) return 'slack';
      if (description.includes('teams')) return 'teams';
      if (description.includes('servicenow') || description.includes('incident')) return 'servicenow';
    }

    // Default to servicenow for recurring patterns, jira for everything else
    return signal.signalType === 'pattern_recurring' ? 'servicenow' : 'jira';
  }

  private async getSignalDistributionByTheme(
    tenantId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    theme: string;
    incidentCount: number;
    signalCount: number;
    totalCount: number;
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
      totalCount: data.incidentCount + data.signalCount,
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

  /**
   * GET /api/v1/kpi/dashboard/team-impact
   * Get comprehensive team impact dashboard showing time saved and execution speed
   * Focuses on team productivity metrics rather than financial metrics
   */
  @Get('team-impact')
  async getTeamImpact(
    @CurrentTenant() tenantId: number,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('timeRange') timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
  ) {
    console.log(`[DashboardController] Getting team impact dashboard for tenant: ${tenantId}`);

    const { start, end } = this.calculateDateRange(periodStart, periodEnd, timeRange);
    console.log(`[DashboardController] Date range:`, { start, end, timeRange });

    const dashboard = await this.teamImpactService.getTeamImpactDashboard(tenantId, start, end);

    console.log(`[DashboardController] Team impact calculated for ${dashboard.teamBreakdown.length} teams`);
    console.log(`[DashboardController] Total time saved: ${dashboard.totalValue.timeSavedHours} hours`);

    return dashboard;
  }
}
