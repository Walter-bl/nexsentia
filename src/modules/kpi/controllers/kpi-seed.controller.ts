import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricDefinition } from '../entities/metric-definition.entity';
import { MetricValue } from '../entities/metric-value.entity';
import { BusinessImpact } from '../entities/business-impact.entity';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('KPI Seeding')
@Controller('kpi/seed')
@UseGuards(JwtAuthGuard)
export class KpiSeedController {
  constructor(
    @InjectRepository(MetricDefinition)
    private readonly metricDefinitionRepo: Repository<MetricDefinition>,
    @InjectRepository(MetricValue)
    private readonly metricValueRepo: Repository<MetricValue>,
    @InjectRepository(BusinessImpact)
    private readonly businessImpactRepo: Repository<BusinessImpact>,
  ) {}

  @Post()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Seed KPI demo data for current tenant' })
  async seedKpiData(@CurrentTenant() tenantId: number) {
    try {
      // Check if data already exists
      const existingMetric = await this.metricDefinitionRepo.findOne({
        where: { tenantId, metricKey: 'incident_resolution_time' },
      });

      if (existingMetric) {
        return {
          message: 'KPI data already exists for this tenant',
          status: 'skipped',
        };
      }

      // Define metric definitions
      const metricDefinitions = [
        {
          tenantId,
          metricKey: 'incident_resolution_time',
          name: 'Incident Resolution Time',
          description: 'Average time to resolve critical incidents',
          category: 'org_health',
          dataType: 'duration',
          aggregationType: 'avg',
          calculation: {
            formula: 'avg(resolved_time - created_time)',
            sourceFields: ['created', 'resolved'],
            sourceTypes: ['jira', 'servicenow'],
          },
          thresholds: {
            excellent: { max: 4 },
            good: { min: 4, max: 8 },
            warning: { min: 8, max: 24 },
            critical: { min: 24 },
          },
          displayConfig: {
            unit: 'hrs',
            decimalPlaces: 1,
            chartType: 'line',
            color: '#3b82f6',
          },
          isActive: true,
          isCustom: false,
        },
        {
          tenantId,
          metricKey: 'mttr',
          name: 'Mean Time To Recovery',
          description: 'Average time to recover from system failures',
          category: 'org_health',
          dataType: 'duration',
          aggregationType: 'avg',
          calculation: {
            sourceFields: ['incident_start', 'incident_end'],
            sourceTypes: ['servicenow', 'jira'],
          },
          thresholds: {
            excellent: { max: 2 },
            good: { min: 2, max: 6 },
            warning: { min: 6, max: 12 },
            critical: { min: 12 },
          },
          displayConfig: {
            unit: 'hrs',
            decimalPlaces: 1,
            chartType: 'line',
            color: '#8b5cf6',
          },
          isActive: true,
          isCustom: false,
        },
        {
          tenantId,
          metricKey: 'incident_volume',
          name: 'Incident Volume',
          description: 'Total number of incidents reported',
          category: 'org_health',
          dataType: 'count',
          aggregationType: 'count',
          calculation: {
            sourceFields: ['incident_id'],
            sourceTypes: ['servicenow', 'jira'],
          },
          thresholds: {
            excellent: { max: 5 },
            good: { min: 5, max: 15 },
            warning: { min: 15, max: 30 },
            critical: { min: 30 },
          },
          displayConfig: {
            unit: '',
            decimalPlaces: 0,
            chartType: 'bar',
            color: '#ef4444',
          },
          isActive: true,
          isCustom: false,
        },
        {
          tenantId,
          metricKey: 'team_velocity',
          name: 'Team Velocity',
          description: 'Average story points completed per sprint',
          category: 'org_health',
          dataType: 'number',
          aggregationType: 'avg',
          calculation: {
            sourceFields: ['story_points', 'sprint'],
            sourceTypes: ['jira'],
          },
          thresholds: {
            excellent: { min: 80 },
            good: { min: 60, max: 80 },
            warning: { min: 40, max: 60 },
            critical: { max: 40 },
          },
          displayConfig: {
            unit: 'pts',
            decimalPlaces: 0,
            chartType: 'line',
            color: '#10b981',
          },
          isActive: true,
          isCustom: false,
        },
        {
          tenantId,
          metricKey: 'response_time',
          name: 'Average Response Time',
          description: 'Average time to first response in communications',
          category: 'org_health',
          dataType: 'duration',
          aggregationType: 'avg',
          calculation: {
            sourceFields: ['message_timestamp', 'reply_timestamp'],
            sourceTypes: ['slack', 'teams'],
          },
          thresholds: {
            excellent: { max: 0.5 },
            good: { min: 0.5, max: 2 },
            warning: { min: 2, max: 4 },
            critical: { min: 4 },
          },
          displayConfig: {
            unit: 'hrs',
            decimalPlaces: 1,
            chartType: 'line',
            color: '#06b6d4',
          },
          isActive: true,
          isCustom: false,
        },
        {
          tenantId,
          metricKey: 'team_engagement',
          name: 'Team Engagement Score',
          description: 'Overall team activity and collaboration score',
          category: 'org_health',
          dataType: 'percentage',
          aggregationType: 'avg',
          calculation: {
            sourceFields: ['messages', 'reactions', 'threads'],
            sourceTypes: ['slack', 'teams'],
          },
          thresholds: {
            excellent: { min: 80 },
            good: { min: 60, max: 80 },
            warning: { min: 40, max: 60 },
            critical: { max: 40 },
          },
          displayConfig: {
            unit: '%',
            decimalPlaces: 0,
            chartType: 'gauge',
            color: '#ec4899',
          },
          isActive: true,
          isCustom: false,
        },
      ];

      // Save metric definitions
      const savedDefinitions = await this.metricDefinitionRepo.save(metricDefinitions);

      // Create metric values for last 90 days
      const now = new Date();
      const metricValues = [];

      for (const definition of savedDefinitions) {
        // Generate last 90 days of data
        for (let i = 89; i >= 0; i--) {
          const periodEnd = new Date(now);
          periodEnd.setDate(periodEnd.getDate() - i);
          periodEnd.setHours(23, 59, 59, 999);

          const periodStart = new Date(periodEnd);
          periodStart.setHours(0, 0, 0, 0);

          let value: number;
          let trend: 'up' | 'down' | 'stable' = 'stable';

          // Generate realistic values based on metric type with trends
          switch (definition.metricKey) {
            case 'incident_resolution_time':
              value = 12 - (i / 90) * 6 + Math.random() * 3;
              trend = i < 45 ? 'down' : 'stable';
              break;
            case 'mttr':
              value = 8 - (i / 90) * 4 + Math.random() * 2;
              trend = i < 45 ? 'down' : 'stable';
              break;
            case 'incident_volume':
              value = Math.floor(25 - (i / 90) * 13 + Math.random() * 5);
              trend = i < 45 ? 'down' : 'stable';
              break;
            case 'team_velocity':
              value = Math.floor(55 + (i / 90) * 20 + Math.random() * 10);
              trend = i < 60 ? 'up' : 'stable';
              break;
            case 'response_time':
              value = 3 - (i / 90) * 2 + Math.random() * 0.5;
              trend = i < 45 ? 'down' : 'stable';
              break;
            case 'team_engagement':
              value = Math.floor(55 + (i / 90) * 20 + Math.random() * 10);
              trend = i < 60 ? 'up' : 'stable';
              break;
            default:
              value = 50 + Math.random() * 20;
          }

          const previousValue = i < 89 ? value * (0.95 + Math.random() * 0.1) : value;
          const changePercent = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;

          metricValues.push({
            tenantId,
            metricDefinitionId: definition.id,
            value: parseFloat(value.toFixed(2)),
            periodStart,
            periodEnd,
            granularity: 'daily',
            breakdown: {
              byTeam: {
                'Engineering': parseFloat((value * (0.9 + Math.random() * 0.2)).toFixed(2)),
                'Product': parseFloat((value * (0.9 + Math.random() * 0.2)).toFixed(2)),
                'Support': parseFloat((value * (0.9 + Math.random() * 0.2)).toFixed(2)),
              },
              byProject: {
                'PROD': parseFloat((value * 0.4).toFixed(2)),
                'ENG': parseFloat((value * 0.35).toFixed(2)),
                'SUP': parseFloat((value * 0.25).toFixed(2)),
              },
            },
            metadata: {
              dataPoints: Math.floor(10 + Math.random() * 20),
              confidence: 0.85 + Math.random() * 0.1,
              sources: definition.calculation.sourceTypes,
              calculatedAt: new Date(),
              calculationDuration: Math.floor(50 + Math.random() * 100),
            },
            comparisonData: {
              previousPeriod: parseFloat(previousValue.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              trend,
              movingAverage: parseFloat(value.toFixed(2)),
            },
          });
        }
      }

      await this.metricValueRepo.save(metricValues);

      // Create business impacts
      const businessImpacts = [
        {
          tenantId,
          sourceType: 'servicenow',
          sourceId: 'INC0010234',
          impactType: 'outage',
          estimatedRevenueLoss: 25000,
          actualRevenueLoss: 23500,
          customersAffected: 150,
          usersAffected: 450,
          durationMinutes: 180,
          impactDate: new Date('2026-01-15 08:30:00'),
          resolvedDate: new Date('2026-01-15 11:30:00'),
          severity: 'critical',
          revenueMapping: {
            affectedServices: ['Email Service', 'Calendar'],
            revenuePerHour: 8333,
            recurringRevenueImpact: 20000,
            oneTimeRevenueLoss: 3500,
            methodology: 'service_downtime_cost',
          },
          lossEstimation: {
            directCosts: 15000,
            indirectCosts: 5000,
            opportunityCost: 3500,
            reputationImpact: 2000,
            calculationMethod: 'customer_impact_analysis',
            confidence: 0.9,
          },
          metadata: {
            priority: '1 - Critical',
            assignee: 'John Smith',
            team: 'Infrastructure',
            tags: ['email', 'outage', 'p1'],
            rootCause: 'Exchange server failure',
          },
          isValidated: true,
          validatedAt: new Date('2026-01-16 10:00:00'),
          validatedBy: 1,
          validationNotes: 'Revenue loss validated against customer SLA penalties',
        },
        {
          tenantId,
          sourceType: 'jira',
          sourceId: 'PROD-845',
          impactType: 'bug',
          estimatedRevenueLoss: 15000,
          customersAffected: 80,
          usersAffected: 240,
          durationMinutes: 1440,
          impactDate: new Date('2026-01-20 14:00:00'),
          resolvedDate: new Date('2026-01-21 14:00:00'),
          severity: 'high',
          revenueMapping: {
            affectedServices: ['Payment Gateway'],
            revenuePerHour: 625,
            recurringRevenueImpact: 12000,
            oneTimeRevenueLoss: 3000,
            methodology: 'transaction_loss_calculation',
          },
          lossEstimation: {
            directCosts: 10000,
            indirectCosts: 3000,
            opportunityCost: 2000,
            calculationMethod: 'transaction_volume_analysis',
            confidence: 0.85,
          },
          metadata: {
            priority: 'High',
            assignee: 'Sarah Johnson',
            team: 'Engineering',
            tags: ['payment', 'bug', 'revenue-impact'],
            rootCause: 'Payment processor timeout',
          },
          isValidated: true,
          validatedAt: new Date('2026-01-22 09:00:00'),
          validatedBy: 1,
        },
        {
          tenantId,
          sourceType: 'servicenow',
          sourceId: 'INC0010567',
          impactType: 'incident',
          estimatedRevenueLoss: 8000,
          actualRevenueLoss: 7500,
          customersAffected: 45,
          usersAffected: 135,
          durationMinutes: 240,
          impactDate: new Date('2026-01-25 09:00:00'),
          resolvedDate: new Date('2026-01-25 13:00:00'),
          severity: 'high',
          revenueMapping: {
            affectedServices: ['API Gateway'],
            revenuePerHour: 2000,
            methodology: 'api_traffic_loss',
          },
          lossEstimation: {
            directCosts: 5000,
            indirectCosts: 2000,
            opportunityCost: 500,
            calculationMethod: 'api_usage_metrics',
            confidence: 0.88,
          },
          metadata: {
            priority: '2 - High',
            assignee: 'Mike Chen',
            team: 'Platform',
            tags: ['api', 'performance'],
            rootCause: 'Database connection pool exhaustion',
          },
          isValidated: false,
        },
        {
          tenantId,
          sourceType: 'servicenow',
          sourceId: 'INC0010892',
          impactType: 'incident',
          estimatedRevenueLoss: 5000,
          actualRevenueLoss: 4800,
          customersAffected: 30,
          usersAffected: 90,
          durationMinutes: 120,
          impactDate: new Date('2026-02-01 16:00:00'),
          resolvedDate: new Date('2026-02-01 18:00:00'),
          severity: 'medium',
          revenueMapping: {
            affectedServices: ['Reporting Dashboard'],
            revenuePerHour: 2500,
            methodology: 'service_tier_impact',
          },
          lossEstimation: {
            directCosts: 3000,
            indirectCosts: 1500,
            opportunityCost: 300,
            calculationMethod: 'customer_tier_analysis',
            confidence: 0.82,
          },
          metadata: {
            priority: '3 - Medium',
            assignee: 'Lisa Wang',
            team: 'Support',
            tags: ['reporting', 'dashboard'],
            rootCause: 'Query optimization needed',
          },
          isValidated: true,
          validatedAt: new Date('2026-02-02 10:00:00'),
          validatedBy: 1,
        },
      ];

      await this.businessImpactRepo.save(businessImpacts);

      return {
        message: 'KPI data seeded successfully',
        status: 'success',
        summary: {
          metricDefinitions: savedDefinitions.length,
          metricValues: metricValues.length,
          businessImpacts: businessImpacts.length,
        },
      };
    } catch (error) {
      return {
        message: 'Failed to seed KPI data',
        status: 'error',
        error: error.message,
      };
    }
  }
}
