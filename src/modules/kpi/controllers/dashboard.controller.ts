import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
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
    // Calculate date range based on timeRange parameter or custom dates
    const { start, end } = this.calculateDateRange(periodStart, periodEnd, timeRange);

    // Get org health metrics
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
          breakdown: latestValue.breakdown,
        });
      }
    }

    // Calculate overall health score
    const summary = this.calculateSummary(metricData);

    // Get business impacts for escalations chart
    const impacts = await this.impactService.getImpacts(tenantId, start, end);
    const totalLoss = await this.impactService.getTotalRevenueLoss(tenantId, start, end);

    // Group impacts by month for business escalations chart
    const escalationsByMonth = this.groupImpactsByMonth(impacts, start, end);

    // Calculate strategic alignment metrics
    const strategicAlignment = this.calculateStrategicAlignment(metricData);

    // Get team signals breakdown
    const teamSignals = this.getTeamSignals(metricData);

    // Get recent signals (timeline events)
    const recentSignals = await this.getRecentSignals(tenantId, end);

    // Get signal distribution by theme
    const signalDistribution = await this.getSignalDistributionByTheme(tenantId, start, end);

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
        // Default to last 30 days (1 month)
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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

  private getTeamSignals(metrics: any[]): Array<{
    team: string;
    metrics: Array<{
      key: string;
      name: string;
      value: unknown;
      status: 'excellent' | 'good' | 'warning' | 'critical';
    }>;
    overallScore: number;
  }> {
    const signals: Array<{
      team: string;
      metrics: Array<{
        key: string;
        name: string;
        value: unknown;
        status: 'excellent' | 'good' | 'warning' | 'critical';
      }>;
      overallScore: number;
    }> = [];

    for (const metric of metrics) {
      if (metric.breakdown?.byTeam) {
        for (const [team, value] of Object.entries(metric.breakdown.byTeam)) {
          const existingSignal = signals.find(s => s.team === team);

          if (existingSignal) {
            existingSignal.metrics.push({
              key: metric.key,
              name: metric.name,
              value: value,
              status: this.determineStatus(value as number, undefined),
            });
          } else {
            signals.push({
              team: team,
              metrics: [{
                key: metric.key,
                name: metric.name,
                value: value,
                status: this.determineStatus(value as number, undefined),
              }],
              overallScore: 0,
            });
          }
        }
      }
    }

    // Calculate overall team score
    for (const signal of signals) {
      const statusScores = signal.metrics.map(m => {
        const status = m.status;
        return status === 'excellent' ? 100 : status === 'good' ? 75 : status === 'warning' ? 50 : 25;
      });

      signal.overallScore = statusScores.length > 0
        ? Math.round(statusScores.reduce((a, b) => a + b, 0) / statusScores.length)
        : 0;
    }

    return signals;
  }

  private async getRecentSignals(tenantId: number, endDate: Date): Promise<Array<{
    id: string;
    type: 'incident' | 'communication' | 'task';
    title: string;
    description: string;
    source: 'jira' | 'servicenow' | 'slack' | 'teams';
    severity?: 'critical' | 'high' | 'medium' | 'low';
    timestamp: Date;
    team?: string;
  }>> {
    const signals: Array<any> = [];

    // Get recent Jira issues (last 10)
    const jiraIssues = await this.jiraIssueRepository.find({
      where: {
        tenantId,
      },
      order: {
        jiraCreatedAt: 'DESC',
      },
      take: 5,
    });

    for (const issue of jiraIssues) {
      signals.push({
        id: `jira_${issue.id}`,
        type: issue.issueType === 'incident' ? 'incident' : 'task',
        title: issue.summary,
        description: issue.description || '',
        source: 'jira',
        severity: this.mapJiraPriorityToSeverity(issue.priority),
        timestamp: issue.jiraCreatedAt,
        team: 'Engineering',
      });
    }

    // Get recent ServiceNow incidents (last 10)
    const incidents = await this.serviceNowIncidentRepository.find({
      where: {
        tenantId,
      },
      order: {
        openedAt: 'DESC',
      },
      take: 5,
    });

    for (const incident of incidents) {
      signals.push({
        id: `servicenow_${incident.id}`,
        type: 'incident',
        title: incident.shortDescription,
        description: incident.description || '',
        source: 'servicenow',
        severity: this.mapServiceNowPriorityToSeverity(incident.priority),
        timestamp: incident.openedAt,
        team: incident.assignmentGroupName || 'Support',
      });
    }

    // Get recent Slack messages (last 5 with high engagement)
    const slackMessages = await this.slackMessageRepository.find({
      where: {
        tenantId,
      },
      order: {
        slackCreatedAt: 'DESC',
      },
      take: 3,
    });

    for (const message of slackMessages) {
      signals.push({
        id: `slack_${message.id}`,
        type: 'communication',
        title: this.truncateText(message.text, 80),
        description: message.text,
        source: 'slack',
        timestamp: message.slackCreatedAt,
        team: 'Engineering',
      });
    }

    // Get recent Teams messages (last 5)
    const teamsMessages = await this.teamsMessageRepository.find({
      where: {
        tenantId,
      },
      order: {
        createdDateTime: 'DESC',
      },
      take: 2,
    });

    for (const message of teamsMessages) {
      signals.push({
        id: `teams_${message.id}`,
        type: 'communication',
        title: this.truncateText(message.content || '', 80),
        description: message.content || '',
        source: 'teams',
        timestamp: message.createdDateTime,
        team: 'Product',
      });
    }

    // Sort all signals by timestamp (most recent first) and return top 15
    return signals
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 15);
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
}
