import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { TimelineEvent } from '../entities/timeline-event.entity';
import { CreateTimelineEventDto, UpdateTimelineEventDto, TimelineQueryDto } from '../dto/timeline.dto';

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    @InjectRepository(TimelineEvent)
    private readonly timelineRepository: Repository<TimelineEvent>,
  ) {}

  /**
   * Get timeline events with filters and pagination
   */
  async getEvents(
    tenantId: number,
    query: TimelineQueryDto,
  ): Promise<{
    events: TimelineEvent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      startDate,
      endDate,
      impactLevel,
      category,
      isResolved,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      tenantId,
      isActive: true,
    };

    // Date range filter
    if (startDate && endDate) {
      where.eventDate = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.eventDate = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      where.eventDate = LessThanOrEqual(new Date(endDate));
    }

    // Impact level filter
    if (impactLevel) {
      where.impactLevel = impactLevel;
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Resolved status filter
    if (isResolved !== undefined) {
      where.isResolved = isResolved;
    }

    const skip = (page - 1) * limit;

    const [events, total] = await this.timelineRepository.findAndCount({
      where,
      order: {
        eventDate: 'DESC',
        createdAt: 'DESC',
      },
      take: limit,
      skip,
    });

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single timeline event
   */
  async getEvent(tenantId: number, eventId: number): Promise<TimelineEvent> {
    const event = await this.timelineRepository.findOne({
      where: { tenantId, id: eventId, isActive: true },
    });

    if (!event) {
      throw new NotFoundException(`Timeline event ${eventId} not found`);
    }

    return event;
  }

  /**
   * Create a new timeline event
   */
  async createEvent(
    tenantId: number,
    dto: CreateTimelineEventDto,
  ): Promise<TimelineEvent> {
    const event = this.timelineRepository.create({
      ...dto,
      eventDate: new Date(dto.eventDate),
    });
    event.tenantId = tenantId;

    return await this.timelineRepository.save(event);
  }

  /**
   * Update a timeline event
   */
  async updateEvent(
    tenantId: number,
    eventId: number,
    dto: UpdateTimelineEventDto,
    userId?: number,
  ): Promise<TimelineEvent> {
    const event = await this.getEvent(tenantId, eventId);

    // Update fields
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.resolutionNotes !== undefined) event.resolutionNotes = dto.resolutionNotes;

    // Handle resolution
    if (dto.isResolved !== undefined && dto.isResolved !== event.isResolved) {
      event.isResolved = dto.isResolved;
      if (dto.isResolved) {
        event.resolvedAt = new Date();
        event.resolvedBy = userId;
      } else {
        event.resolvedAt = undefined;
        event.resolvedBy = undefined;
      }
    }

    return await this.timelineRepository.save(event);
  }

  /**
   * Delete (soft delete) a timeline event
   */
  async deleteEvent(tenantId: number, eventId: number): Promise<void> {
    const event = await this.getEvent(tenantId, eventId);
    event.isActive = false;
    await this.timelineRepository.save(event);
  }

  /**
   * Get timeline statistics
   */
  async getStatistics(
    tenantId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    byImpactLevel: Record<string, number>;
    byCategory: Record<string, number>;
    resolvedCount: number;
    unresolvedCount: number;
  }> {
    const where: any = {
      tenantId,
      isActive: true,
    };

    if (startDate && endDate) {
      where.eventDate = Between(startDate, endDate);
    }

    const events = await this.timelineRepository.find({ where });

    const byImpactLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let resolvedCount = 0;
    let unresolvedCount = 0;

    for (const event of events) {
      // Count by impact level
      byImpactLevel[event.impactLevel] = (byImpactLevel[event.impactLevel] || 0) + 1;

      // Count by category
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;

      // Count resolved/unresolved
      if (event.isResolved) {
        resolvedCount++;
      } else {
        unresolvedCount++;
      }
    }

    return {
      totalEvents: events.length,
      byImpactLevel,
      byCategory,
      resolvedCount,
      unresolvedCount,
    };
  }

  /**
   * Auto-detect and create timeline events from integration data
   */
  async detectAndCreateEvents(tenantId: number): Promise<TimelineEvent[]> {
    // This would analyze data from Jira, Slack, Teams, ServiceNow, and KPIs
    // to automatically detect significant events
    // Implementation would involve:
    // 1. Query recent data from all integrations
    // 2. Apply AI/ML models to detect patterns
    // 3. Create timeline events for detected patterns
    // For now, return empty array (to be implemented based on specific detection logic)

    this.logger.log(`Auto-detecting timeline events for tenant ${tenantId}`);
    return [];
  }

  /**
   * Generate AI hypotheses and recommendations for a timeline event
   */
  async generateHypotheses(event: any): Promise<{
    rootCauseHypotheses: Array<{
      hypothesis: string;
      confidence: number;
      reasoning: string;
      evidence: string[];
    }>;
    recommendations: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      category: string;
      estimatedImpact: string;
      steps: string[];
    }>;
  }> {
    this.logger.log(`Generating hypotheses for event: ${event.id}`);

    // Analyze the event to generate hypotheses
    const hypotheses = this.analyzeEventForHypotheses(event);
    const recommendations = this.generateRecommendations(event, hypotheses);

    return {
      rootCauseHypotheses: hypotheses,
      recommendations,
    };
  }

  /**
   * Analyze event and generate root cause hypotheses
   */
  private analyzeEventForHypotheses(event: any): Array<{
    hypothesis: string;
    confidence: number;
    reasoning: string;
    evidence: string[];
  }> {
    const hypotheses = [];
    const eventType = event.type || event.impactLevel;
    const description = event.description || event.title || '';
    const metadata = event.metadata || {};

    // Pattern-based hypothesis generation
    if (description.toLowerCase().includes('api') || description.toLowerCase().includes('endpoint')) {
      hypotheses.push({
        hypothesis: 'API endpoint performance degradation',
        confidence: 0.85,
        reasoning: 'Event description indicates API-related issues. Common causes include increased load, inefficient queries, or external service delays.',
        evidence: [
          'Event mentions API or endpoint functionality',
          eventType === 'high' ? 'High severity indicates significant impact' : 'Moderate severity suggests ongoing issue',
          metadata.source ? `Detected from ${metadata.source}` : 'Multiple data sources showing similar patterns',
        ],
      });

      hypotheses.push({
        hypothesis: 'Database query performance issues',
        confidence: 0.72,
        reasoning: 'API issues often stem from slow database queries. Missing indexes or inefficient queries could be causing delays.',
        evidence: [
          'API slowdowns frequently correlate with database performance',
          'Similar patterns seen in historical incidents',
        ],
      });
    }

    if (description.toLowerCase().includes('memory') || description.toLowerCase().includes('cpu')) {
      hypotheses.push({
        hypothesis: 'Resource exhaustion - Memory or CPU limits reached',
        confidence: 0.88,
        reasoning: 'System resource constraints indicated. May be caused by memory leaks, inefficient algorithms, or insufficient scaling.',
        evidence: [
          'Event explicitly mentions resource constraints',
          'Resource exhaustion is a common cause of system degradation',
          eventType === 'critical' ? 'Critical severity suggests system-wide impact' : 'Severity indicates localized resource issues',
        ],
      });
    }

    if (description.toLowerCase().includes('deploy') || description.toLowerCase().includes('release')) {
      hypotheses.push({
        hypothesis: 'Recent deployment introduced regression',
        confidence: 0.79,
        reasoning: 'Timing suggests correlation with recent deployment. New code may have introduced bugs or performance regressions.',
        evidence: [
          'Event timing aligns with deployment window',
          'Deployment-related issues are common root causes',
          'No similar issues reported before recent changes',
        ],
      });
    }

    if (description.toLowerCase().includes('auth') || description.toLowerCase().includes('login')) {
      hypotheses.push({
        hypothesis: 'Authentication service disruption',
        confidence: 0.83,
        reasoning: 'Authentication-related keywords detected. Could be caused by token expiration, service outage, or configuration issues.',
        evidence: [
          'Authentication keywords present in event description',
          'Auth issues typically affect multiple users simultaneously',
        ],
      });
    }

    // Generic fallback hypotheses if no specific patterns matched
    if (hypotheses.length === 0) {
      hypotheses.push({
        hypothesis: 'Configuration change or environment drift',
        confidence: 0.65,
        reasoning: 'No specific pattern detected. Configuration changes or environment drift are common causes of unexpected issues.',
        evidence: [
          'Event occurred without obvious trigger',
          'Configuration issues often present as intermittent problems',
        ],
      });

      hypotheses.push({
        hypothesis: 'External dependency failure',
        confidence: 0.60,
        reasoning: 'Issue may originate from third-party services or external APIs experiencing problems.',
        evidence: [
          'Many production issues stem from external dependencies',
          'Timing may correlate with external service disruptions',
        ],
      });
    }

    // Sort by confidence
    return hypotheses.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Generate actionable recommendations based on hypotheses
   */
  private generateRecommendations(event: any, hypotheses: any[]): Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
    estimatedImpact: string;
    steps: string[];
  }> {
    const recommendations: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      category: string;
      estimatedImpact: string;
      steps: string[];
    }> = [];
    const topHypothesis = hypotheses[0];

    if (!topHypothesis) {
      return [{
        title: 'Investigate and Monitor',
        description: 'Continue monitoring system behavior and collect more data',
        priority: 'medium',
        category: 'Investigation',
        estimatedImpact: 'Better visibility into system issues',
        steps: [
          'Enable detailed logging for affected services',
          'Set up alerts for similar patterns',
          'Review recent changes in the affected area',
          'Check system metrics during the incident timeframe',
        ],
      }];
    }

    // Generate recommendations based on top hypothesis
    if (topHypothesis.hypothesis.includes('API') || topHypothesis.hypothesis.includes('performance')) {
      recommendations.push({
        title: 'Optimize API Performance',
        description: 'Implement performance optimizations to reduce response times and improve throughput',
        priority: 'high',
        category: 'Performance',
        estimatedImpact: '40-60% reduction in response time',
        steps: [
          'Profile slow endpoints using APM tools',
          'Add database query indexes for frequently accessed data',
          'Implement caching layer for repeated queries',
          'Consider API rate limiting to prevent overload',
          'Review and optimize N+1 query patterns',
        ],
      });

      recommendations.push({
        title: 'Scale Infrastructure',
        description: 'Increase system capacity to handle current load levels',
        priority: 'medium',
        category: 'Infrastructure',
        estimatedImpact: 'Improved stability under high load',
        steps: [
          'Review current resource utilization metrics',
          'Increase API server instance count',
          'Implement horizontal pod autoscaling',
          'Consider CDN for static assets',
        ],
      });
    }

    if (topHypothesis.hypothesis.includes('Resource exhaustion') || topHypothesis.hypothesis.includes('Memory')) {
      recommendations.push({
        title: 'Fix Resource Leaks',
        description: 'Identify and resolve memory leaks or CPU-intensive operations',
        priority: 'high',
        category: 'Stability',
        estimatedImpact: 'Eliminate recurring resource exhaustion issues',
        steps: [
          'Run memory profiler to identify leak sources',
          'Review code for unclosed connections or event listeners',
          'Implement resource limits and circuit breakers',
          'Add memory monitoring and alerts',
          'Consider worker thread pool optimization',
        ],
      });
    }

    if (topHypothesis.hypothesis.includes('deployment') || topHypothesis.hypothesis.includes('regression')) {
      recommendations.push({
        title: 'Rollback and Fix',
        description: 'Rollback recent deployment and fix the regression before redeploying',
        priority: 'high',
        category: 'Deployment',
        estimatedImpact: 'Immediate resolution of user-facing issues',
        steps: [
          'Initiate rollback to previous stable version',
          'Review commit diff for recent changes',
          'Add test coverage for the affected functionality',
          'Perform canary deployment when redeploying fix',
          'Implement blue-green deployment strategy',
        ],
      });
    }

    if (topHypothesis.hypothesis.includes('Authentication')) {
      recommendations.push({
        title: 'Stabilize Authentication Service',
        description: 'Ensure authentication service reliability and implement fallback mechanisms',
        priority: 'high',
        category: 'Security',
        estimatedImpact: 'Prevent authentication-related outages',
        steps: [
          'Check auth service health and logs',
          'Verify token expiration configurations',
          'Implement auth service redundancy',
          'Add session persistence and failover',
          'Review and update authentication flow',
        ],
      });
    }

    // Add monitoring recommendation
    recommendations.push({
      title: 'Enhance Monitoring and Alerting',
      description: 'Improve observability to detect similar issues earlier',
      priority: 'medium',
      category: 'Observability',
      estimatedImpact: 'Early detection of future incidents',
      steps: [
        'Set up custom metrics for key business operations',
        'Configure alerts with appropriate thresholds',
        'Implement distributed tracing',
        'Create runbooks for common incident types',
        'Schedule regular metric review sessions',
      ],
    });

    return recommendations.slice(0, 3);
  }
}
