import { DataSource } from 'typeorm';
import { TimelineEvent } from '../../modules/timeline/entities/timeline-event.entity';

export async function seedTimelineData(dataSource: DataSource, tenantId: number): Promise<void> {
  const timelineRepo = dataSource.getRepository(TimelineEvent);

  console.log('\n📅 Seeding Timeline events...');

  // Check if timeline events already exist
  const existingEvent = await timelineRepo.findOne({
    where: { tenantId, title: 'Communication Bottleneck Detected' },
  });

  if (existingEvent) {
    console.log('  ℹ️  Timeline data already exists, skipping...');
    return;
  }

  const now = new Date();
  const timelineEvents = [
    {
      title: 'Communication Bottleneck Detected',
      description: 'AI detected unusual communication patterns indicating potential bottleneck in cross-team collaboration. Response times in #engineering channel increased by 45% over the past week.',
      eventDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      impactLevel: 'high',
      category: 'Communication',
      sourceType: 'ai_detected',
      metadata: {
        affectedTeams: ['Engineering', 'Product'],
        confidence: 0.87,
        signals: ['Slow response times', 'Increased thread depth', 'Reduced message frequency'],
        recommendations: [
          'Schedule cross-team sync meeting',
          'Review communication protocols',
          'Consider dedicated liaison role',
        ],
        metrics: {
          avgResponseTime: '4.5 hours',
          previousAvgResponseTime: '2.1 hours',
          changePercent: 114,
        },
      },
      aiAnalysis: {
        detectedPattern: 'Communication Degradation',
        severity: 'High',
        rootCause: 'Increased workload and competing priorities leading to delayed responses',
        predictedImpact: 'May cause 15-20% reduction in team velocity if not addressed',
        suggestedActions: [
          'Implement daily stand-ups for affected teams',
          'Create dedicated communication time blocks',
          'Review and prioritize cross-team dependencies',
        ],
      },
      isResolved: false,
    },
    {
      title: 'Workload Distribution Imbalance',
      description: 'Significant imbalance detected in issue assignment. 65% of critical issues assigned to 3 team members while others are underutilized.',
      eventDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      impactLevel: 'medium',
      category: 'Operations',
      sourceType: 'ai_detected',
      metadata: {
        affectedTeams: ['Engineering'],
        affectedProjects: ['PROD', 'ENG'],
        confidence: 0.92,
        signals: ['Uneven task distribution', 'Burnout risk indicators', 'Velocity variance'],
        recommendations: [
          'Rebalance workload across team',
          'Review assignment policies',
          'Provide support to overloaded members',
        ],
        metrics: {
          top3Members: '65% of critical issues',
          averagePerMember: '12%',
          imbalanceScore: 5.4,
        },
      },
      aiAnalysis: {
        detectedPattern: 'Resource Allocation Imbalance',
        severity: 'Medium',
        rootCause: 'Expertise clustering and lack of load balancing in assignment process',
        predictedImpact: 'Risk of burnout for key team members, potential knowledge silos',
        suggestedActions: [
          'Implement round-robin assignment for non-critical issues',
          'Provide training to distribute expertise',
          'Monitor individual workload metrics',
        ],
      },
      isResolved: false,
    },
    {
      title: 'Recurrent Incident Pattern Resolved',
      description: 'Successfully identified and resolved recurring database timeout pattern that was affecting 15% of API requests during peak hours.',
      eventDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      impactLevel: 'low',
      category: 'Incidents',
      sourceType: 'servicenow',
      sourceId: 'INC0010567',
      metadata: {
        affectedTeams: ['Infrastructure', 'Platform'],
        confidence: 0.95,
        signals: ['Database query optimization', 'Connection pool tuning', 'Monitoring alerts reduction'],
        metrics: {
          incidentFrequency: '12 incidents/week → 0 incidents/week',
          affectedRequests: '15% → 0.2%',
          resolutionTime: '4 hours average',
        },
      },
      aiAnalysis: {
        detectedPattern: 'Recurring Technical Debt',
        severity: 'Low',
        rootCause: 'Inefficient database queries and inadequate connection pooling',
        predictedImpact: 'Resolved - No further impact expected',
        suggestedActions: ['Monitor for recurrence', 'Document solution in knowledge base'],
      },
      isResolved: true,
      resolvedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      resolutionNotes: 'Optimized slow queries and increased connection pool size. Monitoring shows 0% error rate for 48 hours.',
    },
    {
      title: 'Decision Velocity Slowing',
      description: 'Average time to close issues increased from 5.2 days to 8.7 days. AI analysis suggests decision-making bottlenecks in approval process.',
      eventDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      impactLevel: 'medium',
      category: 'Operations',
      sourceType: 'ai_detected',
      metadata: {
        affectedTeams: ['Product', 'Engineering', 'Support'],
        affectedProjects: ['PROD', 'ENG', 'SUP'],
        confidence: 0.84,
        signals: ['Increased cycle time', 'More review iterations', 'Delayed approvals'],
        recommendations: [
          'Streamline approval process',
          'Delegate decision authority',
          'Implement decision SLAs',
        ],
        metrics: {
          avgCycleTime: '8.7 days',
          previousAvgCycleTime: '5.2 days',
          changePercent: 67,
          bottleneckStage: 'Approval & Review',
        },
      },
      aiAnalysis: {
        detectedPattern: 'Process Inefficiency',
        severity: 'Medium',
        rootCause: 'Centralized decision-making creating bottleneck as team scales',
        predictedImpact: '20-25% reduction in team productivity if trend continues',
        suggestedActions: [
          'Empower team leads with decision authority',
          'Define clear escalation criteria',
          'Implement automated approval for low-risk changes',
        ],
      },
      isResolved: false,
    },
  ];

  for (const eventData of timelineEvents) {
    const event = timelineRepo.create(eventData);
    event.tenantId = tenantId;
    await timelineRepo.save(event);
    console.log(`  ✓ Created timeline event: ${eventData.title}`);
  }

  console.log('  ✅ Timeline data seeded successfully!\n');
}
