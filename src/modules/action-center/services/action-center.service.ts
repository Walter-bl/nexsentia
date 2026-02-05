import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ActionItem } from '../entities/action-item.entity';
import { CreateActionItemDto, UpdateActionItemDto, ActionItemQueryDto } from '../dto/action-item.dto';

@Injectable()
export class ActionCenterService {
  private readonly logger = new Logger(ActionCenterService.name);

  constructor(
    @InjectRepository(ActionItem)
    private readonly actionItemRepository: Repository<ActionItem>,
  ) {}

  /**
   * Get action items with filters and pagination
   */
  async getActionItems(
    tenantId: number,
    query: ActionItemQueryDto,
  ): Promise<{
    items: ActionItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: {
      open: number;
      inProgress: number;
      done: number;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      assignedToId,
      sourceType,
      search,
    } = query;

    const where: any = {
      tenantId,
      isActive: true,
    };

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (category) {
      where.category = category;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (sourceType) {
      where.sourceType = sourceType;
    }

    if (search) {
      where.title = Like(`%${search}%`);
    }

    const skip = (page - 1) * limit;

    const [items, total] = await this.actionItemRepository.findAndCount({
      where,
      order: {
        priority: 'DESC',
        createdAt: 'DESC',
      },
      take: limit,
      skip,
      relations: ['assignedTo'],
    });

    // Get stats for all statuses
    const [open, inProgress, done] = await Promise.all([
      this.actionItemRepository.count({
        where: { tenantId, isActive: true, status: 'open' },
      }),
      this.actionItemRepository.count({
        where: { tenantId, isActive: true, status: 'in_progress' },
      }),
      this.actionItemRepository.count({
        where: { tenantId, isActive: true, status: 'done' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        open,
        inProgress,
        done,
      },
    };
  }

  /**
   * Get single action item
   */
  async getActionItem(tenantId: number, itemId: number): Promise<ActionItem> {
    const item = await this.actionItemRepository.findOne({
      where: { tenantId, id: itemId, isActive: true },
      relations: ['assignedTo'],
    });

    if (!item) {
      throw new NotFoundException(`Action item ${itemId} not found`);
    }

    // Increment view count
    item.viewCount++;
    item.lastViewedAt = new Date();
    await this.actionItemRepository.save(item);

    return item;
  }

  /**
   * Create action item
   */
  async createActionItem(
    tenantId: number,
    dto: CreateActionItemDto,
  ): Promise<ActionItem> {
    const item = this.actionItemRepository.create({
      ...dto,
      tenantId,
      status: 'open',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    return await this.actionItemRepository.save(item);
  }

  /**
   * Update action item
   */
  async updateActionItem(
    tenantId: number,
    itemId: number,
    dto: UpdateActionItemDto,
    userId?: number,
  ): Promise<ActionItem> {
    const item = await this.getActionItem(tenantId, itemId);

    // Update fields
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.description !== undefined) item.description = dto.description;
    if (dto.priority !== undefined) item.priority = dto.priority;
    if (dto.assignedToId !== undefined) item.assignedToId = dto.assignedToId;
    if (dto.assignedToName !== undefined) item.assignedToName = dto.assignedToName;
    if (dto.dueDate !== undefined) {
      item.dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    }

    // Handle status changes
    if (dto.status !== undefined && dto.status !== item.status) {
      const oldStatus = item.status;
      item.status = dto.status;

      // Track status transitions
      if (dto.status === 'in_progress' && oldStatus === 'open') {
        item.startedAt = new Date();
      }

      if (dto.status === 'done') {
        item.completedAt = new Date();
        item.completedById = userId;
        if (dto.completionNotes) {
          item.completionNotes = dto.completionNotes;
        }
      }

      // If reopening from done
      if (oldStatus === 'done' && dto.status !== 'done') {
        item.completedAt = undefined;
        item.completedById = undefined;
        item.completionNotes = undefined;
      }
    }

    return await this.actionItemRepository.save(item);
  }

  /**
   * Delete (soft delete) action item
   */
  async deleteActionItem(tenantId: number, itemId: number): Promise<void> {
    const item = await this.getActionItem(tenantId, itemId);
    item.isActive = false;
    await this.actionItemRepository.save(item);
  }

  /**
   * Get dashboard statistics
   */
  async getStatistics(tenantId: number): Promise<{
    totalSources: number;
    totalPiiStored: number;
    activeConnections: number;
    lastUpdate: Date | null;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    recentActivity: ActionItem[];
    overdueCount: number;
  }> {
    const items = await this.actionItemRepository.find({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let overdueCount = 0;

    const now = new Date();

    for (const item of items) {
      // Count by status
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;

      // Count by priority
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;

      // Count by category
      if (item.category) {
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      }

      // Count overdue items
      if (item.dueDate && item.dueDate < now && item.status !== 'done') {
        overdueCount++;
      }
    }

    // Get recent activity (last 5 items)
    const recentActivity = items.slice(0, 5);

    // Calculate mock values for dashboard summary
    const totalSources = 6; // 6 integration sources
    const totalPiiStored = 305808; // From privacy data
    const activeConnections = Object.keys(byStatus).length > 0 ? 5 : 0;
    const lastUpdate = items.length > 0 ? items[0].updatedAt : null;

    return {
      totalSources,
      totalPiiStored,
      activeConnections,
      lastUpdate,
      byStatus,
      byPriority,
      byCategory,
      recentActivity,
      overdueCount,
    };
  }

  /**
   * Auto-generate action items from AI detection
   */
  async autoGenerateActions(tenantId: number): Promise<ActionItem[]> {
    // This would analyze timeline events, KPI thresholds, and patterns
    // to automatically create action items
    // For now, return empty array (to be implemented)

    this.logger.log(`Auto-generating action items for tenant ${tenantId}`);
    return [];
  }

  /**
   * Mark item as started
   */
  async startItem(tenantId: number, itemId: number, userId?: number): Promise<ActionItem> {
    return await this.updateActionItem(tenantId, itemId, { status: 'in_progress' }, userId);
  }

  /**
   * Mark item as done
   */
  async completeItem(
    tenantId: number,
    itemId: number,
    completionNotes?: string,
    userId?: number,
  ): Promise<ActionItem> {
    return await this.updateActionItem(
      tenantId,
      itemId,
      { status: 'done', completionNotes },
      userId,
    );
  }

  /**
   * Reopen item
   */
  async reopenItem(tenantId: number, itemId: number, userId?: number): Promise<ActionItem> {
    return await this.updateActionItem(tenantId, itemId, { status: 'open' }, userId);
  }
}
