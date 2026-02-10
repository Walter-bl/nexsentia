import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { MetricValue } from '../../kpi/entities/metric-value.entity';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { GmailMessage } from '../../gmail/entities/gmail-message.entity';
import { OutlookMessage } from '../../outlook/entities/outlook-message.entity';
import { TimelineEvent } from '../../timeline/entities/timeline-event.entity';

export interface TrendAcceleration {
  accelerationId: string;
  metric: string;
  metricKey: string;
  description: string;
  baseline: number;
  current: number;
  changeRate: number; // percentage
  accelerationFactor: number; // how much faster it's changing
  timeWindow: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidenceScore: number;
  predictedEscalationTime: Date | null;
  evidence: {
    timestamp: Date;
    value: number;
    source: string;
  }[];
  riskIndicators: string[];
}

@Injectable()
export class TrendAccelerationService {
  private readonly logger = new Logger(TrendAccelerationService.name);

  constructor(
    @InjectRepository(MetricValue)
    private readonly metricValueRepository: Repository<MetricValue>,
    @InjectRepository(JiraIssue)
    private readonly jiraIssueRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowIncidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(SlackMessage)
    private readonly slackMessageRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsMessageRepository: Repository<TeamsMessage>,
    @InjectRepository(GmailMessage)
    private readonly gmailMessageRepository: Repository<GmailMessage>,
    @InjectRepository(OutlookMessage)
    private readonly outlookMessageRepository: Repository<OutlookMessage>,
    @InjectRepository(TimelineEvent)
    private readonly timelineEventRepository: Repository<TimelineEvent>,
  ) {}

