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
    );

    return {
      value,
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
        where.createdAt = Between(periodStart, periodEnd);
        if (filters) {
          Object.assign(where, filters);
        }
        return await this.jiraIssueRepository.find({ where });

      case 'slack':
        where.timestamp = Between(periodStart, periodEnd);
        return await this.slackMessageRepository.find({ where });

      case 'teams':
        where.createdDateTime = Between(periodStart, periodEnd);
        return await this.teamsMessageRepository.find({ where });

      case 'servicenow':
        where.sysCreatedOn = Between(periodStart, periodEnd);
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
  ): number {
    if (data.length === 0) return 0;

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
        return sum / data.length;

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
        timestamp: Between(context.periodStart, context.periodEnd),
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
      if (msg.userId) {
        userInteractions.add(msg.userId);
      }
    }

    for (const msg of teamsMessages) {
      if (msg.fromUserId) {
        userInteractions.add(msg.fromUserId);
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
        timestamp: Between(context.periodStart, context.periodEnd),
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
