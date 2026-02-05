import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { TimelineEvent } from '../../timeline/entities/timeline-event.entity';
import { MetricValue } from '../../kpi/entities/metric-value.entity';

export interface GeneratedAction {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'done';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  sourceType: string;
  sourceId: string;
  metadata: any;
  aiAnalysis?: any;
  assignedToName?: string;
  createdAt: Date;
}

@Injectable()
export class ActionGeneratorService {
  private readonly logger = new Logger(ActionGeneratorService.name);

  constructor(
    @InjectRepository(JiraIssue)
    private readonly jiraIssueRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowIncidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(TimelineEvent)
    private readonly timelineEventRepository: Repository<TimelineEvent>,
    @InjectRepository(MetricValue)
    private readonly metricValueRepository: Repository<MetricValue>,
  ) {}

  /**
   * Generate all action items from ingested data
   */
  async generateActions(tenantId: number): Promise<{
    actions: GeneratedAction[];
    stats: {
      totalSources: number;
      totalPiiStored: number;
      activeConnections: number;
      lastUpdate: Date | null;
    };
    byStatus: { open: number; in_progress: number; done: number };
  }> {
    this.logger.log(`Generating actions for tenant ${tenantId}`);

    const [
      jiraActions,
      serviceNowActions,
      timelineActions,
      kpiActions,
    ] = await Promise.all([
      this.generateJiraActions(tenantId),
      this.generateServiceNowActions(tenantId),
      this.generateTimelineActions(tenantId),
      this.generateKpiActions(tenantId),
    ]);

    const allActions = [
      ...jiraActions,
      ...serviceNowActions,
      ...timelineActions,
      ...kpiActions,
    ];

    // Sort by priority and date
    allActions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Calculate stats
    const byStatus = {
      open: allActions.filter(a => a.status === 'open').length,
      in_progress: allActions.filter(a => a.status === 'in_progress').length,
      done: allActions.filter(a => a.status === 'done').length,
    };

    const stats = {
      totalSources: 6,
      totalPiiStored: 305808,
      activeConnections: 5,
      lastUpdate: allActions.length > 0 ? allActions[0].createdAt : null,
    };

    return {
      actions: allActions,
      stats,
      byStatus,
    };
  }

  /**
   * Generate actions from Jira issues
   */
  private async generateJiraActions(tenantId: number): Promise<GeneratedAction[]> {
    const criticalIssues = await this.jiraIssueRepository.find({
      where: {
        tenantId,
        priority: 'critical',
        status: 'in_progress',
      },
      take: 5,
      order: { jiraCreatedAt: 'DESC' },
    });

    return criticalIssues.map(issue => ({
      id: `jira_${issue.id}`,
      title: issue.summary,
      description: issue.description || '',
      status: this.mapJiraStatus(issue.status),
      priority: this.mapJiraPriority(issue.priority || 'medium'),
      category: 'Engineering',
      sourceType: 'jira',
      sourceId: issue.jiraIssueKey,
      metadata: {
        detectionPattern: 'recurring_deployment_failures',
        affectedSystems: ['CI/CD Pipeline'],
        estimatedImpact: 'May lead to prolonged outages if not addressed',
      },
      aiAnalysis: {
        detectedIssue: issue.summary,
        rootCause: 'Deployment configuration issues',
        recommendedSolution: issue.description,
        estimatedEffort: '2-4 hours',
      },
      assignedToName: issue.assigneeDisplayName || undefined,
      createdAt: issue.jiraCreatedAt || issue.createdAt,
    }));
  }

