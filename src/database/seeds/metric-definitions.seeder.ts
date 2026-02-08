import { DataSource } from 'typeorm';
import { MetricDefinition } from '../../modules/kpi/entities/metric-definition.entity';

export async function seedMetricDefinitions(dataSource: DataSource, tenantId: number): Promise<void> {
  const metricRepo = dataSource.getRepository(MetricDefinition);

  console.log('📊 Seeding metric definitions...');

  // Delete existing org_health metrics for this tenant to avoid duplicates
  await metricRepo.delete({ tenantId, category: 'org_health' });
  console.log('  🗑️  Deleted existing org_health metrics');

  const metrics: Partial<MetricDefinition>[] = [
    {
      tenantId,
      metricKey: 'incident_resolution_time',
      name: 'Average Incident Resolution Time',
      description: 'Average time to resolve incidents across all systems',
      category: 'org_health',
      dataType: 'duration',
      aggregationType: 'avg',
      calculation: {
        sourceFields: ['openedAt', 'resolvedAt'],
        sourceTypes: ['servicenow'],
      },
      thresholds: {
        excellent: { max: 3 }, // 3 hours
        good: { max: 6 },
        warning: { max: 12 },
        critical: { min: 12 },
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
      metricKey: 'critical_incidents_rate',
      name: 'Critical Incidents Rate',
      description: 'Number of critical incidents per day',
      category: 'org_health',
      dataType: 'count',
      aggregationType: 'count',
      calculation: {
        sourceFields: ['priority'],
        sourceTypes: ['servicenow'],
        filters: { priority: '1 - Critical' },
      },
      thresholds: {
        excellent: { max: 5 },
        good: { max: 15 },
        warning: { max: 30 },
        critical: { min: 30 },
      },
      displayConfig: {
        unit: 'incidents',
        decimalPlaces: 0,
        chartType: 'bar',
        color: '#ef4444',
      },
      isActive: true,
      isCustom: false,
    },
    {
      tenantId,
      metricKey: 'team_engagement',
      name: 'Team Engagement Score',
      description: 'Communication activity and engagement percentage',
      category: 'org_health',
      dataType: 'percentage',
      aggregationType: 'avg',
      calculation: {
        sourceFields: ['text'],
        sourceTypes: ['slack', 'teams'],
      },
      thresholds: {
        critical: { max: 40 },           // Less than 40% is critical
        warning: { min: 40, max: 60 },   // 40-60% is warning
        good: { min: 60, max: 80 },      // 60-80% is good
        excellent: { min: 80 },          // 80%+ is excellent
      },
      displayConfig: {
        unit: '%',
        decimalPlaces: 0,
        chartType: 'gauge',
        color: '#10b981',
      },
      isActive: true,
      isCustom: false,
    },
    {
      tenantId,
      metricKey: 'issue_backlog_count',
      name: 'Issue Backlog Count',
      description: 'Number of open issues in backlog',
      category: 'org_health',
      dataType: 'count',
      aggregationType: 'count',
      calculation: {
        sourceFields: ['status'],
        sourceTypes: ['jira'],
        filters: { status: 'open' },
      },
      thresholds: {
        critical: { min: 100 },          // 100+ is critical
        warning: { min: 60, max: 100 },  // 60-100 is warning
        good: { min: 30, max: 60 },      // 30-60 is good
        excellent: { max: 30 },          // Less than 30 is excellent
      },
      displayConfig: {
        unit: 'issues',
        decimalPlaces: 0,
        chartType: 'number',
        color: '#f59e0b',
      },
      isActive: true,
      isCustom: false,
    },
    {
      tenantId,
      metricKey: 'deployment_frequency',
      name: 'Deployment Frequency',
      description: 'Number of completed tasks (proxy for deployments)',
      category: 'org_health',
      dataType: 'count',
      aggregationType: 'count',
      calculation: {
        sourceFields: ['status'],
        sourceTypes: ['jira'],
        filters: { status: 'done' },
      },
      thresholds: {
        critical: { max: 10 },     // Less than 10 is critical
        warning: { min: 10, max: 20 },  // 10-20 is warning
        good: { min: 20, max: 40 },     // 20-40 is good
        excellent: { min: 40 },          // 40+ is excellent
      },
      displayConfig: {
        unit: 'completed',
        decimalPlaces: 0,
        chartType: 'line',
        color: '#8b5cf6',
      },
      isActive: true,
      isCustom: false,
    },
  ];

  for (const metricData of metrics) {
    const metric = metricRepo.create(metricData);
    await metricRepo.save(metric);
    console.log(`  ✅ Created metric: ${metricData.name}`);
  }

  console.log('');
}
