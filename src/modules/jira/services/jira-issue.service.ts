import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, In, Between } from 'typeorm';
import { JiraIssue } from '../entities/jira-issue.entity';
import { QueryJiraIssueDto } from '../dto/query-jira-issue.dto';

@Injectable()
export class JiraIssueService {
  constructor(
    @InjectRepository(JiraIssue)
    private readonly issueRepository: Repository<JiraIssue>,
  ) {}

  /**
   * Find all issues with pagination and filtering
   */
  async findAll(tenantId: number, query: QueryJiraIssueDto) {
    const { page = 1, limit = 20, search, fromDate, toDate, labels, ...filters } = query;

    const where: FindOptionsWhere<JiraIssue> = { tenantId };

    // Apply filters
    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.issueType) {
      where.issueType = filters.issueType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.assigneeAccountId) {
      where.assigneeAccountId = filters.assigneeAccountId;
    }

    if (filters.reporterAccountId) {
      where.reporterAccountId = filters.reporterAccountId;
    }

    // Build query
    const queryBuilder = this.issueRepository
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.project', 'project')
      .where(where);

    // Search in summary and description
    if (search) {
      queryBuilder.andWhere(
        '(issue.summary LIKE :search OR issue.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filter by labels
    if (labels && labels.length > 0) {
      // MySQL JSON array search
      const labelParams: Record<string, string> = {};
      labels.forEach((label, index) => {
        labelParams[`label${index}`] = JSON.stringify(label);
      });

      queryBuilder.andWhere(
        labels.map((_, index) => `JSON_CONTAINS(issue.labels, :label${index})`).join(' OR '),
        labelParams,
      );
    }

    // Date range filter
    if (fromDate && toDate) {
      queryBuilder.andWhere('issue.jiraUpdatedAt BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
      });
    } else if (fromDate) {
      queryBuilder.andWhere('issue.jiraUpdatedAt >= :fromDate', {
        fromDate: new Date(fromDate),
      });
    } else if (toDate) {
      queryBuilder.andWhere('issue.jiraUpdatedAt <= :toDate', {
        toDate: new Date(toDate),
      });
    }

    // Pagination
    const [items, total] = await queryBuilder
      .orderBy('issue.jiraUpdatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find a single issue
   */
  async findOne(tenantId: number, id: number): Promise<JiraIssue> {
    const issue = await this.issueRepository.findOne({
      where: { id, tenantId },
      relations: ['project'],
    });

    if (!issue) {
      throw new NotFoundException(`Jira issue with ID ${id} not found`);
    }

    return issue;
  }

  /**
   * Find issue by Jira key
   */
  async findByKey(tenantId: number, jiraIssueKey: string): Promise<JiraIssue> {
    const issue = await this.issueRepository.findOne({
      where: { jiraIssueKey, tenantId },
      relations: ['project'],
    });

    if (!issue) {
      throw new NotFoundException(`Jira issue with key ${jiraIssueKey} not found`);
    }

    return issue;
  }

  /**
   * Get issues by project
   */
  async findByProject(tenantId: number, projectId: number, limit: number = 100): Promise<JiraIssue[]> {
    return await this.issueRepository.find({
      where: { tenantId, projectId },
      order: { jiraUpdatedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get recently updated issues
   */
  async findRecentlyUpdated(tenantId: number, hours: number = 24, limit: number = 50): Promise<JiraIssue[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return await this.issueRepository.find({
      where: {
        tenantId,
        jiraUpdatedAt: Between(since, new Date()),
      },
      relations: ['project'],
      order: { jiraUpdatedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get issues by assignee
   */
  async findByAssignee(tenantId: number, assigneeAccountId: string, limit: number = 100): Promise<JiraIssue[]> {
    return await this.issueRepository.find({
      where: { tenantId, assigneeAccountId },
      relations: ['project'],
      order: { jiraUpdatedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get issues by status
   */
  async findByStatus(tenantId: number, status: string, limit: number = 100): Promise<JiraIssue[]> {
    return await this.issueRepository.find({
      where: { tenantId, status },
      relations: ['project'],
      order: { jiraUpdatedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get issue statistics for a tenant
   */
  async getStatistics(tenantId: number) {
    const total = await this.issueRepository.count({ where: { tenantId } });

    // Get counts by status
    const byStatus = await this.issueRepository
      .createQueryBuilder('issue')
      .select('issue.status', 'status')
      .addSelect('COUNT(issue.id)', 'count')
      .where('issue.tenantId = :tenantId', { tenantId })
      .groupBy('issue.status')
      .getRawMany();

    // Get counts by type
    const byType = await this.issueRepository
      .createQueryBuilder('issue')
      .select('issue.issueType', 'type')
      .addSelect('COUNT(issue.id)', 'count')
      .where('issue.tenantId = :tenantId', { tenantId })
      .groupBy('issue.issueType')
      .getRawMany();

    // Get counts by priority
    const byPriority = await this.issueRepository
      .createQueryBuilder('issue')
      .select('issue.priority', 'priority')
      .addSelect('COUNT(issue.id)', 'count')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.priority IS NOT NULL')
      .groupBy('issue.priority')
      .getRawMany();

    // Get counts by project
    const byProject = await this.issueRepository
      .createQueryBuilder('issue')
      .select('project.name', 'projectName')
      .addSelect('project.jiraProjectKey', 'projectKey')
      .addSelect('COUNT(issue.id)', 'count')
      .innerJoin('issue.project', 'project')
      .where('issue.tenantId = :tenantId', { tenantId })
      .groupBy('project.id')
      .getRawMany();

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
      byType: byType.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item.priority] = parseInt(item.count);
        return acc;
      }, {}),
      byProject: byProject.map(item => ({
        projectName: item.projectName,
        projectKey: item.projectKey,
        count: parseInt(item.count),
      })),
    };
  }
}