  /**
   * Detect trend accelerations across different metrics
   */
  async detectTrendAccelerations(tenantId: number, daysBack: number = 30): Promise<TrendAcceleration[]> {
    this.logger.log(`Detecting trend accelerations for tenant ${tenantId} over last ${daysBack} days`);

    const accelerations: TrendAcceleration[] = [];

    // Analyze different types of metrics
    const [metricAccelerations, issueAccelerations, incidentAccelerations, communicationAccelerations, eventAccelerations] = await Promise.all([
      this.analyzeMetricTrends(tenantId, daysBack),
      this.analyzeIssueTrends(tenantId, daysBack),
      this.analyzeIncidentTrends(tenantId, daysBack),
      this.analyzeCommunicationTrends(tenantId, daysBack),
      this.analyzeEventTrends(tenantId, daysBack),
    ]);

    accelerations.push(...metricAccelerations, ...issueAccelerations, ...incidentAccelerations, ...communicationAccelerations, ...eventAccelerations);

    // Sort by severity and confidence
    accelerations.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidenceScore - a.confidenceScore;
    });

    this.logger.log(`Detected ${accelerations.length} trend accelerations`);

    return accelerations;
  }

  /**
   * Analyze KPI metric trends
   */
  private async analyzeMetricTrends(tenantId: number, daysBack: number): Promise<TrendAcceleration[]> {
    const accelerations: TrendAcceleration[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get all metric values
    const metricValues = await this.metricValueRepository.find({
      where: {
        tenantId,
        periodStart: MoreThan(startDate),
      },
      order: { periodStart: 'ASC' },
      relations: ['metricDefinition'],
    });

    // Group by metric key
    const metricGroups: Record<string, typeof metricValues> = {};
    for (const value of metricValues) {
      const key = value.metricDefinition?.metricKey || 'unknown';
      if (!metricGroups[key]) {
        metricGroups[key] = [];
      }
      metricGroups[key].push(value);
    }

    // Analyze each metric for acceleration
    for (const [metricKey, values] of Object.entries(metricGroups)) {
      if (values.length < 10) continue; // Need enough data points

      const acceleration = this.detectAccelerationInTimeSeries(
        values.map(v => ({ timestamp: v.periodStart, value: v.value })),
        metricKey,
        values[0].metricDefinition?.name || metricKey,
        'kpi'
      );

      if (acceleration) {
        accelerations.push(acceleration);
      }
    }

    return accelerations;
  }

  /**
   * Analyze Jira issue trends
   */
  private async analyzeIssueTrends(tenantId: number, daysBack: number): Promise<TrendAcceleration[]> {
    const accelerations: TrendAcceleration[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const issues = await this.jiraIssueRepository.find({
      where: {
        tenantId,
        jiraCreatedAt: MoreThan(startDate),
      },
      order: { jiraCreatedAt: 'ASC' },
    });

    // Calculate daily issue creation rate
    const dailyCounts = this.aggregateByDay(issues.map(i => i.jiraCreatedAt || i.createdAt));

    const acceleration = this.detectAccelerationInTimeSeries(dailyCounts, 'jira_issue_rate', 'Jira Issue Creation Rate', 'jira');

    if (acceleration) {
      accelerations.push(acceleration);
    }

    // Analyze critical issue rate
    const criticalIssues = issues.filter(i => {
      const priority = (i.priority || '').toLowerCase();
      return priority.includes('critical') || priority.includes('blocker');
    });

    if (criticalIssues.length > 5) {
      const criticalDailyCounts = this.aggregateByDay(criticalIssues.map(i => i.jiraCreatedAt || i.createdAt));
      const criticalAcceleration = this.detectAccelerationInTimeSeries(
        criticalDailyCounts,
        'jira_critical_rate',
        'Critical Jira Issues Rate',
        'jira'
      );

      if (criticalAcceleration) {
        accelerations.push(criticalAcceleration);
      }
    }

    return accelerations;
  }

  /**
   * Analyze ServiceNow incident trends
   */
  private async analyzeIncidentTrends(tenantId: number, daysBack: number): Promise<TrendAcceleration[]> {
    const accelerations: TrendAcceleration[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const incidents = await this.serviceNowIncidentRepository.find({
      where: {
        tenantId,
        sysCreatedOn: MoreThan(startDate),
      },
      order: { sysCreatedOn: 'ASC' },
    });

    // Calculate daily incident rate
    const dailyCounts = this.aggregateByDay(incidents.map(i => i.sysCreatedOn || i.createdAt));

    const acceleration = this.detectAccelerationInTimeSeries(
      dailyCounts,
      'servicenow_incident_rate',
      'ServiceNow Incident Rate',
      'servicenow'
    );

    if (acceleration) {
      accelerations.push(acceleration);
    }

    // Analyze P1 incident rate
    const p1Incidents = incidents.filter(i => i.priority === '1');

    if (p1Incidents.length > 3) {
      const p1DailyCounts = this.aggregateByDay(p1Incidents.map(i => i.sysCreatedOn || i.createdAt));
      const p1Acceleration = this.detectAccelerationInTimeSeries(
        p1DailyCounts,
        'servicenow_p1_rate',
        'P1 Incident Rate',
        'servicenow'
      );

      if (p1Acceleration) {
        accelerations.push(p1Acceleration);
      }
    }

    return accelerations;
  }

  /**
   * Analyze communication (Slack/Teams) trends
   */
  private async analyzeCommunicationTrends(tenantId: number, daysBack: number): Promise<TrendAcceleration[]> {
    const accelerations: TrendAcceleration[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [slackMessages, teamsMessages] = await Promise.all([
      this.slackMessageRepository.find({
        where: {
          tenantId,
          slackCreatedAt: MoreThan(startDate),
        },
        order: { slackCreatedAt: 'ASC' },
      }),
      this.teamsMessageRepository.find({
        where: {
          tenantId,
          createdDateTime: MoreThan(startDate),
        },
        order: { createdDateTime: 'ASC' },
      }),
    ]);

    this.logger.debug(`Communication data found: Slack=${slackMessages.length}, Teams=${teamsMessages.length} messages (${daysBack} days back from ${startDate.toISOString()})`);

    // Analyze Slack message rate
    if (slackMessages.length > 10) {
      const slackDailyCounts = this.aggregateByDay(slackMessages.map(m => m.slackCreatedAt || m.createdAt));
      const slackAcceleration = this.detectAccelerationInTimeSeries(
        slackDailyCounts,
        'slack_message_rate',
        'Slack Message Activity Rate',
        'slack'
      );

      if (slackAcceleration) {
        accelerations.push(slackAcceleration);
      }
    }

    // Analyze Teams message rate
    if (teamsMessages.length > 10) {
      const teamsDailyCounts = this.aggregateByDay(teamsMessages.map(m => m.createdDateTime || m.createdAt));
      const teamsAcceleration = this.detectAccelerationInTimeSeries(
        teamsDailyCounts,
        'teams_message_rate',
        'Teams Message Activity Rate',
        'teams'
      );

      if (teamsAcceleration) {
        accelerations.push(teamsAcceleration);
      }
    }

    // Analyze combined communication activity
    if (slackMessages.length + teamsMessages.length > 10) {
      const allMessages = [
        ...slackMessages.map(m => m.slackCreatedAt || m.createdAt),
        ...teamsMessages.map(m => m.createdDateTime || m.createdAt),
      ];
      const combinedDailyCounts = this.aggregateByDay(allMessages);
      const combinedAcceleration = this.detectAccelerationInTimeSeries(
        combinedDailyCounts,
        'communication_activity_rate',
        'Overall Communication Activity Rate',
        'slack' // Use slack as primary source for combined communication
      );

      if (combinedAcceleration) {
        accelerations.push(combinedAcceleration);
      }
    }

    return accelerations;
  }

  /**
   * Analyze timeline event trends
   */
  private async analyzeEventTrends(tenantId: number, daysBack: number): Promise<TrendAcceleration[]> {
    const accelerations: TrendAcceleration[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const events = await this.timelineEventRepository.find({
      where: {
        tenantId,
        eventDate: MoreThan(startDate),
        isActive: true,
      },
      order: { eventDate: 'ASC' },
    });

    // High impact events
    const highImpactEvents = events.filter(e => e.impactLevel === 'high');

    if (highImpactEvents.length > 3) {
      const dailyCounts = this.aggregateByDay(highImpactEvents.map(e => e.eventDate));
      const acceleration = this.detectAccelerationInTimeSeries(
        dailyCounts,
        'high_impact_event_rate',
        'High Impact Event Rate',
        'timeline'
      );

      if (acceleration) {
        accelerations.push(acceleration);
      }
    }

    return accelerations;
  }

  /**
   * Detect acceleration in a time series
   */
  private detectAccelerationInTimeSeries(
    timeSeries: { timestamp: Date; value: number }[],
    metricKey: string,
    metricName: string,
    source: string
  ): TrendAcceleration | null {
    if (timeSeries.length < 10) return null;

    // Sort timeSeries by timestamp to ensure chronological order
    const sortedTimeSeries = [...timeSeries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate baseline from OLDEST 33% of data (60-90 days ago range)
    const baselinePoints = Math.max(3, Math.floor(sortedTimeSeries.length * 0.33));
    const baselineData = sortedTimeSeries.slice(0, baselinePoints);
    const baseline = baselineData.length > 0
      ? baselineData.reduce((sum, point) => sum + (point.value || 0), 0) / baselineData.length
      : 0;

    // Calculate current from NEWEST 33% of data (0-30 days ago range)
    const recentPoints = Math.max(3, Math.floor(sortedTimeSeries.length * 0.33));
    const recentData = sortedTimeSeries.slice(-recentPoints);
    const current = recentData.length > 0
      ? recentData.reduce((sum, point) => sum + (point.value || 0), 0) / recentData.length
      : 0;

    // Calculate trends for baseline and recent periods
    const baselineTrend = this.calculateLinearTrend(baselineData);
    const recentTrend = this.calculateLinearTrend(recentData);

    // Calculate change rate
    const changeRate = baseline !== 0 ? ((current - baseline) / baseline) * 100 : 0;

    // Calculate acceleration factor (ratio of current rate to baseline rate)
    // If baseline is 5 events/day and current is 12 events/day, factor = 12/5 = 2.4x
    const accelerationFactor = baseline !== 0 && isFinite(baseline)
      ? Math.abs(current / baseline)
      : 1;

    // Only report if there's significant acceleration
    if (accelerationFactor < 1.5 || Math.abs(changeRate) < 15) {
      return null;
    }

    // Determine severity
    let severity: 'critical' | 'high' | 'medium' | 'low';
    if (accelerationFactor > 4 || Math.abs(changeRate) > 100) severity = 'critical';
    else if (accelerationFactor > 3 || Math.abs(changeRate) > 50) severity = 'high';
    else if (accelerationFactor > 2 || Math.abs(changeRate) > 30) severity = 'medium';
    else severity = 'low';

    // Calculate confidence
    const confidence = Math.min(95, 60 + Math.min(20, sortedTimeSeries.length / 2) + Math.min(15, accelerationFactor * 3));

    // Predict escalation time
    let predictedEscalationTime: Date | null = null;
    if (recentTrend.slope > 0 && current > 0) {
      // Estimate when metric will reach 2x current value
      const daysToDouble = (current / recentTrend.slope);
      if (daysToDouble > 0 && daysToDouble < 90) {
        predictedEscalationTime = new Date();
        predictedEscalationTime.setDate(predictedEscalationTime.getDate() + Math.floor(daysToDouble));
      }
    }

    // Build risk indicators
    const riskIndicators: string[] = [];
    if (accelerationFactor > 3) riskIndicators.push('Rapid acceleration detected');
    if (Math.abs(changeRate) > 50) riskIndicators.push('Significant deviation from baseline');
    if (recentTrend.r2 > 0.7) riskIndicators.push('Strong trending pattern');
    if (predictedEscalationTime) riskIndicators.push(`May escalate by ${predictedEscalationTime.toLocaleDateString()}`);

    const timeWindow = `${sortedTimeSeries[0].timestamp.toLocaleDateString()} to ${sortedTimeSeries[sortedTimeSeries.length - 1].timestamp.toLocaleDateString()}`;

    // Ensure all numeric values are safe
    const safeBaseline = isNaN(baseline) || !isFinite(baseline) ? 0 : baseline;
    const safeCurrent = isNaN(current) || !isFinite(current) ? 0 : current;
    const safeChangeRate = isNaN(changeRate) || !isFinite(changeRate) ? 0 : changeRate;
    const safeAccelerationFactor = isNaN(accelerationFactor) || !isFinite(accelerationFactor) ? 1 : accelerationFactor;
    const safeConfidence = isNaN(confidence) || !isFinite(confidence) ? 60 : confidence;

    return {
      accelerationId: `trend_accel_${metricKey}_${Date.now()}`,
      metric: metricName,
      metricKey,
      description: safeChangeRate > 0
        ? `${metricName} increasing ${safeAccelerationFactor.toFixed(1)}x faster than baseline (+${safeChangeRate.toFixed(1)}%)`
        : `${metricName} decreasing ${safeAccelerationFactor.toFixed(1)}x faster than baseline (${safeChangeRate.toFixed(1)}%)`,
      baseline: safeBaseline,
      current: safeCurrent,
      changeRate: safeChangeRate,
      accelerationFactor: safeAccelerationFactor,
      timeWindow,
      severity,
      confidenceScore: safeConfidence,
      predictedEscalationTime,
      evidence: sortedTimeSeries.map(point => ({
        timestamp: point.timestamp,
        value: isNaN(point.value) || !isFinite(point.value) ? 0 : point.value,
        source,
      })),
      riskIndicators,
    };
  }

  /**
   * Calculate linear trend (slope, intercept, R²)
   */
  private calculateLinearTrend(points: { timestamp: Date; value: number }[]): { slope: number; intercept: number; r2: number } {
    const n = points.length;
    const x = points.map((_, i) => i);
    const y = points.map(p => p.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = n !== 0 ? (sumY - slope * sumX) / n : 0;

    // Calculate R²
    const yMean = n !== 0 ? sumY / n : 0;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
    const r2 = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0;

    return {
      slope: isNaN(slope) || !isFinite(slope) ? 0 : slope,
      intercept: isNaN(intercept) || !isFinite(intercept) ? 0 : intercept,
      r2: isNaN(r2) || !isFinite(r2) ? 0 : r2
    };
  }

  /**
   * Aggregate events by day
   */
  private aggregateByDay(dates: Date[]): { timestamp: Date; value: number }[] {
    const dailyMap: Record<string, number> = {};

    for (const date of dates) {
      const dayKey = date.toISOString().split('T')[0];
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1;
    }

    return Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, count]) => ({
        timestamp: new Date(dateStr),
        value: count,
      }));
  }
}
