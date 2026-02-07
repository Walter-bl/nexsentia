import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { MetricValue } from '../../kpi/entities/metric-value.entity';

export interface GeneratedTimelineEvent {
  id: string;
  title: string;
  description: string;
  eventDate: Date;
  impactLevel: 'high' | 'medium' | 'low';
  category: string;
  sourceType: string;
  sourceId: string;
  isResolved: boolean;
  metadata?: any;
  aiAnalysis?: any;
  affectedSystems?: string[];
  detectionConfidence?: number;
}

@Injectable()
export class TimelineGeneratorService {
  private readonly logger = new Logger(TimelineGeneratorService.name);

  constructor(
    @InjectRepository(JiraIssue)
    private readonly jiraIssueRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowIncidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(SlackMessage)
    private readonly slackMessageRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsMessageRepository: Repository<TeamsMessage>,
    @InjectRepository(MetricValue)
    private readonly metricValueRepository: Repository<MetricValue>,
  ) {}

  /**
   * Generate all timeline events from ingested data
   */
  async generateTimelineEvents(
    tenantId: number,
    options?: {
      startDate?: Date;
      endDate?: Date;
      impactLevel?: 'high' | 'medium' | 'low';
      category?: string;
      isResolved?: boolean;
    },
  ): Promise<GeneratedTimelineEvent[]> {
    this.logger.log(`Generating timeline events for tenant ${tenantId}`);

    const [
      jiraEvents,
      serviceNowEvents,
      communicationEvents,
      performanceEvents,
    ] = await Promise.all([
      this.generateJiraEvents(tenantId, options),
      this.generateServiceNowEvents(tenantId, options),
      this.generateCommunicationEvents(tenantId, options),
      this.generatePerformanceEvents(tenantId, options),
    ]);

    let allEvents = [
      ...jiraEvents,
      ...serviceNowEvents,
      ...communicationEvents,
      ...performanceEvents,
    ];

    // Apply filters
    if (options?.impactLevel) {
      allEvents = allEvents.filter(e => e.impactLevel === options.impactLevel);
    }

    if (options?.category) {
      allEvents = allEvents.filter(e => e.category === options.category);
    }

    if (options?.isResolved !== undefined) {
      allEvents = allEvents.filter(e => e.isResolved === options.isResolved);
    }

    // Sort by date (most recent first) and impact level
    allEvents.sort((a, b) => {
      const dateDiff = b.eventDate.getTime() - a.eventDate.getTime();
      if (dateDiff !== 0) return dateDiff;

      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impactLevel] - impactOrder[b.impactLevel];
    });

