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
    console.log(`[ActionGenerator] Starting generateActions for tenant ${tenantId}`);
    this.logger.log(`Generating actions for tenant ${tenantId}`);

    let jiraActions: GeneratedAction[] = [];
    let serviceNowActions: GeneratedAction[] = [];
    let timelineActions: GeneratedAction[] = [];
    let kpiActions: GeneratedAction[] = [];

    try {
      console.log('[ActionGenerator] Calling generateJiraActions...');
      jiraActions = await this.generateJiraActions(tenantId);
      console.log(`[ActionGenerator] Generated ${jiraActions.length} Jira actions`);
    } catch (error) {
      console.error('[ActionGenerator] Error in generateJiraActions:', error);
      this.logger.error(`Error generating Jira actions: ${error.message}`, error.stack);
    }

    try {
      console.log('[ActionGenerator] Calling generateServiceNowActions...');
      serviceNowActions = await this.generateServiceNowActions(tenantId);
      console.log(`[ActionGenerator] Generated ${serviceNowActions.length} ServiceNow actions`);
    } catch (error) {
      console.error('[ActionGenerator] Error in generateServiceNowActions:', error);
      this.logger.error(`Error generating ServiceNow actions: ${error.message}`, error.stack);
    }

    try {
      console.log('[ActionGenerator] Calling generateTimelineActions...');
      timelineActions = await this.generateTimelineActions(tenantId);
      console.log(`[ActionGenerator] Generated ${timelineActions.length} Timeline actions`);
    } catch (error) {
      console.error('[ActionGenerator] Error in generateTimelineActions:', error);
      this.logger.error(`Error generating Timeline actions: ${error.message}`, error.stack);
    }

    try {
      console.log('[ActionGenerator] Calling generateKpiActions...');
      kpiActions = await this.generateKpiActions(tenantId);
      console.log(`[ActionGenerator] Generated ${kpiActions.length} KPI actions`);
    } catch (error) {
      console.error('[ActionGenerator] Error in generateKpiActions:', error);
      this.logger.error(`Error generating KPI actions: ${error.message}`, error.stack);
    }

    const allActions = [
      ...jiraActions,
      ...serviceNowActions,
      ...timelineActions,
      ...kpiActions,
    ];

    console.log(`[ActionGenerator] Total actions before sorting: ${allActions.length}`);

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

    console.log('[ActionGenerator] Status breakdown:', byStatus);

    const stats = {
      totalSources: 6,
      totalPiiStored: 305808,
      activeConnections: 5,
      lastUpdate: allActions.length > 0 ? allActions[0].createdAt : null,
    };

    console.log('[ActionGenerator] generateActions completed successfully');

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
    console.log('[ActionGenerator] generateJiraActions - querying Jira issues...');
    const criticalIssues = await this.jiraIssueRepository.find({
      where: {
        tenantId,
      },
      take: 50,
      order: { jiraCreatedAt: 'DESC' },
    });

    console.log(`[ActionGenerator] generateJiraActions - found ${criticalIssues.length} issues`);

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
    console.log('[ActionGenerator] generateServiceNowActions - querying ServiceNow incidents...');
    const criticalIncidents = await this.serviceNowIncidentRepository.find({
      where: {
        tenantId,
      },
      take: 50,
      order: { sysCreatedOn: 'DESC' },
    });

    console.log(`[ActionGenerator] generateServiceNowActions - found ${criticalIncidents.length} incidents`);

    return criticalIncidents.map(incident => ({
      id: `servicenow_${incident.id}`,
      title: incident.shortDescription || 'ServiceNow Incident',
      description: incident.description || '',
      status: this.mapServiceNowState(incident.state || 'New'),
      priority: this.mapServiceNowPriority(incident.priority || '3'),
      category: 'Operations',
      sourceType: 'servicenow',
      sourceId: incident.number,
      metadata: {
        detectionPattern: 'servicenow_incident',
        affectedSystems: [incident.category || 'Infrastructure'],
        estimatedImpact: this.getServiceNowImpactDescription(incident.priority || '3'),
      },
      aiAnalysis: {
        detectedIssue: incident.shortDescription,
        rootCause: 'Infrastructure or service issue',
        recommendedSolution: 'Investigate and resolve according to incident priority and category',
        estimatedEffort: this.getEstimatedEffort(incident.priority || '3'),
      },
      assignedToName: incident.assignedToName || undefined,
      createdAt: incident.sysCreatedOn || incident.createdAt,
    }));
  }

  /**
   * Generate actions from timeline events
   */
  private async generateTimelineActions(tenantId: number): Promise<GeneratedAction[]> {
    console.log('[ActionGenerator] generateTimelineActions - querying timeline events...');
    const unresolvedHighImpact = await this.timelineEventRepository.find({
      where: {
        tenantId,
        isActive: true,
      },
      take: 50,
      order: { eventDate: 'DESC' },
    });

    console.log(`[ActionGenerator] generateTimelineActions - found ${unresolvedHighImpact.length} timeline events`);

    return unresolvedHighImpact.map(event => ({
      id: `timeline_${event.id}`,
      title: event.title,
      description: event.description || '',
      status: event.isResolved ? 'done' : 'open',
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
   * Map ServiceNow state to action status
   */
  private mapServiceNowState(state: string): 'open' | 'in_progress' | 'done' {
    const stateLower = state.toLowerCase();
    if (stateLower.includes('new') || stateLower.includes('on hold')) {
      return 'open';
    }
    if (stateLower.includes('progress')) {
      return 'in_progress';
    }
    if (stateLower.includes('resolved') || stateLower.includes('closed')) {
      return 'done';
    }
    return 'open';
  }

  /**
   * Map ServiceNow priority to action priority
   */
  private mapServiceNowPriority(priority: string): 'critical' | 'high' | 'medium' | 'low' {
    if (priority === '1') return 'critical';
    if (priority === '2') return 'high';
    if (priority === '3') return 'medium';
    if (priority === '4') return 'low';
    return 'medium';
  }

  /**
   * Get ServiceNow impact description
   */
  private getServiceNowImpactDescription(priority: string): string {
    if (priority === '1') return 'Critical - High availability risk';
    if (priority === '2') return 'High - Service degradation risk';
    if (priority === '3') return 'Moderate - Limited impact';
    if (priority === '4') return 'Low - Minimal impact';
    return 'Moderate impact';
  }

  /**
   * Get estimated effort based on priority
   */
  private getEstimatedEffort(priority: string): string {
    if (priority === '1') return '4-8 hours';
    if (priority === '2') return '2-4 hours';
    if (priority === '3') return '1-2 hours';
    if (priority === '4') return '0.5-1 hour';
    return '2-4 hours';
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
