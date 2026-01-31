import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { JiraConnection } from '../entities/jira-connection.entity';
import { JiraProject } from '../entities/jira-project.entity';
import { JiraIssue } from '../entities/jira-issue.entity';
import { JiraSyncHistory } from '../entities/jira-sync-history.entity';
import { JiraApiClientService } from './jira-api-client.service';
import { JiraOAuthService } from './jira-oauth.service';
import { JiraApiConfig } from '../interfaces/jira-api.interface';

@Injectable()
export class JiraIngestionService {
  private readonly logger = new Logger(JiraIngestionService.name);
  private readonly activeSyncs = new Map<number, boolean>();
  private readonly defaultSyncInterval: number;

  constructor(
    @InjectRepository(JiraConnection)
    private readonly connectionRepository: Repository<JiraConnection>,
    @InjectRepository(JiraProject)
    private readonly projectRepository: Repository<JiraProject>,
    @InjectRepository(JiraIssue)
    private readonly issueRepository: Repository<JiraIssue>,
    @InjectRepository(JiraSyncHistory)
    private readonly syncHistoryRepository: Repository<JiraSyncHistory>,
    private readonly jiraApiClient: JiraApiClientService,
    private readonly jiraOAuthService: JiraOAuthService,
    private readonly configService: ConfigService,
  ) {
    // Load default sync interval from environment variable
    this.defaultSyncInterval = this.configService.get<number>('JIRA_SYNC_INTERVAL_MINUTES', 15);
    this.logger.log(`Jira sync default interval: ${this.defaultSyncInterval} minutes`);
  }

  /**
   * Scheduled job to sync all active connections
   * Runs based on JIRA_SYNC_CRON_SCHEDULE environment variable (default: every 10 minutes)
   */
  @Cron(process.env.JIRA_SYNC_CRON_SCHEDULE || '*/10 * * * *')
  async handleScheduledSync() {
    this.logger.log('Starting scheduled sync for all active connections');

    const activeConnections = await this.connectionRepository.find({
      where: { isActive: true },
    });

    for (const connection of activeConnections) {
      const syncSettings = connection.syncSettings || {};

      // Skip if autoSync is disabled
      if (syncSettings.autoSync === false) {
        continue;
      }

      // Check if it's time to sync based on syncInterval
      // Use connection-specific interval, or fall back to environment variable default
      const syncInterval = syncSettings.syncInterval || this.defaultSyncInterval;

      // Use lastSuccessfulSyncAt if available, otherwise use lastSyncAt
      // This ensures failed syncs are retried immediately
      const lastSync = connection.lastSuccessfulSyncAt || connection.lastSyncAt;

      if (lastSync) {
        const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
        if (minutesSinceLastSync < syncInterval) {
          this.logger.debug(
            `Skipping connection ${connection.id} - last successful sync was ${minutesSinceLastSync.toFixed(1)} minutes ago`,
          );
          continue;
        }
      }

      // Trigger sync without blocking
      this.syncConnection(connection.tenantId, connection.id, 'incremental').catch((error) => {
        this.logger.error(`Failed to sync connection ${connection.id}: ${error.message}`, error.stack);
      });
    }
  }

  /**
   * Sync a specific connection
   */
  async syncConnection(
    tenantId: number,
    connectionId: number,
    syncType: 'full' | 'incremental' = 'incremental',
    projectKeys?: string[],
  ): Promise<JiraSyncHistory> {
    // Check if sync is already in progress
    if (this.activeSyncs.get(connectionId)) {
      throw new Error(`Sync already in progress for connection ${connectionId}`);
    }

    this.activeSyncs.set(connectionId, true);

    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      this.activeSyncs.delete(connectionId);
      throw new Error(`Connection ${connectionId} not found`);
    }

    // DEBUG: Log sync type and last successful sync timestamp
    this.logger.log(
      `🔍 Starting sync for connection ${connectionId} | Type: ${syncType} | lastSuccessfulSyncAt: ${connection.lastSuccessfulSyncAt ? connection.lastSuccessfulSyncAt.toISOString() : 'NONE'}`,
    );