    return allEvents;
  }

  /**
   * Generate timeline events from Jira issues
   */
  private async generateJiraEvents(
    tenantId: number,
    options?: any,
  ): Promise<GeneratedTimelineEvent[]> {
    const where: any = { tenantId };

    // Date range
    if (options?.startDate && options?.endDate) {
      where.jiraCreatedAt = Between(options.startDate, options.endDate);
    } else if (options?.startDate) {
      where.jiraCreatedAt = MoreThan(options.startDate);
    } else if (options?.endDate) {
      where.jiraCreatedAt = LessThan(options.endDate);
    }

    const significantIssues = await this.jiraIssueRepository.find({
      where,
      order: { jiraCreatedAt: 'DESC' },
      take: 100,
    });

    return significantIssues
      .map(issue => ({
        id: `jira_${issue.id}`,
        title: `Issue Created: ${issue.summary}`,
        description: issue.description || `Jira issue ${issue.jiraIssueKey} was created`,
        eventDate: issue.jiraCreatedAt || issue.createdAt,
        impactLevel: this.mapJiraPriorityToImpact(issue.priority || 'medium'),
        category: 'Engineering',
        sourceType: 'jira',
        sourceId: issue.jiraIssueKey,
        isResolved: this.isJiraIssueResolved(issue.status),
        metadata: {
          issueType: issue.issueType,
          status: issue.status,
          priority: issue.priority,
          assignee: issue.assigneeDisplayName,
          projectId: issue.projectId,
        },
        aiAnalysis: {
          detectedPattern: 'critical_engineering_issue',
          severity: this.mapJiraPriorityToImpact(issue.priority || 'medium'),
          rootCause: `High priority ${issue.issueType} detected in project ${issue.projectId}`,
          predictedImpact: this.getJiraIssueImpact(issue),
          suggestedActions: [
            'Review issue details and assign to appropriate team',
            'Assess impact on current sprint goals',
            'Communicate status to stakeholders',
          ],
        },
        affectedSystems: issue.labels || ['Engineering'],
        detectionConfidence: 0.92,
      }));
  }

  /**
   * Generate timeline events from ServiceNow incidents
   */
  private async generateServiceNowEvents(
    tenantId: number,
    options?: any,
  ): Promise<GeneratedTimelineEvent[]> {
    const where: any = { tenantId };

    // Date range
    if (options?.startDate && options?.endDate) {
      where.sysCreatedOn = Between(options.startDate, options.endDate);
    } else if (options?.startDate) {
      where.sysCreatedOn = MoreThan(options.startDate);
    } else if (options?.endDate) {
      where.sysCreatedOn = LessThan(options.endDate);
    }

    const incidents = await this.serviceNowIncidentRepository.find({
      where,
      order: { sysCreatedOn: 'DESC' },
      take: 100,
    });

    return incidents
      .map(incident => ({
        id: `servicenow_${incident.id}`,
        title: `Incident: ${incident.shortDescription || 'Critical System Issue'}`,
        description: incident.description || incident.shortDescription || 'Service incident detected',
        eventDate: incident.sysCreatedOn || incident.createdAt,
        impactLevel: this.mapServiceNowPriorityToImpact(incident.priority || '3'),
        category: 'Operations',
        sourceType: 'servicenow',
        sourceId: incident.number,
        isResolved: this.isServiceNowIncidentResolved(incident.state || 'New'),
        metadata: {
          priority: incident.priority,
          urgency: incident.urgency,
          impact: incident.impact,
          state: incident.state,
          category: incident.category,
          assignedTo: incident.assignedTo,
        },
        aiAnalysis: {
          detectedPattern: 'infrastructure_incident',
          severity: this.mapServiceNowPriorityToImpact(incident.priority || '3'),
          rootCause: `${incident.priority === '1' ? 'Critical' : 'High'} priority incident in ${incident.category || 'Infrastructure'}`,
          predictedImpact: this.getServiceNowIncidentImpact(incident),
          suggestedActions: [
            'Investigate root cause immediately',
            'Assess impact on customer services',
            'Implement mitigation plan',
            'Prepare incident report',
          ],
        },
        affectedSystems: incident.category ? [incident.category] : ['Infrastructure'],
        detectionConfidence: 0.95,
      }));
  }

  /**
   * Generate timeline events from communication patterns (Slack/Teams)
   */
  private async generateCommunicationEvents(
    tenantId: number,
    options?: any,
  ): Promise<GeneratedTimelineEvent[]> {
    const events: GeneratedTimelineEvent[] = [];

    // Analyze Slack messages for patterns
    const slackWhere: any = { tenantId };
    if (options?.startDate && options?.endDate) {
      slackWhere.slackCreatedAt = Between(options.startDate, options.endDate);
    }

    const recentSlackMessages = await this.slackMessageRepository.find({
      where: slackWhere,
      order: { slackCreatedAt: 'DESC' },
      take: 1000,
    });

    // Detect communication spikes or drops
    const slackEvent = this.detectCommunicationPattern(
      recentSlackMessages.map(m => ({ timestamp: m.slackCreatedAt, source: 'slack', text: m.text })),
      'slack',
      tenantId,
    );
    if (slackEvent) events.push(slackEvent);

    // Analyze Teams messages for patterns
    const teamsWhere: any = { tenantId };
    if (options?.startDate && options?.endDate) {
      teamsWhere.createdDateTime = Between(options.startDate, options.endDate);
    }

    const recentTeamsMessages = await this.teamsMessageRepository.find({
      where: teamsWhere,
      order: { createdDateTime: 'DESC' },
      take: 1000,
    });

    const teamsEvent = this.detectCommunicationPattern(
      recentTeamsMessages.map(m => ({ timestamp: m.createdDateTime, source: 'teams', text: m.content })),
      'teams',
      tenantId,
    );
    if (teamsEvent) events.push(teamsEvent);

    return events;
  }

  /**
   * Generate timeline events from performance metrics (KPIs)
   */
  private async generatePerformanceEvents(
    tenantId: number,
    options?: any,
  ): Promise<GeneratedTimelineEvent[]> {
    // Placeholder for KPI-based timeline event generation
    // TODO: Implement metric threshold violations and anomaly detection
    return [];
  }

  /**
   * Detect communication patterns and generate timeline events
   */
  private detectCommunicationPattern(
    messages: Array<{ timestamp: Date; source: string; text?: string }>,
    source: 'slack' | 'teams',
    tenantId: number,
  ): GeneratedTimelineEvent | null {
    if (messages.length === 0) return null;

    // Calculate message frequency over the last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentMessages = messages.filter(m => m.timestamp >= sevenDaysAgo);

    const avgMessagesPerDay = recentMessages.length / 7;

    // Detect significant drop in communication (>40% below average)
    const lastDayMessages = messages.filter(
      m => m.timestamp >= new Date(now.getTime() - 24 * 60 * 60 * 1000),
    );

    if (avgMessagesPerDay > 10 && lastDayMessages.length < avgMessagesPerDay * 0.6) {
      return {
        id: `${source}_comm_drop_${now.getTime()}`,
        title: `Communication Drop Detected in ${source === 'slack' ? 'Slack' : 'Teams'}`,
        description: `AI detected a ${Math.round((1 - lastDayMessages.length / avgMessagesPerDay) * 100)}% decrease in message volume compared to the 7-day average. This may indicate reduced team collaboration or availability issues.`,
        eventDate: now,
        impactLevel: 'medium',
        category: 'Communication',
        sourceType: source,
        sourceId: `pattern_detection_${now.getTime()}`,
        isResolved: false,
        metadata: {
          avgMessagesPerDay: Math.round(avgMessagesPerDay),
          recentMessages: lastDayMessages.length,
          percentageChange: Math.round((lastDayMessages.length / avgMessagesPerDay - 1) * 100),
        },
        aiAnalysis: {
          detectedPattern: 'communication_volume_drop',
          severity: 'medium',
          rootCause: 'Significant decrease in team communication volume',
          predictedImpact: 'May indicate reduced team engagement or coordination issues',
          suggestedActions: [
            'Check if team members are on PTO or out of office',
            'Review recent team workload and capacity',
            'Schedule team sync to address potential blockers',
          ],
        },
        affectedSystems: [source === 'slack' ? 'Slack Workspace' : 'Microsoft Teams'],
        detectionConfidence: 0.78,
      };
    }

    return null;
  }

  /**
   * Get timeline for a specific signal by its ID
   */
  async getSignalTimeline(tenantId: number, signalId: string): Promise<GeneratedTimelineEvent> {
    // Parse signal ID format: {source}_{id}
    const parts = signalId.split('_');
    if (parts.length !== 2) {
      throw new NotFoundException(`Invalid signal ID format: ${signalId}`);
    }

    const [source, id] = parts;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      throw new NotFoundException(`Invalid signal ID: ${signalId}`);
    }

    let event: GeneratedTimelineEvent;

    switch (source) {
      case 'jira':
        const jiraIssue = await this.jiraIssueRepository.findOne({
          where: { tenantId, id: numericId },
          relations: ['project'],
        });

        if (!jiraIssue) {
          throw new NotFoundException(`Jira issue not found: ${signalId}`);
        }

        event = {
          id: signalId,
          title: jiraIssue.summary || 'Untitled Issue',
          description: jiraIssue.description || '',
          eventDate: jiraIssue.jiraCreatedAt ?? new Date(),
          impactLevel: this.mapJiraPriorityToImpact(jiraIssue.priority || 'medium'),
          category: jiraIssue.issueType || 'Task',
          sourceType: 'jira',
          sourceId: jiraIssue.jiraIssueKey,
          isResolved: jiraIssue.status === 'Done' || jiraIssue.status === 'Closed',
          metadata: {
            issueKey: jiraIssue.jiraIssueKey,
            status: jiraIssue.status,
            priority: jiraIssue.priority,
            assignee: jiraIssue.assigneeDisplayName,
            reporter: jiraIssue.reporterDisplayName,
            projectKey: jiraIssue.project?.jiraProjectKey,
            projectName: jiraIssue.project?.name,
            labels: jiraIssue.labels,
            updatedAt: jiraIssue.jiraUpdatedAt,
            resolvedAt: jiraIssue.resolvedAt,
          },
          affectedSystems: [jiraIssue.project?.name || 'Unknown Project'],
          detectionConfidence: 100,
        };
        break;

      case 'servicenow':
        const incident = await this.serviceNowIncidentRepository.findOne({
          where: { tenantId, id: numericId },
        });

        if (!incident) {
          throw new NotFoundException(`ServiceNow incident not found: ${signalId}`);
        }

        event = {
          id: signalId,
          title: incident.shortDescription || 'Untitled Incident',
          description: incident.description || '',
          eventDate: incident.openedAt ?? new Date(),
          impactLevel: this.mapServiceNowPriorityToImpact(incident.priority || '3'),
          category: 'Incident',
          sourceType: 'servicenow',
          sourceId: incident.number,
          isResolved: incident.state === 'Resolved' || incident.state === 'Closed',
          metadata: {
            number: incident.number,
            state: incident.state,
            priority: incident.priority,
            urgency: incident.urgency,
            impact: incident.impact,
            category: incident.category,
            subcategory: incident.subcategory,
            assignedTo: incident.assignedToName,
            assignmentGroup: incident.assignmentGroupName,
            resolvedAt: incident.resolvedAt,
            closedAt: incident.closedAt,
          },
          affectedSystems: [incident.category || 'Unknown System'],
          detectionConfidence: 100,
        };
        break;

      case 'slack':
        const slackMessage = await this.slackMessageRepository.findOne({
          where: { tenantId, id: numericId },
          relations: ['channel'],
        });

        if (!slackMessage) {
          throw new NotFoundException(`Slack message not found: ${signalId}`);
        }

        event = {
          id: signalId,
          title: slackMessage.text?.substring(0, 100) || 'Slack Message',
          description: slackMessage.text || '',
          eventDate: slackMessage.slackCreatedAt,
          impactLevel: 'low',
          category: 'Communication',
          sourceType: 'slack',
          sourceId: slackMessage.slackMessageTs,
          isResolved: true,
          metadata: {
            channelName: slackMessage.channel?.name,
            channelId: slackMessage.slackChannelId,
            userId: slackMessage.slackUserId,
            type: slackMessage.type,
            subtype: slackMessage.subtype,
            threadTs: slackMessage.slackThreadTs,
            replyCount: slackMessage.replyCount,
          },
          affectedSystems: [slackMessage.channel?.name || 'Unknown Channel'],
          detectionConfidence: 85,
        };
        break;

      case 'teams':
        const teamsMessage = await this.teamsMessageRepository.findOne({
          where: { tenantId, id: numericId },
          relations: ['user', 'channel'],
        });

        if (!teamsMessage) {
          throw new NotFoundException(`Teams message not found: ${signalId}`);
        }

        event = {
          id: signalId,
          title: teamsMessage.content?.substring(0, 100) || 'Teams Message',
          description: teamsMessage.content || '',
          eventDate: teamsMessage.createdDateTime,
          impactLevel: 'low',
          category: 'Communication',
          sourceType: 'teams',
          sourceId: teamsMessage.messageId,
          isResolved: true,
          metadata: {
            channelId: teamsMessage.teamsChannelId,
            teamId: teamsMessage.teamId,
            from: teamsMessage.user?.displayName,
            fromUserId: teamsMessage.teamsUserId,
            messageType: teamsMessage.messageType,
            replyToId: teamsMessage.replyToId,
            importance: teamsMessage.importance,
          },
          affectedSystems: ['Microsoft Teams'],
          detectionConfidence: 85,
        };
        break;

      default:
        throw new NotFoundException(`Unknown signal source: ${source}`);
    }

    return event;
  }

  /**
   * Get statistics about generated timeline events
   */
  async getStatistics(
    tenantId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    byImpactLevel: { high: number; medium: number; low: number };
    byCategory: Record<string, number>;
    resolvedCount: number;
    unresolvedCount: number;
    bySource: Record<string, number>;
  }> {
    const events = await this.generateTimelineEvents(tenantId, { startDate, endDate });

    const byImpactLevel = { high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let resolvedCount = 0;
    let unresolvedCount = 0;

    for (const event of events) {
      byImpactLevel[event.impactLevel]++;

      byCategory[event.category] = (byCategory[event.category] || 0) + 1;
      bySource[event.sourceType] = (bySource[event.sourceType] || 0) + 1;

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
      bySource,
    };
  }

  // Helper methods

  private mapJiraPriorityToImpact(priority: string): 'high' | 'medium' | 'low' {
    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('critical') || priorityLower.includes('blocker')) {
      return 'high';
    }
    if (priorityLower.includes('high')) {
      return 'high';
    }
    if (priorityLower.includes('low')) {
      return 'low';
    }
    return 'medium';
  }

  private isJiraIssueResolved(status: string): boolean {
    const statusLower = status.toLowerCase();
    return (
      statusLower.includes('done') ||
      statusLower.includes('resolved') ||
      statusLower.includes('closed')
    );
  }

  private getJiraIssueImpact(issue: JiraIssue): string {
    const priority = (issue.priority || '').toLowerCase();
    if (priority.includes('critical') || priority.includes('blocker')) {
      return 'Critical issue may block development progress and impact delivery timelines';
    }
    if (priority.includes('high')) {
      return 'High priority issue requires immediate attention to prevent delays';
    }
    return 'Issue should be addressed to maintain development velocity';
  }

  private mapServiceNowPriorityToImpact(priority: string): 'high' | 'medium' | 'low' {
    if (priority === '1') return 'high';
    if (priority === '2') return 'high';
    if (priority === '3') return 'medium';
    if (priority === '4') return 'low';
    return 'medium';
  }

  private isServiceNowIncidentResolved(state: string): boolean {
    const stateLower = state.toLowerCase();
    return stateLower.includes('resolved') || stateLower.includes('closed');
  }

  private getServiceNowIncidentImpact(incident: ServiceNowIncident): string {
    if (incident.priority === '1') {
      return 'Critical incident affecting business operations, immediate resolution required';
    }
    if (incident.priority === '2') {
      return 'High impact incident affecting service availability, urgent attention needed';
    }
    return 'Incident requires investigation and resolution to prevent escalation';
  }
}
