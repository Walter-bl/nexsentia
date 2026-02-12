import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricDefinitionService } from './metric-definition.service';
import { MetricAggregationService } from './metric-aggregation.service';
import { BusinessImpactService } from './business-impact.service';
import { MetricDefinition } from '../entities/metric-definition.entity';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { WeakSignal } from '../../weak-signals/entities/weak-signal.entity';
import { Between } from 'typeorm';

/**
 * Service responsible for calculating organizational pulse dashboard data
 * Extracted from DashboardController to enable preloading and caching
 */
@Injectable()
export class OrganizationalPulseService {
  private readonly logger = new Logger(OrganizationalPulseService.name);

  constructor(
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
  ) {}

  /**
   * Calculate organizational pulse data for a tenant and time range
   * This is the main computation that can be preloaded and cached
   *
   * OPTIMIZED: Uses parallel processing for metrics and data fetching
   */
  async calculateOrganizationalPulse(
    tenantId: number,
    timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
    periodStart?: string,
    periodEnd?: string,
  ): Promise<any> {
    const startTime = Date.now();
    this.logger.log(`Calculating organizational pulse for tenant ${tenantId}, timeRange: ${timeRange}`);

    // Calculate date range
    const { start, end } = this.calculateDateRange(periodStart, periodEnd, timeRange);
    const previousPeriodStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
    this.logger.debug(`Date range: ${start.toISOString()} to ${end.toISOString()}`);

    // Get org health metrics
    const metrics = await this.definitionService.getMetrics(tenantId, 'org_health');
    this.logger.debug(`Found ${metrics.length} metrics to calculate`);

    // OPTIMIZATION 1: Calculate all metrics in parallel (both current and previous periods)
    const metricPromises = metrics.map(async (metric) => {
      // Run current and previous period calculations in parallel
      const [result, previousResult] = await Promise.all([
        this.aggregationService.calculateMetric(metric, {
          tenantId,
          periodStart: start,
          periodEnd: end,
          granularity: 'daily',
        }),
        this.aggregationService.calculateMetric(metric, {
          tenantId,
          periodStart: previousPeriodStart,
          periodEnd: start,
          granularity: 'daily',
        }),
      ]);

      if (result && result.value !== undefined) {
        const previousValue = previousResult?.value || result.value;
        const changePercent = previousValue ? ((result.value - previousValue) / previousValue) * 100 : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (Math.abs(changePercent) > 5) {
          trend = changePercent > 0 ? 'up' : 'down';
        }

        const status = this.determineStatus(result.value, metric.thresholds);

        return {
          key: metric.metricKey,
          name: metric.name,
          value: result.value,
          unit: metric.displayConfig?.unit,
          trend: trend,
          changePercent: parseFloat(changePercent.toFixed(2)),
          status,
          breakdown: result.breakdown,
        };
      }
      return null;
    });

    // OPTIMIZATION 2: Run metrics calculation and additional data fetching in parallel
    this.logger.log(`[OrganizationalPulse] Starting parallel data fetching...`);
    const parallelStartTime = Date.now();

    const [metricResults, impacts, recentSignals, signalDistribution] = await Promise.all([
      Promise.all(metricPromises).then(r => { this.logger.log(`[OrganizationalPulse] Metrics completed in ${Date.now() - parallelStartTime}ms`); return r; }),
      this.impactService.getImpacts(tenantId, start, end).then(r => { this.logger.log(`[OrganizationalPulse] Impacts completed in ${Date.now() - parallelStartTime}ms`); return r; }),
      this.getRecentSignals(tenantId, start, end).then(r => { this.logger.log(`[OrganizationalPulse] RecentSignals completed in ${Date.now() - parallelStartTime}ms`); return r; }),
      this.getSignalDistributionByTheme(tenantId, start, end).then(r => { this.logger.log(`[OrganizationalPulse] SignalDistribution completed in ${Date.now() - parallelStartTime}ms`); return r; }),
    ]);

    this.logger.log(`[OrganizationalPulse] All parallel fetching completed in ${Date.now() - parallelStartTime}ms`);

    // Filter out null results
    const metricData = metricResults.filter(m => m !== null);

    // Calculate derived data (these are fast, in-memory operations)
    const summary = this.calculateSummary(metricData);
    const totalHoursLost = this.calculateTotalHoursLost(impacts);
    const escalationsByMonth = this.groupImpactsByMonthWithHours(impacts, start, end, timeRange);
    const strategicAlignment = this.calculateStrategicAlignment(metricData);
    const teamSignals = this.getTeamSignals(metricData);

    const result = {
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
        totalHoursLost: Math.round(totalHoursLost * 10) / 10,
      },
      teamSignals: teamSignals,
      recentSignals: recentSignals,
      signalDistribution: signalDistribution,
      metrics: metricData,
      period: { start, end },
    };

