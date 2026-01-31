import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JiraConnection } from '../entities/jira-connection.entity';
import { JiraProject } from '../entities/jira-project.entity';
import { JiraIssue } from '../entities/jira-issue.entity';
import { JiraSyncHistory } from '../entities/jira-sync-history.entity';
import { JiraWebhookDto } from '../dto/jira-webhook.dto';
import { JiraApiClientService } from './jira-api-client.service';
import { JiraOAuthService } from './jira-oauth.service';
import { JiraApiConfig } from '../interfaces/jira-api.interface';

@Injectable()
export class JiraWebhookService {
  private readonly logger = new Logger(JiraWebhookService.name);

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
  ) {}

  /**
   * Process incoming webhook from Jira
   */
  async processWebhook(webhookData: JiraWebhookDto): Promise<void> {
    this.logger.log(`Processing Jira webhook: ${webhookData.webhookEvent}`);

    try {
      // Handle different webhook events
      switch (webhookData.webhookEvent) {
        case 'jira:issue_created':
          await this.handleIssueCreated(webhookData);
          break;
        case 'jira:issue_updated':
          await this.handleIssueUpdated(webhookData);
          break;
        case 'jira:issue_deleted':
          await this.handleIssueDeleted(webhookData);
          break;
        default:
          this.logger.debug(`Unhandled webhook event: ${webhookData.webhookEvent}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle issue created event
   */
  private async handleIssueCreated(webhookData: JiraWebhookDto): Promise<void> {
    if (!webhookData.issue) {
      this.logger.warn('Issue created webhook received without issue data');
      return;
    }

    const issueKey = webhookData.issue.key;
    const projectKey = issueKey.split('-')[0];

    this.logger.log(`Handling issue created: ${issueKey}`);

    // Find the project
    const project = await this.projectRepository.findOne({
      where: { jiraProjectKey: projectKey },
      relations: ['connection'],
    });

    if (!project) {
      this.logger.warn(`Project ${projectKey} not found, skipping issue ${issueKey}`);
      return;
    }

    // Fetch full issue details from Jira API
    const accessToken = await this.jiraOAuthService.getValidAccessToken(project.connection);
    const apiConfig: JiraApiConfig = {
      cloudId: project.connection.oauthMetadata.cloudId,
      oauthToken: accessToken,
    };

    try {
      const fullIssue = await this.jiraApiClient.getIssue(apiConfig, issueKey);
      await this.saveIssueFromWebhook(project, fullIssue);

      // Log webhook sync
      await this.logWebhookSync(project.connection, 'issue_created', issueKey);
    } catch (error) {
      this.logger.error(`Failed to fetch issue ${issueKey}: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle issue updated event
   */
  private async handleIssueUpdated(webhookData: JiraWebhookDto): Promise<void> {
    if (!webhookData.issue) {
      this.logger.warn('Issue updated webhook received without issue data');
      return;
    }

    const issueKey = webhookData.issue.key;
    const projectKey = issueKey.split('-')[0];

    this.logger.log(`Handling issue updated: ${issueKey}`);

    // Find the project
    const project = await this.projectRepository.findOne({
      where: { jiraProjectKey: projectKey },
      relations: ['connection'],
    });

    if (!project) {
      this.logger.warn(`Project ${projectKey} not found, skipping issue ${issueKey}`);
      return;
    }

    // Fetch full issue details from Jira API
    const accessToken = await this.jiraOAuthService.getValidAccessToken(project.connection);
    const apiConfig: JiraApiConfig = {
      cloudId: project.connection.oauthMetadata.cloudId,
      oauthToken: accessToken,
    };

    try {
      const fullIssue = await this.jiraApiClient.getIssue(apiConfig, issueKey);
      await this.saveIssueFromWebhook(project, fullIssue);

      // Log webhook sync
      await this.logWebhookSync(project.connection, 'issue_updated', issueKey);
    } catch (error) {
      this.logger.error(`Failed to fetch issue ${issueKey}: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle issue deleted event
   */
  private async handleIssueDeleted(webhookData: JiraWebhookDto): Promise<void> {
    if (!webhookData.issue) {
      this.logger.warn('Issue deleted webhook received without issue data');
      return;
    }

    const issueId = webhookData.issue.id;
    const issueKey = webhookData.issue.key;

    this.logger.log(`Handling issue deleted: ${issueKey}`);

    // Find and soft delete the issue
    const issue = await this.issueRepository.findOne({
      where: { jiraIssueId: issueId },
      relations: ['project', 'project.connection'],
    });

    if (issue) {
      await this.issueRepository.softRemove(issue);

      // Log webhook sync
      await this.logWebhookSync(issue.project.connection, 'issue_deleted', issueKey);
    }
  }

  /**
   * Save issue from webhook data
   */
  private async saveIssueFromWebhook(project: JiraProject, jiraIssue: any): Promise<void> {
    const fields = jiraIssue.fields;

    // Check if issue already exists
    let issue = await this.issueRepository.findOne({
      where: { jiraIssueId: jiraIssue.id },
    });

    const issueData = {
      tenantId: project.tenantId,
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
      comments: project.connection.syncSettings?.syncComments
        ? this.extractComments(fields.comment)
        : undefined,
      attachments: project.connection.syncSettings?.syncAttachments
        ? this.extractAttachments(fields.attachment)
        : undefined,
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
   * Log webhook sync in history
   */
  private async logWebhookSync(
    connection: JiraConnection,
    eventType: string,
    issueKey: string,
  ): Promise<void> {
    const syncHistory = this.syncHistoryRepository.create({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      syncType: 'webhook',
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      totalIssuesProcessed: 1,
      issuesUpdated: 1,
      syncStats: {
        duration: 0,
        apiCallsCount: 1,
        projectKeys: [issueKey.split('-')[0]],
      } as any,
    });

    await this.syncHistoryRepository.save(syncHistory);
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
}
