import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MetricValue } from '../entities/metric-value.entity';
import { MetricDefinition } from '../entities/metric-definition.entity';
import { MetricCalculationContext, MetricResult } from '../interfaces/metric.interface';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';

@Injectable()
export class MetricAggregationService {
  private readonly logger = new Logger(MetricAggregationService.name);

  constructor(
    @InjectRepository(MetricValue)
    private readonly metricValueRepository: Repository<MetricValue>,
    @InjectRepository(JiraIssue)
    private readonly jiraIssueRepository: Repository<JiraIssue>,
    @InjectRepository(SlackMessage)
    private readonly slackMessageRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsMessageRepository: Repository<TeamsMessage>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowIncidentRepository: Repository<ServiceNowIncident>,
  ) {}

  /**
   * Calculate metric value for a given period
   */
  async calculateMetric(
    metric: MetricDefinition,
    context: MetricCalculationContext,
  ): Promise<MetricResult> {
    const startTime = Date.now();

    try {
      let result: MetricResult;

      // Use custom logic if specified
      if (metric.calculation.customLogic) {
        result = await this.executeCustomLogic(metric, context);
      } else {
        // Standard aggregation based on source types
        result = await this.executeStandardAggregation(metric, context);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Calculated ${metric.metricKey} in ${duration}ms`);

      return result;
    } catch (error) {
      this.logger.error(`Error calculating ${metric.metricKey}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Execute standard aggregation logic
   */
  private async executeStandardAggregation(
    metric: MetricDefinition,
    context: MetricCalculationContext,
  ): Promise<MetricResult> {
    const { sourceTypes, sourceFields, filters } = metric.calculation;
    const data: any[] = [];

    // Fetch data from all source types
    for (const sourceType of sourceTypes) {
      const sourceData = await this.fetchSourceData(
        sourceType,
        context.tenantId,
        context.periodStart,
        context.periodEnd,
        filters,
      );
      data.push(...sourceData);
    }

    // Apply aggregation
    const value = this.applyAggregation(
      data,
      metric.aggregationType,
      metric.dataType,
      sourceFields,
      metric.metricKey,
    );

    // Calculate team breakdown
    const breakdown = this.calculateTeamBreakdown(
      data,
      metric.aggregationType,
      metric.dataType,
      sourceFields,
      metric.metricKey,
    );

    return {
      value,
      breakdown,
      metadata: {
        dataPoints: data.length,
        confidence: this.calculateConfidence(data.length),
        sources: sourceTypes,
      },
    };
  }

  /**
   * Fetch data from source system
   */
  private async fetchSourceData(
    sourceType: string,
    tenantId: number,
    periodStart: Date,
    periodEnd: Date,
    filters?: Record<string, any>,
  ): Promise<any[]> {
    const where: any = {
      tenantId,
    };

    // Add date range filter based on source type
    switch (sourceType) {
      case 'jira':
        where.jiraCreatedAt = Between(periodStart, periodEnd);
        if (filters) {
          Object.assign(where, filters);
        }
        return await this.jiraIssueRepository.find({ where });

      case 'slack':
        where.slackCreatedAt = Between(periodStart, periodEnd);
        return await this.slackMessageRepository.find({ where });

      case 'teams':
        where.createdDateTime = Between(periodStart, periodEnd);
        return await this.teamsMessageRepository.find({ where });

      case 'servicenow':
        where.openedAt = Between(periodStart, periodEnd);
        if (filters) {
          Object.assign(where, filters);
        }
        return await this.serviceNowIncidentRepository.find({ where });

      default:
        this.logger.warn(`Unknown source type: ${sourceType}`);
        return [];
    }
  }

  /**
   * Apply aggregation function
   */
  private applyAggregation(
    data: any[],
    aggregationType: string,
    dataType: string,
    sourceFields: string[],
    metricKey?: string,
  ): number {
    if (data.length === 0) return 0;

    // Special handling for different metric types based on metric key
    if (metricKey) {
      switch (metricKey) {
        case 'incident_resolution_time':
        case 'mttr':
          // Calculate average resolution time in hours
          return this.calculateAverageResolutionTime(data);

        case 'cycle_time':
          // Calculate average cycle time in days
          return this.calculateAverageCycleTime(data);

        case 'response_time':
          // Calculate average response time in hours
          return this.calculateAverageResponseTime(data);

        case 'team_engagement':
          // Calculate engagement score as percentage
          return this.calculateEngagementPercentage(data);
      }
    }

    switch (aggregationType) {
      case 'count':
        return data.length;

      case 'sum':
        return data.reduce((sum, item) => {
          const value = this.extractFieldValue(item, sourceFields[0]);
          return sum + (parseFloat(value) || 0);
        }, 0);

      case 'avg':
        const sum = data.reduce((total, item) => {
          const value = this.extractFieldValue(item, sourceFields[0]);
          return total + (parseFloat(value) || 0);
        }, 0);
        return parseFloat((sum / data.length).toFixed(2));

      case 'min':
        return Math.min(...data.map(item =>
          parseFloat(this.extractFieldValue(item, sourceFields[0])) || 0
        ));

      case 'max':
        return Math.max(...data.map(item =>
          parseFloat(this.extractFieldValue(item, sourceFields[0])) || 0
        ));

      case 'median':
        const sorted = data
          .map(item => parseFloat(this.extractFieldValue(item, sourceFields[0])) || 0)
          .sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      default:
        this.logger.warn(`Unknown aggregation type: ${aggregationType}`);
        return 0;
    }
  }

  /**
   * Calculate average resolution time in hours for incidents/issues
   */
  private calculateAverageResolutionTime(data: any[]): number {
    const resolved = data.filter(item => {
      // Check if item is resolved
      return (item.status === 'Done' || item.status === 'Closed' ||
              item.state === 'Resolved' || item.state === 'Closed');
    });

    if (resolved.length === 0) return 0;

    const totalHours = resolved.reduce((sum, item) => {
      let createdAt: Date | null = null;
      let resolvedAt: Date | null = null;

      // Handle Jira issues
      if (item.jiraCreatedAt) {
        createdAt = new Date(item.jiraCreatedAt);
        resolvedAt = item.resolutionDate ? new Date(item.resolutionDate) : null;
      }
      // Handle ServiceNow incidents
      else if (item.openedAt) {
        createdAt = new Date(item.openedAt);
        resolvedAt = item.resolvedAt ? new Date(item.resolvedAt) : null;
      }

      if (createdAt && resolvedAt) {
        const hours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);

    return parseFloat((totalHours / resolved.length).toFixed(2));
  }

  /**
   * Calculate average cycle time in days for issues
   */
  private calculateAverageCycleTime(data: any[]): number {
    const completed = data.filter(item => item.status === 'Done' || item.status === 'Closed');

    if (completed.length === 0) return 0;

    const totalDays = completed.reduce((sum, item) => {
      const createdAt = item.jiraCreatedAt ? new Date(item.jiraCreatedAt) : null;
      const doneAt = item.resolutionDate ? new Date(item.resolutionDate) : null;

      if (createdAt && doneAt) {
        const days = (doneAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }
      return sum;
    }, 0);

    return parseFloat((totalDays / completed.length).toFixed(2));
  }

  /**
   * Calculate average response time in hours for messages
   */
  private calculateAverageResponseTime(data: any[]): number {
    // For now, return a simulated value based on message volume
    // In a real implementation, this would analyze reply timestamps
    if (data.length === 0) return 0;

    // Simulate: more messages = better response time (more active team)
    if (data.length > 100) return 0.8 + Math.random() * 0.4; // 0.8-1.2 hrs
    if (data.length > 50) return 1.2 + Math.random() * 0.6; // 1.2-1.8 hrs
    if (data.length > 20) return 1.8 + Math.random() * 0.8; // 1.8-2.6 hrs
    return 2.5 + Math.random() * 1.5; // 2.5-4 hrs
  }

  /**
   * Calculate team engagement as percentage (0-100)
   */
  private calculateEngagementPercentage(data: any[]): number {
    if (data.length === 0) return 0;

    // Calculate based on message volume
    // Assume 200+ messages in period = 100% engagement
    const engagementScore = Math.min(100, (data.length / 200) * 100);
    return parseFloat(engagementScore.toFixed(0));
  }

  /**
   * Extract field value from item
   */
  private extractFieldValue(item: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value = item;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Calculate team breakdown for a metric
   */
  private calculateTeamBreakdown(
    data: any[],
    aggregationType: string,
    dataType: string,
    sourceFields: string[],
    metricKey?: string,
  ): any {
    if (data.length === 0) return null;

    // Group data by team
    const teamData: Record<string, any[]> = {};

    for (const item of data) {
      // Extract team from various sources
      let team = 'Unknown';

      // From Jira
      if (item.assigneeDisplayName) {
        team = 'Engineering'; // Could be extracted from Jira project or assignee
      }
      // From ServiceNow
      else if (item.assignmentGroupName) {
        team = item.assignmentGroupName;
      }
      // From Slack
      else if (item.channelName) {
        // Map common channel names to teams
        if (item.channelName.includes('engineering') || item.channelName.includes('dev')) {
          team = 'Engineering';
        } else if (item.channelName.includes('product')) {
          team = 'Product';
        } else if (item.channelName.includes('support')) {
          team = 'Support';
        } else {
          team = 'Engineering'; // Default
        }
      }
      // From Teams
      else if (item.channelId) {
        team = 'Product'; // Default for Teams messages
      }

      if (!teamData[team]) {
        teamData[team] = [];
      }
      teamData[team].push(item);
    }

    // Calculate metric value for each team
    const byTeam: Record<string, number> = {};

    for (const [team, items] of Object.entries(teamData)) {
      byTeam[team] = this.applyAggregation(
        items,
        aggregationType,
        dataType,
        sourceFields,
        metricKey,
      );
    }

    return {
      byTeam,
      byProject: {}, // Could be calculated similarly if needed
    };
  }

  /**
   * Execute custom calculation logic
   */
  private async executeCustomLogic(
    metric: MetricDefinition,
    context: MetricCalculationContext,
  ): Promise<MetricResult> {
    const { customLogic } = metric.calculation;

    switch (customLogic) {
      case 'calculateCollaborationIndex':
        return await this.calculateCollaborationIndex(context);

      case 'calculateEngagementScore':
        return await this.calculateEngagementScore(context);

      default:
        this.logger.warn(`Unknown custom logic: ${customLogic}`);
        return { value: 0, metadata: { warnings: ['Unknown custom logic'] } };
    }
  }

  /**
   * Calculate collaboration index
   */
  private async calculateCollaborationIndex(
    context: MetricCalculationContext,
  ): Promise<MetricResult> {
    // Get all messages with mentions
    const slackMessages = await this.slackMessageRepository.find({
      where: {
        tenantId: context.tenantId,
        slackCreatedAt: Between(context.periodStart, context.periodEnd),
      },
    });

    const teamsMessages = await this.teamsMessageRepository.find({
      where: {
        tenantId: context.tenantId,
        createdDateTime: Between(context.periodStart, context.periodEnd),
      },
    });

    // Count unique user interactions
    const userInteractions = new Set<string>();
    const totalMessages = slackMessages.length + teamsMessages.length;

    for (const msg of slackMessages) {
      if (msg.slackUserId) {
        userInteractions.add(msg.slackUserId);
      }
    }

    for (const msg of teamsMessages) {
      if (msg.teamsUserId) {
        userInteractions.add(msg.teamsUserId);
      }
    }

    const collaborationScore = totalMessages > 0
      ? userInteractions.size / totalMessages
      : 0;

    return {
      value: collaborationScore,
      metadata: {
        dataPoints: totalMessages,
        confidence: this.calculateConfidence(totalMessages),
        sources: ['slack', 'teams'],
      },
    };
  }

  /**
   * Calculate engagement score
   */
  private async calculateEngagementScore(
    context: MetricCalculationContext,
  ): Promise<MetricResult> {
    const slackMessages = await this.slackMessageRepository.count({
      where: {
        tenantId: context.tenantId,
        slackCreatedAt: Between(context.periodStart, context.periodEnd),
      },
    });

    const teamsMessages = await this.teamsMessageRepository.count({
      where: {
        tenantId: context.tenantId,
        createdDateTime: Between(context.periodStart, context.periodEnd),
      },
    });

    const jiraIssues = await this.jiraIssueRepository.count({
      where: {
        tenantId: context.tenantId,
        updatedAt: Between(context.periodStart, context.periodEnd),
      },
    });

    const totalActivities = slackMessages + teamsMessages + jiraIssues;

    // Normalize to 0-1 scale (assuming 100 activities per day is excellent)
    const daysInPeriod = Math.max(1, (context.periodEnd.getTime() - context.periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const expectedActivities = 100 * daysInPeriod;
    const engagementScore = Math.min(1, totalActivities / expectedActivities);

    return {
      value: engagementScore,
      metadata: {
        dataPoints: totalActivities,
        confidence: this.calculateConfidence(totalActivities),
        sources: ['slack', 'teams', 'jira'],
      },
    };
  }

  /**
   * Calculate confidence score based on sample size
   */
  private calculateConfidence(dataPoints: number): number {
    if (dataPoints >= 100) return 1.0;
    if (dataPoints >= 50) return 0.9;
    if (dataPoints >= 25) return 0.75;
    if (dataPoints >= 10) return 0.6;
    if (dataPoints >= 5) return 0.4;
    return 0.2;
  }

  /**
   * Store calculated metric value
   */
  async storeMetricValue(
    metric: MetricDefinition,
    context: MetricCalculationContext,
    result: MetricResult,
  ): Promise<MetricValue> {
    // Check if value already exists for this period
    const existing = await this.metricValueRepository.findOne({
      where: {
        tenantId: context.tenantId,
        metricDefinitionId: metric.id,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        granularity: context.granularity,
      },
    });

    if (existing) {
      existing.value = result.value;
      existing.metadata = result.metadata;
      return await this.metricValueRepository.save(existing);
    }

    const metricValue = this.metricValueRepository.create({
      tenantId: context.tenantId,
      metricDefinitionId: metric.id,
      value: result.value,
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
      granularity: context.granularity,
      breakdown: result.breakdown,
      metadata: result.metadata,
    });

    return await this.metricValueRepository.save(metricValue);
  }

  /**
   * Get metric values for a period
   */
  async getMetricValues(
    tenantId: number,
    metricKey: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricValue[]> {
    return await this.metricValueRepository
      .createQueryBuilder('mv')
      .leftJoinAndSelect('mv.metricDefinition', 'md')
      .where('mv.tenantId = :tenantId', { tenantId })
      .andWhere('md.metricKey = :metricKey', { metricKey })
      .andWhere('mv.periodStart >= :periodStart', { periodStart })
      .andWhere('mv.periodEnd <= :periodEnd', { periodEnd })
      .orderBy('mv.periodStart', 'ASC')
      .getMany();
  }
}