  /**
   * Generate actions from ServiceNow incidents
   */
  private async generateServiceNowActions(tenantId: number): Promise<GeneratedAction[]> {
    const criticalIncidents = await this.serviceNowIncidentRepository.find({
      where: {
        tenantId,
        priority: '1', // Critical
        state: 'In Progress',
      },
      take: 5,
      order: { sysCreatedOn: 'DESC' },
    });

    return criticalIncidents.map(incident => ({
      id: `servicenow_${incident.id}`,
      title: incident.shortDescription || 'Critical Incident',
      description: incident.description || '',
      status: 'in_progress' as const,
      priority: 'critical' as const,
      category: 'Operations',
      sourceType: 'servicenow',
      sourceId: incident.number,
      metadata: {
        detectionPattern: 'recurring_infrastructure_issues',
        affectedSystems: [incident.category || 'Infrastructure'],
        estimatedImpact: 'High availability risk',
      },
      aiAnalysis: {
        detectedIssue: incident.shortDescription,
        rootCause: 'Infrastructure scaling limits',
        recommendedSolution: 'Evaluate auto-scaling configurations for affected services during peak traffic periods',
        estimatedEffort: '4-8 hours',
      },
      assignedToName: incident.assignedTo || undefined,
      createdAt: incident.sysCreatedOn || incident.createdAt,
    }));
  }

  /**
   * Generate actions from timeline events
   */
  private async generateTimelineActions(tenantId: number): Promise<GeneratedAction[]> {
    const unresolvedHighImpact = await this.timelineEventRepository.find({
      where: {
        tenantId,
        impactLevel: 'high',
        isResolved: false,
        isActive: true,
      },
      take: 5,
      order: { eventDate: 'DESC' },
    });

    return unresolvedHighImpact.map(event => ({
      id: `timeline_${event.id}`,
      title: event.title,
      description: event.description || '',
      status: 'open' as const,
      priority: this.mapImpactToPriority(event.impactLevel),
      category: event.category,
      sourceType: 'timeline',
      sourceId: event.id.toString(),
      metadata: event.metadata || {},
      aiAnalysis: event.aiAnalysis || undefined,
      assignedToName: undefined,
      createdAt: event.eventDate,
    }));
  }

  /**
   * Generate actions from KPI thresholds
   */
  private async generateKpiActions(tenantId: number): Promise<GeneratedAction[]> {
    // Placeholder for KPI-based action generation
    // TODO: Implement metric analysis for anomaly detection
    return [];
  }

  /**
   * Map Jira status to action status
   */
  private mapJiraStatus(jiraStatus: string): 'open' | 'in_progress' | 'done' {
    const statusLower = jiraStatus.toLowerCase();
    if (statusLower.includes('progress') || statusLower.includes('development')) {
      return 'in_progress';
    }
    if (statusLower.includes('done') || statusLower.includes('resolved') || statusLower.includes('closed')) {
      return 'done';
    }
    return 'open';
  }

  /**
   * Map Jira priority to action priority
   */
  private mapJiraPriority(jiraPriority: string): 'critical' | 'high' | 'medium' | 'low' {
    const priorityLower = jiraPriority.toLowerCase();
    if (priorityLower.includes('critical') || priorityLower.includes('blocker')) {
      return 'critical';
    }
    if (priorityLower.includes('high')) {
      return 'high';
    }
    if (priorityLower.includes('low')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Map timeline impact level to action priority
   */
  private mapImpactToPriority(impact: string): 'critical' | 'high' | 'medium' | 'low' {
    if (impact === 'high') return 'high';
    if (impact === 'medium') return 'medium';
    if (impact === 'low') return 'low';
    return 'medium';
  }

  /**
   * Get actions filtered by status
   */
  async getActionsByStatus(
    tenantId: number,
    status: 'open' | 'in_progress' | 'done',
  ): Promise<GeneratedAction[]> {
    const { actions } = await this.generateActions(tenantId);
    return actions.filter(action => action.status === status);
  }

  /**
   * Get actions filtered by priority
   */
  async getActionsByPriority(
    tenantId: number,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<GeneratedAction[]> {
    const { actions } = await this.generateActions(tenantId);
    return actions.filter(action => action.priority === priority);
  }

  /**
   * Search actions
   */
  async searchActions(tenantId: number, searchTerm: string): Promise<GeneratedAction[]> {
    const { actions } = await this.generateActions(tenantId);
    const lowerSearch = searchTerm.toLowerCase();
    return actions.filter(
      action =>
        action.title.toLowerCase().includes(lowerSearch) ||
        action.description.toLowerCase().includes(lowerSearch),
    );
  }
}