    // Create sync history record
    const syncHistory = this.syncHistoryRepository.create({
      tenantId,
      connectionId,
      syncType,
      status: 'in_progress',
      startedAt: new Date(),
    });

    await this.syncHistoryRepository.save(syncHistory);

    const startTime = Date.now();

    try {
      this.logger.log(`Starting ${syncType} sync for connection ${connectionId}`);

      // Update connection
      connection.lastSyncAt = new Date();
      await this.connectionRepository.save(connection);

      // Create API config and refresh OAuth token if needed
      const apiConfig = await this.createApiConfig(connection);

      // Test connection
      const isConnected = await this.jiraApiClient.testConnection(apiConfig);
      if (!isConnected) {
        throw new Error('Failed to connect to Jira instance');
      }

      // Sync projects
      const projectsToSync = projectKeys || connection.syncSettings?.projectFilter;
      await this.syncProjects(tenantId, connection, apiConfig, projectsToSync);

      // Sync issues
      const stats = await this.syncIssues(
        tenantId,
        connection,
        apiConfig,
        syncType,
        projectsToSync,
      );

      // Update sync history
      const duration = (Date.now() - startTime) / 1000;
      syncHistory.status = 'completed';
      syncHistory.completedAt = new Date();
      syncHistory.projectsProcessed = stats.projectsProcessed;
      syncHistory.issuesCreated = stats.issuesCreated;
      syncHistory.issuesUpdated = stats.issuesUpdated;
      syncHistory.totalIssuesProcessed = stats.totalIssuesProcessed;
      syncHistory.syncStats = {
        duration,
        apiCallsCount: stats.apiCallsCount,
        projectKeys: stats.projectKeys,
      };

      await this.syncHistoryRepository.save(syncHistory);

      // Update connection
      connection.lastSuccessfulSyncAt = new Date();
      connection.totalIssuesSynced = stats.totalIssuesProcessed;
      connection.failedSyncAttempts = 0;
      connection.lastSyncError = undefined;
      await this.connectionRepository.save(connection);

      this.logger.log(
        `✅ Sync completed for connection ${connectionId} in ${duration.toFixed(2)}s\n` +
          `   📊 Stats: ${stats.totalIssuesProcessed} total issues | ${stats.issuesCreated} created | ${stats.issuesUpdated} updated\n` +
          `   📁 Projects: ${stats.projectKeys.join(', ')}\n` +
          `   🔄 API calls: ${stats.apiCallsCount}`,
      );

      return syncHistory;
    } catch (error) {
      this.logger.error(`Sync failed for connection ${connectionId}: ${error.message}`, error.stack);

      // Update sync history
      syncHistory.status = 'failed';
      syncHistory.completedAt = new Date();
      syncHistory.errorMessage = error.message;
      syncHistory.errorDetails = {
        stack: error.stack,
        name: error.name,
      };
      await this.syncHistoryRepository.save(syncHistory);

      // Update connection
      connection.failedSyncAttempts += 1;
      connection.lastSyncError = error.message;
      await this.connectionRepository.save(connection);

      throw error;
    } finally {
      this.activeSyncs.delete(connectionId);
    }
  }

  /**
   * Sync projects from Jira
   */
  private async syncProjects(
    tenantId: number,
    connection: JiraConnection,
    apiConfig: JiraApiConfig,
    projectKeys?: string[],
  ): Promise<void> {
    this.logger.debug(`Syncing projects for connection ${connection.id}`);

    const jiraProjects = await this.jiraApiClient.getProjects(apiConfig);

    for (const jiraProject of jiraProjects) {
      // Filter by project keys if specified
      if (projectKeys && projectKeys.length > 0 && !projectKeys.includes(jiraProject.key)) {
        continue;
      }

      // Check if project already exists
      let project = await this.projectRepository.findOne({
        where: {
          tenantId,
          connectionId: connection.id,
          jiraProjectId: jiraProject.id,
        },
      });

      if (project) {
        // Update existing project
        project.name = jiraProject.name;
        project.description = jiraProject.description || undefined;
        project.projectTypeKey = jiraProject.projectTypeKey;
        project.avatarUrl = jiraProject.avatarUrls?.['48x48'] || undefined;
        project.leadAccountId = jiraProject.lead?.accountId || undefined;
        project.leadDisplayName = jiraProject.lead?.displayName || undefined;
        project.lastSyncedAt = new Date();
      } else {
        // Create new project
        project = this.projectRepository.create({
          tenantId,
          connectionId: connection.id,
          jiraProjectId: jiraProject.id,
          jiraProjectKey: jiraProject.key,
          name: jiraProject.name,
          description: jiraProject.description,
          projectTypeKey: jiraProject.projectTypeKey,
          avatarUrl: jiraProject.avatarUrls?.['48x48'],
          leadAccountId: jiraProject.lead?.accountId,
          leadDisplayName: jiraProject.lead?.displayName,
          lastSyncedAt: new Date(),
        });
      }

      await this.projectRepository.save(project);
    }
  }

  /**
   * Sync issues from Jira
   */
  private async syncIssues(
    tenantId: number,
    connection: JiraConnection,
    apiConfig: JiraApiConfig,
    syncType: 'full' | 'incremental',
    projectKeys?: string[],
  ): Promise<{
    projectsProcessed: number;
    issuesCreated: number;
    issuesUpdated: number;
    totalIssuesProcessed: number;
    apiCallsCount: number;
    projectKeys: string[];
  }> {
    const stats = {
      projectsProcessed: 0,
      issuesCreated: 0,
      issuesUpdated: 0,
      totalIssuesProcessed: 0,
      apiCallsCount: 0,
      projectKeys: [] as string[],
    };

    // Get projects to sync
    const whereClause: any = {
      tenantId,
      connectionId: connection.id,
      isActive: true,
    };

    if (projectKeys && projectKeys.length > 0) {
      whereClause.jiraProjectKey = In(projectKeys);
    }

    const projects = await this.projectRepository.find({ where: whereClause });

    for (const project of projects) {
      this.logger.debug(`Syncing issues for project ${project.jiraProjectKey}`);

      stats.projectsProcessed += 1;
      stats.projectKeys.push(project.jiraProjectKey);

      let startAt = 0;
      const maxResults = 50;
      let hasMore = true;
      const maxIssuesPerProject = this.configService.get<number>('JIRA_MAX_ISSUES_PER_SYNC', 1000);
      let issuesProcessedForProject = 0;

      while (hasMore && issuesProcessedForProject < maxIssuesPerProject) {
        let searchResult;

        // DEBUG: Log the condition check
        const isIncremental = syncType === 'incremental';
        const hasLastSync = !!connection.lastSuccessfulSyncAt;
        this.logger.debug(
          `[${project.jiraProjectKey}] Sync decision: syncType='${syncType}' (isIncremental=${isIncremental}) | lastSuccessfulSyncAt=${connection.lastSuccessfulSyncAt ? connection.lastSuccessfulSyncAt.toISOString() : 'NULL'} (hasLastSync=${hasLastSync})`,
        );

        if (syncType === 'incremental' && connection.lastSuccessfulSyncAt) {
          // Get issues updated since last sync
          this.logger.log(
            `[${project.jiraProjectKey}] ✅ Using INCREMENTAL sync - fetching updates since ${connection.lastSuccessfulSyncAt.toISOString()} (startAt: ${startAt})`,
          );
          searchResult = await this.jiraApiClient.getIssuesUpdatedSince(
            apiConfig,
            connection.lastSuccessfulSyncAt,
            [project.jiraProjectKey],
            startAt,
            maxResults,
          );
        } else {
          // Full sync - get all issues
          this.logger.log(
            `[${project.jiraProjectKey}] ⚠️ Using FULL sync - fetching all issues (startAt: ${startAt}) | Reason: ${!isIncremental ? 'syncType is not incremental' : 'lastSuccessfulSyncAt is NULL'}`,
          );
          searchResult = await this.jiraApiClient.getProjectIssues(
            apiConfig,
            project.jiraProjectKey,
            startAt,
            maxResults,
          );
        }

        stats.apiCallsCount += 1;

        this.logger.log(
          `[${project.jiraProjectKey}] Retrieved ${searchResult.issues.length} issues (total so far: ${stats.totalIssuesProcessed})`,
        );

        for (const jiraIssue of searchResult.issues) {
          try {
            await this.saveIssue(tenantId, project, jiraIssue, connection.syncSettings);
            stats.totalIssuesProcessed += 1;
            issuesProcessedForProject += 1;

            // Check if issue already exists to determine if it's created or updated
            const existingIssue = await this.issueRepository.findOne({
              where: { jiraIssueId: jiraIssue.id },
            });

            if (existingIssue) {
              stats.issuesUpdated += 1;
            } else {
              stats.issuesCreated += 1;
            }
          } catch (error) {
            this.logger.error(
              `Failed to save issue ${jiraIssue.key}: ${error.message}`,
              error.stack,
            );
          }
        }

        startAt += maxResults;
        hasMore = searchResult.issues.length === maxResults;

        // Check if we've hit the max limit
        if (issuesProcessedForProject >= maxIssuesPerProject) {
          this.logger.warn(
            `[${project.jiraProjectKey}] Reached maximum issue limit (${maxIssuesPerProject}). Stopping sync for this project.`,
          );
          hasMore = false;
        }

        this.logger.log(
          `[${project.jiraProjectKey}] Batch complete. Created: ${stats.issuesCreated}, Updated: ${stats.issuesUpdated}. ${hasMore ? 'Fetching next batch...' : 'Sync complete for this project.'}`,
        );
      }

      // Log if we hit the limit
      if (issuesProcessedForProject >= maxIssuesPerProject) {
        this.logger.warn(
          `[${project.jiraProjectKey}] Partial sync completed. Processed ${issuesProcessedForProject} out of potentially more issues.`,
        );
      }

      // Update project stats
      const issueCount = await this.issueRepository.count({
        where: { projectId: project.id },
      });
      project.totalIssues = issueCount;
      project.lastSyncedAt = new Date();
      await this.projectRepository.save(project);
    }

    return stats;
  }

  /**
   * Save or update an issue
   */
  private async saveIssue(
    tenantId: number,
    project: JiraProject,
    jiraIssue: any,
    syncSettings?: any,
  ): Promise<void> {
    // Validate that jiraIssue has the required structure
    if (!jiraIssue || !jiraIssue.fields) {
      this.logger.warn(
        `Skipping issue ${jiraIssue?.id || 'unknown'} (${jiraIssue?.key || 'unknown'}) - missing fields property. Issue keys: ${Object.keys(jiraIssue || {}).join(', ')}`,
      );
      return;
    }

    const fields = jiraIssue.fields;

    // Log issue type for debugging
    this.logger.debug(
      `Processing issue ${jiraIssue.key} - Type: ${fields.issuetype?.name || 'unknown'}`,
    );

    // Check if issue already exists
    let issue = await this.issueRepository.findOne({
      where: { jiraIssueId: jiraIssue.id },
    });

    // Apply filters from sync settings
    if (syncSettings) {
      if (syncSettings.issueTypeFilter?.length > 0) {
        if (!fields.issuetype || !syncSettings.issueTypeFilter.includes(fields.issuetype.name)) {
          return; // Skip this issue
        }
      }

      if (syncSettings.statusFilter?.length > 0) {
        if (!fields.status || !syncSettings.statusFilter.includes(fields.status.name)) {
          return; // Skip this issue
        }
      }
    }

    const issueData = {
      tenantId,
      projectId: project.id,
      jiraIssueId: jiraIssue.id,
      jiraIssueKey: jiraIssue.key,
      summary: fields.summary,
      description: this.extractDescription(fields.description),
      issueType: fields.issuetype.name,
      status: fields.status.name,
      priority: fields.priority?.name,
      resolution: fields.resolution?.name,
      reporterAccountId: fields.reporter?.accountId,
      reporterDisplayName: fields.reporter?.displayName,
      reporterEmail: fields.reporter?.emailAddress,
      assigneeAccountId: fields.assignee?.accountId,
      assigneeDisplayName: fields.assignee?.displayName,
      assigneeEmail: fields.assignee?.emailAddress,
      labels: fields.labels || [],
      components: fields.components || [],
      parentIssueKey: fields.parent?.key,
      storyPoints: fields.customfield_10016 || undefined,
      timeEstimate: fields.timeestimate,
      timeSpent: fields.timespent,
      dueDate: fields.duedate ? new Date(fields.duedate) : undefined,
      jiraCreatedAt: new Date(fields.created),
      jiraUpdatedAt: new Date(fields.updated),
      resolvedAt: fields.resolutiondate ? new Date(fields.resolutiondate) : undefined,
      customFields: this.extractCustomFields(fields),
      comments: syncSettings?.syncComments ? this.extractComments(fields.comment) : undefined,
      attachments: syncSettings?.syncAttachments ? this.extractAttachments(fields.attachment) : undefined,
      changelog: this.extractChangelog(jiraIssue.changelog),
      lastSyncedAt: new Date(),
    };

    if (issue) {
      Object.assign(issue, issueData);
    } else {
      issue = this.issueRepository.create(issueData);
    }

    await this.issueRepository.save(issue);
  }

  /**
   * Extract description from Jira format
   */
  private extractDescription(description: any): string | undefined {
    if (!description) return undefined;

    if (typeof description === 'string') {
      return description;
    }

    // Handle Atlassian Document Format (ADF)
    if (description.type === 'doc' && description.content) {
      return this.extractTextFromADF(description);
    }

    return JSON.stringify(description);
  }

  /**
   * Extract text from Atlassian Document Format
   */
  private extractTextFromADF(adf: any): string {
    if (!adf.content) return '';

    const textParts: string[] = [];

    const traverse = (node: any) => {
      if (node.type === 'text' && node.text) {
        textParts.push(node.text);
      }

      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
    };

    adf.content.forEach(traverse);

    return textParts.join(' ');
  }

  /**
   * Extract custom fields
   */
  private extractCustomFields(fields: any): Record<string, any> {
    const customFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('customfield_')) {
        customFields[key] = value;
      }
    }

    return customFields;
  }

  /**
   * Extract comments
   */
  private extractComments(commentData: any): any[] | undefined {
    if (!commentData || !commentData.comments) return undefined;

    return commentData.comments.map((comment: any) => ({
      id: comment.id,
      author: comment.author.displayName,
      body: this.extractDescription(comment.body),
      created: comment.created,
      updated: comment.updated,
    }));
  }

  /**
   * Extract attachments
   */
  private extractAttachments(attachmentData: any): any[] | undefined {
    if (!attachmentData || !Array.isArray(attachmentData)) return undefined;

    return attachmentData.map((attachment: any) => ({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      created: attachment.created,
      author: attachment.author.displayName,
    }));
  }

  /**
   * Extract changelog
   */
  private extractChangelog(changelogData: any): any[] | undefined {
    if (!changelogData || !changelogData.histories) return undefined;

    return changelogData.histories.map((history: any) => ({
      id: history.id,
      author: history.author.displayName,
      created: history.created,
      items: history.items,
    }));
  }

  /**
   * Get sync history for a connection
   */
  async getSyncHistory(
    tenantId: number,
    connectionId: number,
    limit: number = 10,
  ): Promise<JiraSyncHistory[]> {
    return this.syncHistoryRepository.find({
      where: { tenantId, connectionId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(connectionId: number): boolean {
    return this.activeSyncs.get(connectionId) || false;
  }

  /**
   * Create API config from connection, handling OAuth token refresh
   */
  private async createApiConfig(connection: JiraConnection): Promise<JiraApiConfig> {
    // Refresh OAuth token if needed
    const refreshedConnection = await this.jiraOAuthService.refreshTokenIfNeeded(connection);

    return {
      cloudId: refreshedConnection.oauthMetadata.cloudId,
      oauthToken: refreshedConnection.oauthAccessToken,
    };
  }
}