    const duration = Date.now() - startTime;
    this.logger.log(`Organizational pulse calculated for tenant ${tenantId} in ${duration}ms: ${metricData.length} metrics, ${impacts.length} impacts`);

    return result;
  }

  private calculateDateRange(
    periodStart?: string,
    periodEnd?: string,
    timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
  ): { start: Date; end: Date } {
    const end = periodEnd ? new Date(periodEnd) : new Date();

    if (periodStart) {
      return { start: new Date(periodStart), end };
    }

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
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  private determineStatus(
    value: number,
    thresholds?: MetricDefinition['thresholds'],
  ): 'excellent' | 'good' | 'warning' | 'critical' {
    if (!thresholds) return 'good';

    const isInRange = (min?: number, max?: number): boolean => {
      const aboveMin = min === undefined || value >= min;
      const belowMax = max === undefined || value <= max;
      return aboveMin && belowMax;
    };

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

    while (current <= endMonth) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);

      const monthImpacts = impacts.filter(i => {
        const impactDate = new Date(i.impactDate);
        return impactDate >= monthStart && impactDate <= monthEnd;
      });

      const monthTotalHours = monthImpacts.reduce((sum, i) => {
        const durationMinutes = parseFloat(i.durationMinutes) || 0;
        return sum + (durationMinutes / 60);
      }, 0);

      monthlyData.push({
        month: monthStart.toISOString().slice(0, 7),
        count: monthImpacts.length,
        totalHoursLost: Math.round(monthTotalHours * 10) / 10,
        bySeverity: {
          critical: monthImpacts.filter(i => i.severity === 'critical').length,
          high: monthImpacts.filter(i => i.severity === 'high').length,
          medium: monthImpacts.filter(i => i.severity === 'medium').length,
          low: monthImpacts.filter(i => i.severity === 'low').length,
        },
      });

      current.setMonth(current.getMonth() + 1);
    }

    monthlyData.sort((a, b) => b.month.localeCompare(a.month));

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

    return monthlyData.slice(0, monthsToShow);
  }

  private calculateStrategicAlignment(metrics: any[]) {
    const categories = {
      incident_management: ['incident_resolution_time', 'mttr', 'incident_volume', 'critical_incidents_rate'],
      team_productivity: ['team_velocity', 'issue_throughput', 'cycle_time', 'issue_backlog_count', 'deployment_frequency'],
      communication: ['response_time', 'collaboration_index', 'team_engagement'],
      quality: ['defect_density', 'rework_rate', 'deployment_frequency'],
      engagement: ['team_engagement'],
    };

    const categoryTitles: Record<string, string> = {
      incident_management: 'Incident Response & Resolution',
      team_productivity: 'Delivery & Output Velocity',
      communication: 'Collaboration & Engagement',
      quality: 'Code Quality & Deployment Success',
      engagement: 'Team Morale & Participation',
    };

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

        let status: 'excellent' | 'good' | 'warning' | 'critical';
        if (score >= 90) status = 'excellent';
        else if (score >= 70) status = 'good';
        else if (score >= 50) status = 'warning';
        else status = 'critical';

        const detailedMetrics = categoryMetrics.map(m => ({
          key: m.key,
          name: m.name,
          value: m.value,
          unit: m.unit || '',
          status: m.status,
          threshold: m.threshold,
        }));

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

  private generateCategoryInsight(
    category: string,
    metrics: any[],
    status: 'excellent' | 'good' | 'warning' | 'critical',
  ): { insight: string; recommendation: string } {
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

    for (const metric of metrics) {
      if (metric.breakdown?.byTeam) {
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

    for (const [team, teamMetrics] of teamMap.entries()) {
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

  private async getRecentSignals(tenantId: number, startDate: Date, endDate: Date): Promise<any> {
    this.logger.debug(`Getting recent signals for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    const [engineeringSignals, operationsSignals, communicationSignals] = await Promise.all([
      this.weakSignalRepository.find({
        where: { tenantId, category: 'Engineering', detectedAt: Between(startDate, endDate) },
        order: { detectedAt: 'DESC' },
        take: 15,
      }),
      this.weakSignalRepository.find({
        where: { tenantId, category: 'Operations', detectedAt: Between(startDate, endDate) },
        order: { detectedAt: 'DESC' },
        take: 15,
      }),
      this.weakSignalRepository.find({
        where: { tenantId, category: 'Communication', detectedAt: Between(startDate, endDate) },
        order: { detectedAt: 'DESC' },
        take: 15,
      }),
    ]);

    const allSignals = [...engineeringSignals, ...operationsSignals, ...communicationSignals];

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

    const jiraSignals = mappedSignals.filter(s => s.source === 'jira').slice(0, 15);
    const servicenowSignals = mappedSignals.filter(s => s.source === 'servicenow').slice(0, 15);
    const slackSignals = mappedSignals.filter(s => s.source === 'slack').slice(0, 15);
    const teamsSignals = mappedSignals.filter(s => s.source === 'teams').slice(0, 15);
    const gmailSignals = mappedSignals.filter(s => s.source === 'gmail').slice(0, 15);
    const outlookSignals = mappedSignals.filter(s => s.source === 'outlook').slice(0, 15);

    const removeSource = (signals: any[]) => signals.map(({ source, ...rest }) => rest);

    return {
      jira: removeSource(jiraSignals),
      servicenow: removeSource(servicenowSignals),
      slack: removeSource(slackSignals),
      teams: removeSource(teamsSignals),
      gmail: removeSource(gmailSignals),
      outlook: removeSource(outlookSignals),
    };
  }

  private extractSourceFromSignal(signal: any): 'jira' | 'servicenow' | 'slack' | 'teams' | 'gmail' | 'outlook' {
    if (signal.sourceSignals && Array.isArray(signal.sourceSignals) && signal.sourceSignals.length > 0) {
      const source = signal.sourceSignals[0].source?.toLowerCase();
      if (source === 'jira') return 'jira';
      if (source === 'servicenow') return 'servicenow';
      if (source === 'slack') return 'slack';
      if (source === 'teams') return 'teams';
      if (source === 'gmail') return 'gmail';
      if (source === 'outlook') return 'outlook';
    }

    if (signal.patternData?.evidence && Array.isArray(signal.patternData.evidence) && signal.patternData.evidence.length > 0) {
      const source = signal.patternData.evidence[0].source?.toLowerCase();
      if (source === 'jira') return 'jira';
      if (source === 'servicenow') return 'servicenow';
      if (source === 'slack') return 'slack';
      if (source === 'teams') return 'teams';
      if (source === 'gmail') return 'gmail';
      if (source === 'outlook') return 'outlook';
    }

    if (signal.affectedEntities && Array.isArray(signal.affectedEntities)) {
      for (const entity of signal.affectedEntities) {
        const entityId = (entity.id || '').toLowerCase();
        const entityName = (entity.name || '').toLowerCase();

        if (entityId === 'jira' || entityId.includes('jira')) return 'jira';
        if (entityId === 'servicenow' || entityId.includes('servicenow')) return 'servicenow';
        if (entityId === 'slack' || entityId.includes('slack')) return 'slack';
        if (entityId === 'teams' || entityId.includes('teams')) return 'teams';
        if (entityId === 'gmail' || entityId.includes('gmail')) return 'gmail';
        if (entityId === 'outlook' || entityId.includes('outlook')) return 'outlook';

        if (entityName.includes('jira')) return 'jira';
        if (entityName.includes('servicenow')) return 'servicenow';
        if (entityName.includes('slack')) return 'slack';
        if (entityName.includes('teams')) return 'teams';
        if (entityName.includes('gmail')) return 'gmail';
        if (entityName.includes('outlook')) return 'outlook';
      }
    }

    const category = (signal.category || '').toLowerCase();
    const description = (signal.description || '').toLowerCase();

    if (category.includes('jira') || description.includes('jira')) return 'jira';
    if (category.includes('servicenow') || category.includes('incident') || description.includes('incident')) return 'servicenow';
    if (category.includes('slack') || description.includes('slack')) return 'slack';
    if (category.includes('teams') || description.includes('teams')) return 'teams';
    if (category.includes('gmail') || description.includes('gmail')) return 'gmail';
    if (category.includes('outlook') || description.includes('outlook')) return 'outlook';

    if (signal.signalType === 'pattern_recurring' && description.includes('recurring incident pattern')) {
      return 'servicenow';
    }

    if (signal.signalType === 'trend_acceleration') {
      if (description.includes('jira')) return 'jira';
      if (description.includes('slack')) return 'slack';
      if (description.includes('teams')) return 'teams';
      if (description.includes('gmail')) return 'gmail';
      if (description.includes('outlook')) return 'outlook';
      if (description.includes('servicenow') || description.includes('incident')) return 'servicenow';
    }

    return signal.signalType === 'pattern_recurring' ? 'servicenow' : 'jira';
  }

  /**
   * Get signal distribution by theme
   * OPTIMIZED: Runs all queries in parallel and uses select for lighter payloads
   */
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
    // Run ALL queries in parallel - counts and finds together
    const [
      slackMessages,
      teamsMessages,
      incidents,
      issues,
    ] = await Promise.all([
      this.slackMessageRepository.count({
        where: { tenantId, slackCreatedAt: Between(startDate, endDate) },
      }),
      this.teamsMessageRepository.count({
        where: { tenantId, createdDateTime: Between(startDate, endDate) },
      }),
      this.serviceNowIncidentRepository.find({
        where: { tenantId, openedAt: Between(startDate, endDate) },
        select: ['category'],
      }),
      this.jiraIssueRepository.find({
        where: { tenantId, jiraCreatedAt: Between(startDate, endDate) },
        select: ['issueType'],
      }),
    ]);

    // Pre-calculate filtered counts once (avoid repeated filter operations)
    const infraIncidents = incidents.filter(i =>
      i.category === 'Infrastructure' || i.category === 'Network'
    ).length;
    const appIncidents = incidents.filter(i => i.category === 'Application').length;
    const bugIssues = issues.filter(i => i.issueType === 'bug' || i.issueType === 'incident').length;
    const taskIssues = issues.filter(i => i.issueType === 'task').length;
    const storyIssues = issues.filter(i => i.issueType === 'task' || i.issueType === 'story').length;

    const themes = {
      Communication: {
        incidentCount: 0,
        signalCount: slackMessages + teamsMessages,
        color: '#10b981',
      },
      System: {
        incidentCount: infraIncidents,
        signalCount: infraIncidents,
        color: '#06b6d4',
      },
      Product: {
        incidentCount: bugIssues,
        signalCount: bugIssues,
        color: '#8b5cf6',
      },
      Checkout: {
        incidentCount: Math.floor(appIncidents / 2),
        signalCount: appIncidents,
        color: '#22c55e',
      },
      Stock: {
        incidentCount: taskIssues,
        signalCount: storyIssues,
        color: '#f59e0b',
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
}
