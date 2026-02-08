import { DataSource } from 'typeorm';
import { BusinessImpact } from '../../modules/kpi/entities/business-impact.entity';
import { ServiceNowIncident } from '../../modules/servicenow/entities/servicenow-incident.entity';
import { JiraIssue } from '../../modules/jira/entities/jira-issue.entity';

export async function seedBusinessImpacts(dataSource: DataSource, tenantId: number): Promise<void> {
  const impactRepo = dataSource.getRepository(BusinessImpact);
  const incidentRepo = dataSource.getRepository(ServiceNowIncident);
  const jiraRepo = dataSource.getRepository(JiraIssue);

  console.log('💰 Seeding business impact data...');

  // Delete existing impacts for this tenant to avoid duplicates
  await impactRepo.delete({ tenantId });
  console.log('  🗑️  Deleted existing business impacts');

  // Get critical and high priority incidents
  const criticalIncidents = await incidentRepo.find({
    where: { tenantId },
    order: { openedAt: 'DESC' },
    take: 100,
  });

  // Get critical and high priority JIRA issues
  const criticalIssues = await jiraRepo.find({
    where: { tenantId },
    order: { jiraCreatedAt: 'DESC' },
    take: 50,
  });

  const impacts: Partial<BusinessImpact>[] = [];

  // Map ServiceNow incidents to business impacts
  for (const incident of criticalIncidents) {
    // Only create impacts for critical/high priority incidents
    if (!incident.priority?.includes('1 - Critical') && !incident.priority?.includes('2 - High')) {
      continue;
    }

    // Skip if no opened date
    if (!incident.openedAt) {
      continue;
    }

    // Calculate duration
    const openedAt = new Date(incident.openedAt);
    const resolvedAt = incident.resolvedAt ? new Date(incident.resolvedAt) : undefined;
    const durationMinutes = resolvedAt
      ? Math.floor((resolvedAt.getTime() - openedAt.getTime()) / (1000 * 60))
      : undefined;

    // Estimate revenue impact based on priority and duration
    let revenuePerHour = 0;
    let customersAffected = 0;
    let severity = 'low';

    if (incident.priority?.includes('1 - Critical')) {
      revenuePerHour = 5000 + Math.random() * 10000; // $5k-$15k per hour
      customersAffected = Math.floor(50 + Math.random() * 200); // 50-250 customers
      severity = 'critical';
    } else if (incident.priority?.includes('2 - High')) {
      revenuePerHour = 1000 + Math.random() * 4000; // $1k-$5k per hour
      customersAffected = Math.floor(10 + Math.random() * 90); // 10-100 customers
      severity = 'high';
    } else if (incident.priority?.includes('3 - Moderate')) {
      revenuePerHour = 200 + Math.random() * 800; // $200-$1k per hour
      customersAffected = Math.floor(5 + Math.random() * 45); // 5-50 customers
      severity = 'medium';
    } else {
      revenuePerHour = 50 + Math.random() * 150; // $50-$200 per hour
      customersAffected = Math.floor(1 + Math.random() * 19); // 1-20 customers
      severity = 'low';
    }

    const estimatedRevenueLoss = durationMinutes
      ? (durationMinutes / 60) * revenuePerHour
      : revenuePerHour; // Assume 1 hour if not resolved

    impacts.push({
      tenantId,
      sourceType: 'servicenow',
      sourceId: incident.number,
      impactType: 'incident',
      estimatedRevenueLoss: Math.round(estimatedRevenueLoss * 100) / 100,
      actualRevenueLoss: resolvedAt ? Math.round(estimatedRevenueLoss * 0.9 * 100) / 100 : undefined,
      customersAffected,
      usersAffected: customersAffected * Math.floor(2 + Math.random() * 8), // 2-10 users per customer
      durationMinutes: durationMinutes || 60,
      impactDate: openedAt,
      resolvedDate: resolvedAt,
      severity,
      revenueMapping: {
        affectedServices: [incident.category || 'Unknown'],
        revenuePerHour,
        recurringRevenueImpact: 0,
        oneTimeRevenueLoss: estimatedRevenueLoss,
        methodology: 'priority_duration_based',
      },
      lossEstimation: {
        directCosts: estimatedRevenueLoss * 0.7,
        indirectCosts: estimatedRevenueLoss * 0.2,
        opportunityCost: estimatedRevenueLoss * 0.1,
        reputationImpact: customersAffected * 100,
        calculationMethod: 'estimated_from_incident_priority',
        confidence: 0.75,
      },
      metadata: {
        priority: incident.priority,
        assignee: incident.assignedToName,
        team: incident.assignmentGroupName,
        tags: incident.category ? [incident.category] : [],
      },
      isValidated: Math.random() > 0.5, // 50% validated
      validatedAt: resolvedAt && Math.random() > 0.5 ? resolvedAt : undefined,
    });
  }

  // Map critical JIRA issues to business impacts
  for (const issue of criticalIssues) {
    // Only create impacts for critical/high priority issues
    if (issue.priority !== 'critical' && issue.priority !== 'high') {
      continue;
    }

    const createdAt = new Date(issue.jiraCreatedAt || issue.createdAt);
    const resolvedAt = issue.resolvedAt ? new Date(issue.resolvedAt) : undefined;
    const durationMinutes = resolvedAt
      ? Math.floor((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60))
      : undefined;

    // Estimate impact for bugs and incidents
    let revenuePerHour = 0;
    let customersAffected = 0;
    let severity = 'low';

    if (issue.priority === 'critical') {
      revenuePerHour = 2000 + Math.random() * 5000; // $2k-$7k per hour
      customersAffected = Math.floor(20 + Math.random() * 80); // 20-100 customers
      severity = 'critical';
    } else if (issue.priority === 'high') {
      revenuePerHour = 500 + Math.random() * 1500; // $500-$2k per hour
      customersAffected = Math.floor(5 + Math.random() * 45); // 5-50 customers
      severity = 'high';
    } else if (issue.priority === 'medium') {
      revenuePerHour = 100 + Math.random() * 400; // $100-$500 per hour
      customersAffected = Math.floor(2 + Math.random() * 23); // 2-25 customers
      severity = 'medium';
    }

    const estimatedRevenueLoss = durationMinutes
      ? (durationMinutes / 60) * revenuePerHour
      : revenuePerHour * 2; // Assume 2 hours if not resolved

    impacts.push({
      tenantId,
      sourceType: 'jira',
      sourceId: issue.jiraIssueKey,
      impactType: issue.issueType === 'incident' ? 'incident' : 'bug',
      estimatedRevenueLoss: Math.round(estimatedRevenueLoss * 100) / 100,
      actualRevenueLoss: resolvedAt ? Math.round(estimatedRevenueLoss * 0.85 * 100) / 100 : undefined,
      customersAffected,
      usersAffected: customersAffected * Math.floor(2 + Math.random() * 8),
      durationMinutes: durationMinutes || 120,
      impactDate: createdAt,
      resolvedDate: resolvedAt,
      severity,
      revenueMapping: {
        affectedServices: issue.labels || [],
        revenuePerHour,
        recurringRevenueImpact: 0,
        oneTimeRevenueLoss: estimatedRevenueLoss,
        methodology: 'issue_priority_based',
      },
      lossEstimation: {
        directCosts: estimatedRevenueLoss * 0.6,
        indirectCosts: estimatedRevenueLoss * 0.3,
        opportunityCost: estimatedRevenueLoss * 0.1,
        reputationImpact: customersAffected * 80,
        calculationMethod: 'estimated_from_issue_priority',
        confidence: 0.65,
      },
      metadata: {
        priority: issue.priority,
        assignee: issue.assigneeDisplayName,
        tags: issue.labels || [],
      },
      isValidated: Math.random() > 0.6, // 40% validated
      validatedAt: resolvedAt && Math.random() > 0.6 ? resolvedAt : undefined,
    });
  }

  // Save all impacts
  for (const impactData of impacts) {
    const impact = impactRepo.create(impactData);
    await impactRepo.save(impact);
  }

  console.log(`  ✅ Created ${impacts.length} business impact records`);
  console.log('');
}
