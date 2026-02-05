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
}
