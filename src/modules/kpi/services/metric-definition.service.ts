import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricDefinition } from '../entities/metric-definition.entity';

@Injectable()
export class MetricDefinitionService {
  private readonly logger = new Logger(MetricDefinitionService.name);

  constructor(
    @InjectRepository(MetricDefinition)
    private readonly metricRepository: Repository<MetricDefinition>,
  ) {}

  /**
   * Initialize default org health KPI definitions
   */
  async initializeDefaultMetrics(tenantId: number): Promise<void> {
    const defaultMetrics = this.getDefaultOrgHealthMetrics(tenantId);

    for (const metric of defaultMetrics) {
      const existing = await this.metricRepository.findOne({
        where: {
          tenantId,
          metricKey: metric.metricKey,
        },
      });

      if (!existing) {
        await this.metricRepository.save(metric);
        this.logger.log(`Initialized metric: ${metric.metricKey} for tenant ${tenantId}`);
      }
    }
  }

  /**
   * Get predefined org health metrics
   */
  private getDefaultOrgHealthMetrics(tenantId: number): Partial<MetricDefinition>[] {
    return [
      // === Incident Management Metrics ===
      {
        tenantId,
        metricKey: 'incident_resolution_time',
        name: 'Average Incident Resolution Time',
        description: 'Average time to resolve incidents from creation to closure',
        category: 'org_health',
        dataType: 'duration',
        aggregationType: 'avg',
        calculation: {
          formula: 'AVG(resolvedDate - createdDate)',
          sourceFields: ['sysCreatedOn', 'resolvedDate', 'state'],
          sourceTypes: ['servicenow'],
          filters: { state: 'Resolved' },
        },
        thresholds: {
          excellent: { max: 240 }, // < 4 hours
          good: { max: 480 }, // < 8 hours
          warning: { max: 1440 }, // < 24 hours
          critical: { min: 1440 }, // > 24 hours
        },
        displayConfig: {
          unit: 'minutes',
          decimalPlaces: 0,
          chartType: 'line',
        },
        isActive: true,
        isCustom: false,
      },
      {
        tenantId,
        metricKey: 'incident_volume',
        name: 'Incident Volume',
        description: 'Total number of incidents created in period',
        category: 'org_health',
        dataType: 'count',
        aggregationType: 'count',
        calculation: {
          sourceFields: ['sysId'],
          sourceTypes: ['servicenow'],
        },
        thresholds: {
          excellent: { max: 10 },
          good: { max: 25 },
          warning: { max: 50 },
          critical: { min: 50 },
        },
        displayConfig: {
          unit: 'incidents',
          decimalPlaces: 0,
          chartType: 'bar',
        },
        isActive: true,
        isCustom: false,
      },
      {
        tenantId,
        metricKey: 'mttr',
        name: 'Mean Time To Repair (MTTR)',
        description: 'Average time to repair/resolve critical incidents',
        category: 'org_health',
        dataType: 'duration',
        aggregationType: 'avg',
        calculation: {
          formula: 'AVG(resolvedDate - createdDate)',
          sourceFields: ['sysCreatedOn', 'resolvedDate', 'priority'],
          sourceTypes: ['servicenow'],
          filters: { priority: ['1 - Critical', '2 - High'] },
        },
        thresholds: {
          excellent: { max: 60 }, // < 1 hour
          good: { max: 120 }, // < 2 hours
          warning: { max: 240 }, // < 4 hours
          critical: { min: 240 }, // > 4 hours
        },
        displayConfig: {
          unit: 'minutes',
          decimalPlaces: 0,
          chartType: 'gauge',
        },
        isActive: true,
        isCustom: false,
      },

      // === Team Productivity Metrics ===
      {
        tenantId,
        metricKey: 'team_velocity',
        name: 'Team Velocity',
        description: 'Number of story points completed per sprint',
        category: 'org_health',
        dataType: 'number',
        aggregationType: 'sum',
        calculation: {
          formula: 'SUM(storyPoints WHERE status = Done)',
          sourceFields: ['storyPoints', 'status'],
          sourceTypes: ['jira'],
          filters: { status: 'Done' },
        },
        thresholds: {
          excellent: { min: 40 },
          good: { min: 30 },
          warning: { min: 20 },
          critical: { max: 20 },
        },
        displayConfig: {
          unit: 'points',
          decimalPlaces: 0,
          chartType: 'line',
        },
        isActive: true,
        isCustom: false,
      },
      {
        tenantId,
        metricKey: 'issue_throughput',
        name: 'Issue Throughput',
        description: 'Number of issues completed in period',
        category: 'org_health',
        dataType: 'count',
        aggregationType: 'count',
        calculation: {
          sourceFields: ['status', 'resolutionDate'],
          sourceTypes: ['jira'],
          filters: { status: ['Done', 'Closed', 'Resolved'] },
        },
        thresholds: {
          excellent: { min: 50 },
          good: { min: 30 },
          warning: { min: 15 },
          critical: { max: 15 },
        },
        displayConfig: {
          unit: 'issues',
          decimalPlaces: 0,
          chartType: 'bar',
        },
        isActive: true,
        isCustom: false,
      },
      {
        tenantId,
        metricKey: 'cycle_time',
        name: 'Cycle Time',
        description: 'Average time from work started to completed',
        category: 'org_health',
        dataType: 'duration',
        aggregationType: 'avg',
        calculation: {
          formula: 'AVG(resolutionDate - inProgressDate)',
          sourceFields: ['inProgressDate', 'resolutionDate'],
          sourceTypes: ['jira'],
        },
        thresholds: {
          excellent: { max: 3 }, // < 3 days
          good: { max: 5 }, // < 5 days
          warning: { max: 10 }, // < 10 days
          critical: { min: 10 }, // > 10 days
        },
        displayConfig: {
          unit: 'days',
          decimalPlaces: 1,
          chartType: 'line',
        },
        isActive: true,
        isCustom: false,
      },

      // === Communication & Collaboration Metrics ===
      {
        tenantId,
        metricKey: 'response_time',
        name: 'Average Response Time',
        description: 'Average time to first response in channels',
        category: 'org_health',
        dataType: 'duration',
        aggregationType: 'avg',
        calculation: {
          formula: 'AVG(firstReplyTimestamp - messageTimestamp)',
          sourceFields: ['timestamp', 'threadTimestamp'],
          sourceTypes: ['slack', 'teams'],
        },
        thresholds: {
          excellent: { max: 30 }, // < 30 minutes
          good: { max: 60 }, // < 1 hour
          warning: { max: 240 }, // < 4 hours
          critical: { min: 240 }, // > 4 hours
        },
        displayConfig: {
          unit: 'minutes',
          decimalPlaces: 0,
          chartType: 'line',
        },
        isActive: true,
        isCustom: false,
      },
      {
        tenantId,
        metricKey: 'collaboration_index',
        name: 'Collaboration Index',
        description: 'Measure of cross-team collaboration based on message interactions',
        category: 'org_health',
        dataType: 'number',
        aggregationType: 'avg',
        calculation: {
          formula: 'COUNT(DISTINCT teams_mentioned) / COUNT(messages)',
          sourceFields: ['userId', 'channelId', 'mentions'],
          sourceTypes: ['slack', 'teams'],
          customLogic: 'calculateCollaborationIndex',
        },
        thresholds: {
          excellent: { min: 0.7 },
          good: { min: 0.5 },
          warning: { min: 0.3 },
          critical: { max: 0.3 },
        },
        displayConfig: {
          unit: 'score',
          decimalPlaces: 2,
          chartType: 'gauge',
        },
        isActive: true,
        isCustom: false,
      },

      // === Quality Metrics ===
      {
        tenantId,
        metricKey: 'defect_density',
        name: 'Defect Density',
        description: 'Number of bugs per completed story',
        category: 'org_health',
        dataType: 'percentage',
        aggregationType: 'avg',
        calculation: {
          formula: 'COUNT(bugs) / COUNT(completed_stories)',
          sourceFields: ['issueType', 'status'],
          sourceTypes: ['jira'],
        },
        thresholds: {
          excellent: { max: 0.1 }, // < 10%
          good: { max: 0.2 }, // < 20%
          warning: { max: 0.35 }, // < 35%
          critical: { min: 0.35 }, // > 35%
        },
        displayConfig: {
          unit: '%',
          decimalPlaces: 1,
          chartType: 'line',
        },
        isActive: true,
        isCustom: false,
      },
      {
        tenantId,
        metricKey: 'rework_rate',
        name: 'Rework Rate',
        description: 'Percentage of issues reopened after resolution',
        category: 'org_health',
        dataType: 'percentage',
        aggregationType: 'avg',
        calculation: {
          formula: 'COUNT(reopened_issues) / COUNT(resolved_issues)',
          sourceFields: ['status', 'statusHistory'],
          sourceTypes: ['jira'],
        },
        thresholds: {
          excellent: { max: 0.05 }, // < 5%
          good: { max: 0.10 }, // < 10%
          warning: { max: 0.20 }, // < 20%
          critical: { min: 0.20 }, // > 20%
        },
        displayConfig: {
          unit: '%',
          decimalPlaces: 1,
          chartType: 'bar',
        },
        isActive: true,
        isCustom: false,
      },

      // === Employee Engagement Metrics ===
      {
        tenantId,
        metricKey: 'team_engagement',
        name: 'Team Engagement Score',
        description: 'Activity level based on messages and issue updates',
        category: 'org_health',
        dataType: 'number',
        aggregationType: 'avg',
        calculation: {
          formula: 'SUM(activities) / COUNT(team_members)',
          sourceFields: ['userId', 'timestamp'],
          sourceTypes: ['slack', 'teams', 'jira'],
          customLogic: 'calculateEngagementScore',
        },
        thresholds: {
          excellent: { min: 0.8 },
          good: { min: 0.6 },
          warning: { min: 0.4 },
          critical: { max: 0.4 },
        },
        displayConfig: {
          unit: 'score',
          decimalPlaces: 2,
          chartType: 'gauge',
        },
        isActive: true,
        isCustom: false,
      },
    ];
  }

