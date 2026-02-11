import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WeakSignal } from '../../weak-signals/entities/weak-signal.entity';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { GmailMessage } from '../../gmail/entities/gmail-message.entity';
import { OutlookMessage } from '../../outlook/entities/outlook-message.entity';

export interface RetrievedContext {
  signals?: WeakSignal[];
  incidents?: ServiceNowIncident[];
  issues?: JiraIssue[];
  recentCommunications?: any[];
  metrics?: any;
}

@Injectable()
export class ContextRetrievalService {
  private readonly logger = new Logger(ContextRetrievalService.name);

  constructor(
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
    @InjectRepository(JiraIssue)
    private readonly jiraRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowRepository: Repository<ServiceNowIncident>,
    @InjectRepository(SlackMessage)
    private readonly slackRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsRepository: Repository<TeamsMessage>,
    @InjectRepository(GmailMessage)
    private readonly gmailRepository: Repository<GmailMessage>,
    @InjectRepository(OutlookMessage)
    private readonly outlookRepository: Repository<OutlookMessage>,
  ) {}

  async retrieveContext(
    tenantId: number,
    intent: { topic: string; entities: string[]; timeframe?: string; severity?: string },
  ): Promise<RetrievedContext> {
    const context: RetrievedContext = {};

    switch (intent.topic) {
      case 'weak-signals':
        context.signals = await this.getRelevantSignals(tenantId, intent);
        break;

      case 'incidents':
        context.incidents = await this.getRelevantIncidents(tenantId, intent);
        break;

      case 'issues':
        context.issues = await this.getRelevantIssues(tenantId, intent);
        break;

      case 'overview':
        // Get a summary of everything
        context.signals = await this.getRelevantSignals(tenantId, { ...intent, limit: 5 });
        context.incidents = await this.getRelevantIncidents(tenantId, { ...intent, limit: 5 });
        context.issues = await this.getRelevantIssues(tenantId, { ...intent, limit: 5 });
        break;

      case 'metrics':
        context.metrics = await this.getMetricsSummary(tenantId);
        break;

      default:
        // For general queries, get a bit of everything
        context.signals = await this.getRelevantSignals(tenantId, { ...intent, limit: 3 });
        context.incidents = await this.getRelevantIncidents(tenantId, { ...intent, limit: 3 });
        break;
    }

    return context;
  }

  private async getRelevantSignals(
    tenantId: number,
    params: { severity?: string; entities?: string[]; limit?: number },
  ): Promise<WeakSignal[]> {
    const queryBuilder = this.weakSignalRepository
      .createQueryBuilder('signal')
      .where('signal.tenantId = :tenantId', { tenantId })
      .andWhere('signal.status IN (:...statuses)', { statuses: ['new', 'investigating'] })
      .orderBy('signal.confidenceScore', 'DESC')
      .take(params.limit || 10);

    if (params.severity) {
      queryBuilder.andWhere('signal.severity = :severity', { severity: params.severity });
    }

    return await queryBuilder.getMany();
  }

  private async getRelevantIncidents(
    tenantId: number,
    params: { severity?: string; entities?: string[]; limit?: number },
  ): Promise<ServiceNowIncident[]> {
    const queryBuilder = this.serviceNowRepository
      .createQueryBuilder('incident')
      .where('incident.tenantId = :tenantId', { tenantId })
      .andWhere('incident.state IN (:...states)', { states: ['new', 'in_progress', 'on_hold'] })
      .orderBy('incident.createdAt', 'DESC')
      .take(params.limit || 10);

    if (params.severity) {
      queryBuilder.andWhere('incident.priority = :priority', { priority: params.severity });
    }

    return await queryBuilder.getMany();
  }

  private async getRelevantIssues(
    tenantId: number,
    params: { severity?: string; entities?: string[]; limit?: number },
  ): Promise<JiraIssue[]> {
    const queryBuilder = this.jiraRepository
      .createQueryBuilder('issue')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.status IN (:...statuses)', { statuses: ['To Do', 'In Progress', 'In Review'] })
      .orderBy('issue.createdAt', 'DESC')
      .take(params.limit || 10);

    if (params.severity) {
      queryBuilder.andWhere('issue.priority = :priority', { priority: params.severity });
    }

    return await queryBuilder.getMany();
  }

  private async getMetricsSummary(tenantId: number) {
    const [totalSignals, criticalSignals, openIncidents, openIssues] = await Promise.all([
      this.weakSignalRepository.count({ where: { tenantId } }),
      this.weakSignalRepository.count({ where: { tenantId, severity: 'critical', status: 'new' } }),
      this.serviceNowRepository.count({ where: { tenantId, state: In(['new', 'in_progress']) } }),
      this.jiraRepository.count({ where: { tenantId, status: In(['To Do', 'In Progress']) } }),
    ]);

    return {
      totalSignals,
      criticalSignals,
      openIncidents,
      openIssues,
    };
  }

  formatContextForPrompt(context: RetrievedContext): string {
    const parts: string[] = [];

    if (context.signals && context.signals.length > 0) {
      parts.push('=== Weak Signals ===');
      context.signals.forEach((signal, idx) => {
        parts.push(
          `${idx + 1}. [ID: ${signal.id}] ${signal.title}
   Severity: ${signal.severity} | Confidence: ${signal.confidenceScore}%
   Description: ${signal.description}
   Category: ${signal.category}
   Status: ${signal.status}`,
        );
      });
      parts.push('');
    }

    if (context.incidents && context.incidents.length > 0) {
      parts.push('=== ServiceNow Incidents ===');
      context.incidents.forEach((incident, idx) => {
        parts.push(
          `${idx + 1}. [${incident.number}] ${incident.shortDescription}
   Priority: ${incident.priority} | State: ${incident.state}
   Assigned: ${incident.assignedToName || 'Unassigned'}
   Created: ${incident.createdAt?.toLocaleDateString()}`,
        );
      });
      parts.push('');
    }

    if (context.issues && context.issues.length > 0) {
      parts.push('=== Jira Issues ===');
      context.issues.forEach((issue, idx) => {
        parts.push(
          `${idx + 1}. [${issue.jiraIssueKey}] ${issue.summary}
   Type: ${issue.issueType} | Priority: ${issue.priority}
   Status: ${issue.status}
   Assignee: ${issue.assigneeDisplayName || 'Unassigned'}`,
        );
      });
      parts.push('');
    }

    if (context.metrics) {
      parts.push('=== Metrics Summary ===');
      parts.push(`Total Weak Signals: ${context.metrics.totalSignals}`);
      parts.push(`Critical Signals (New): ${context.metrics.criticalSignals}`);
      parts.push(`Open Incidents: ${context.metrics.openIncidents}`);
      parts.push(`Open Issues: ${context.metrics.openIssues}`);
      parts.push('');
    }

    return parts.join('\n');
  }
}
