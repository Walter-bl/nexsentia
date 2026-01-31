import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JiraConnection } from '../entities/jira-connection.entity';
import { JiraProject } from '../entities/jira-project.entity';
import { JiraIssue } from '../entities/jira-issue.entity';
import { UpdateJiraConnectionDto } from '../dto/update-jira-connection.dto';
import { QueryJiraConnectionDto } from '../dto/query-jira-connection.dto';

@Injectable()
export class JiraConnectionService {
  private readonly logger = new Logger(JiraConnectionService.name);

  constructor(
    @InjectRepository(JiraConnection)
    private readonly connectionRepository: Repository<JiraConnection>,
    @InjectRepository(JiraProject)
    private readonly projectRepository: Repository<JiraProject>,
    @InjectRepository(JiraIssue)
    private readonly issueRepository: Repository<JiraIssue>,
  ) {}

  /**
   * Get all connections for a tenant
   */
  async findAll(tenantId: number, query: QueryJiraConnectionDto): Promise<JiraConnection[]> {
    const where: any = { tenantId };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.jiraType) {
      where.jiraType = query.jiraType;
    }

    return await this.connectionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single connection
   */
  async findOne(tenantId: number, id: number): Promise<JiraConnection> {
    const connection = await this.connectionRepository.findOne({
      where: { id, tenantId },
      relations: ['projects'],
    });

    if (!connection) {
      throw new NotFoundException(`Jira connection with ID ${id} not found`);
    }

    return connection;
  }

  /**
   * Update a connection (only name and settings)
   */
  async update(
    tenantId: number,
    id: number,
    dto: UpdateJiraConnectionDto,
  ): Promise<JiraConnection> {
    const connection = await this.findOne(tenantId, id);

    Object.assign(connection, dto);
    return await this.connectionRepository.save(connection);
  }

  /**
   * Delete a connection
   */
  async remove(tenantId: number, id: number): Promise<void> {
    const connection = await this.findOne(tenantId, id);
    await this.connectionRepository.softRemove(connection);
  }


  /**
   * Get statistics for a connection
   */
  async getConnectionStats(tenantId: number, id: number): Promise<any> {
    const connection = await this.findOne(tenantId, id);

    const totalProjects = await this.projectRepository.count({
      where: { tenantId, connectionId: id },
    });

    const activeProjects = await this.projectRepository.count({
      where: { tenantId, connectionId: id, isActive: true },
    });

    const totalIssues = await this.issueRepository.count({
      where: { tenantId },
      relations: ['project'],
    });

    // Get issues by status
    const issuesByStatus = await this.issueRepository
      .createQueryBuilder('issue')
      .select('issue.status', 'status')
      .addSelect('COUNT(issue.id)', 'count')
      .innerJoin('issue.project', 'project')
      .where('project.connectionId = :connectionId', { connectionId: id })
      .andWhere('issue.tenantId = :tenantId', { tenantId })
      .groupBy('issue.status')
      .getRawMany();

    // Get issues by type
    const issuesByType = await this.issueRepository
      .createQueryBuilder('issue')
      .select('issue.issueType', 'type')
      .addSelect('COUNT(issue.id)', 'count')
      .innerJoin('issue.project', 'project')
      .where('project.connectionId = :connectionId', { connectionId: id })
      .andWhere('issue.tenantId = :tenantId', { tenantId })
      .groupBy('issue.issueType')
      .getRawMany();

    // Get issues by priority
    const issuesByPriority = await this.issueRepository
      .createQueryBuilder('issue')
      .select('issue.priority', 'priority')
      .addSelect('COUNT(issue.id)', 'count')
      .innerJoin('issue.project', 'project')
      .where('project.connectionId = :connectionId', { connectionId: id })
      .andWhere('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.priority IS NOT NULL')
      .groupBy('issue.priority')
      .getRawMany();

    return {
      connection: {
        id: connection.id,
        name: connection.name,
        lastSyncAt: connection.lastSyncAt,
        lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
        totalIssuesSynced: connection.totalIssuesSynced,
      },
      projects: {
        total: totalProjects,
        active: activeProjects,
      },
      issues: {
        total: totalIssues,
        byStatus: issuesByStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
        byType: issuesByType.reduce((acc, item) => {
          acc[item.type] = parseInt(item.count);
          return acc;
        }, {}),
        byPriority: issuesByPriority.reduce((acc, item) => {
          acc[item.priority] = parseInt(item.count);
          return acc;
        }, {}),
      },
    };
  }

  /**
   * Get projects for a connection
   */
  async getProjects(tenantId: number, connectionId: number): Promise<JiraProject[]> {
    return await this.projectRepository.find({
      where: { tenantId, connectionId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Toggle connection active status
   */
  async toggleActive(tenantId: number, id: number): Promise<JiraConnection> {
    const connection = await this.findOne(tenantId, id);
    connection.isActive = !connection.isActive;
    return await this.connectionRepository.save(connection);
  }
}