  /**
   * Create custom metric definition
   */
  async createMetric(data: Partial<MetricDefinition>): Promise<MetricDefinition> {
    const metric = this.metricRepository.create({
      ...data,
      isCustom: true,
    });

    return await this.metricRepository.save(metric);
  }

  /**
   * Get all metrics for a tenant
   */
  async getMetrics(
    tenantId: number,
    category?: string,
  ): Promise<MetricDefinition[]> {
    const where: any = { tenantId, isActive: true };

    if (category) {
      where.category = category;
    }

    return await this.metricRepository.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Get metric by key
   */
  async getMetricByKey(tenantId: number, metricKey: string): Promise<MetricDefinition> {
    const metric = await this.metricRepository.findOne({
      where: { tenantId, metricKey },
    });

    if (!metric) {
      throw new NotFoundException(`Metric ${metricKey} not found`);
    }

    return metric;
  }

  /**
   * Update metric definition
   */
  async updateMetric(
    tenantId: number,
    metricKey: string,
    updates: Partial<MetricDefinition>,
  ): Promise<MetricDefinition> {
    const metric = await this.getMetricByKey(tenantId, metricKey);

    // Don't allow updating system metrics
    if (!metric.isCustom) {
      delete updates.calculation;
      delete updates.metricKey;
    }

    Object.assign(metric, updates);
    return await this.metricRepository.save(metric);
  }

  /**
   * Delete custom metric
   */
  async deleteMetric(tenantId: number, metricKey: string): Promise<void> {
    const metric = await this.getMetricByKey(tenantId, metricKey);

    if (!metric.isCustom) {
      throw new Error('Cannot delete system-defined metrics');
    }

    await this.metricRepository.remove(metric);
  }
}
