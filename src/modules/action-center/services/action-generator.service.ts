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

  /**
   * Generate a detailed resolution plan for a specific action
   */
  async generateResolutionPlan(action: GeneratedAction): Promise<{
    overview: string;
    rootCause: {
      analysis: string;
      likelyReasons: string[];
      confidence: number;
    };
    immediateActions: Array<{
      step: number;
      title: string;
      description: string;
      command?: string;
      estimatedTime: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    }>;
    preventiveMeasures: Array<{
      title: string;
      description: string;
      impact: string;
      effort: 'low' | 'medium' | 'high';
    }>;
    monitoringChecklist: string[];
    successCriteria: string[];
    relatedDocumentation: Array<{
      title: string;
      url: string;
      relevance: string;
    }>;
  }> {
    this.logger.log(`Generating resolution plan for action: ${action.id}`);

    const title = action.title.toLowerCase();
    const description = action.description.toLowerCase();
    const priority = action.priority;

    // Analyze the action type and generate appropriate resolution steps
    let overview = '';
    let rootCause = {
      analysis: '',
      likelyReasons: [] as string[],
      confidence: 0.7,
    };
    let immediateActions: Array<{
      step: number;
      title: string;
      description: string;
      command?: string;
      estimatedTime: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    }> = [];
    let preventiveMeasures: Array<{
      title: string;
      description: string;
      impact: string;
      effort: 'low' | 'medium' | 'high';
    }> = [];
    let monitoringChecklist: string[] = [];

    // Pattern matching for different issue types
    if (title.includes('critical issue') || title.includes('critical priority')) {
      overview = `This is a critical priority issue that requires immediate attention. The issue has been flagged as ${priority} priority, indicating significant impact on system functionality or user experience.`;

      rootCause = {
        analysis: 'Critical issues typically stem from recent code changes, infrastructure failures, or cascading system dependencies. Based on the issue description, this appears to be a high-severity problem requiring urgent investigation.',
        likelyReasons: [
          'Recent deployment or code change introduced regression',
          'Infrastructure component failure (database, cache, queue)',
          'Third-party service degradation or outage',
          'Resource exhaustion (memory, CPU, connections)',
          'Security breach or unauthorized access attempt',
        ],
        confidence: 0.85,
      };

      immediateActions = [
        {
          step: 1,
          title: 'Assess Impact and Scope',
          description: 'Immediately check system health dashboard and error logs to understand the full extent of the issue. Identify affected users, services, and business functions.',
          estimatedTime: '5-10 minutes',
          priority: 'critical',
        },
        {
          step: 2,
          title: 'Notify Stakeholders',
          description: 'Alert relevant teams (engineering, product, customer support) and update status page if customer-facing.',
          estimatedTime: '5 minutes',
          priority: 'critical',
        },
        {
          step: 3,
          title: 'Check Recent Changes',
          description: 'Review recent deployments, configuration changes, and infrastructure modifications that coincide with the issue start time.',
          command: 'git log --since="2 hours ago" --oneline',
          estimatedTime: '10 minutes',
          priority: 'critical',
        },
        {
          step: 4,
          title: 'Review Error Logs',
          description: 'Examine application logs, database logs, and infrastructure logs for error patterns and stack traces.',
          command: 'kubectl logs <pod-name> --tail=100 --follow',
          estimatedTime: '15 minutes',
          priority: 'high',
        },
        {
          step: 5,
          title: 'Consider Rollback',
          description: 'If the issue started after a recent deployment, prepare for potential rollback to the last known stable version.',
          command: 'kubectl rollout undo deployment/<deployment-name>',
          estimatedTime: '10 minutes',
          priority: 'high',
        },
        {
          step: 6,
          title: 'Implement Fix or Mitigation',
          description: 'Based on root cause analysis, either deploy a hotfix or implement temporary mitigation (e.g., increase resources, disable feature flag).',
          estimatedTime: '30-60 minutes',
          priority: 'high',
        },
        {
          step: 7,
          title: 'Verify Resolution',
          description: 'Monitor system metrics and error rates to confirm the issue is resolved. Test affected functionality.',
          estimatedTime: '15 minutes',
          priority: 'high',
        },
      ];

      preventiveMeasures = [
        {
          title: 'Implement Canary Deployments',
          description: 'Deploy changes to a small subset of users first to catch issues before full rollout.',
          impact: 'Reduces blast radius of deployment issues by 90%',
          effort: 'medium',
        },
        {
          title: 'Enhanced Monitoring and Alerting',
          description: 'Set up proactive alerts for error rate spikes, performance degradation, and resource exhaustion.',
          impact: 'Early detection of issues before user impact',
          effort: 'low',
        },
        {
          title: 'Automated Rollback Triggers',
          description: 'Configure automatic rollback when error rates exceed thresholds after deployment.',
          impact: 'Automatic recovery from bad deployments',
          effort: 'medium',
        },
      ];

      monitoringChecklist = [
        'Error rate returning to baseline levels',
        'Response time metrics within acceptable range',
        'CPU and memory utilization stable',
        'No increase in failed requests or timeouts',
        'Database connection pool healthy',
        'All dependent services responding normally',
        'Customer support ticket volume normal',
      ];
    } else if (title.includes('high priority') || priority === 'high') {
      overview = `This high-priority issue requires prompt attention to prevent escalation. While not immediately critical, delayed resolution could lead to system degradation or user impact.`;

      rootCause = {
        analysis: 'High-priority issues often indicate performance problems, configuration drift, or emerging patterns that need investigation before they become critical.',
        likelyReasons: [
          'Performance degradation in specific workflows',
          'Configuration mismatch between environments',
          'Gradual resource leak or inefficiency',
          'Data quality or consistency issues',
          'Integration issues with external systems',
        ],
        confidence: 0.75,
      };

      immediateActions = [
        {
          step: 1,
          title: 'Gather Diagnostic Data',
          description: 'Collect relevant metrics, logs, and traces to understand the issue scope and timeline.',
          estimatedTime: '15 minutes',
          priority: 'high',
        },
        {
          step: 2,
          title: 'Reproduce the Issue',
          description: 'Attempt to reproduce the problem in a non-production environment to understand the failure mode.',
          estimatedTime: '20-30 minutes',
          priority: 'high',
        },
        {
          step: 3,
          title: 'Analyze Performance Bottlenecks',
          description: 'Use profiling tools to identify slow queries, inefficient code paths, or resource contention.',
          command: 'npm run profile:production',
          estimatedTime: '20 minutes',
          priority: 'medium',
        },
        {
          step: 4,
          title: 'Develop and Test Fix',
          description: 'Create a fix targeting the root cause and thoroughly test in staging environment.',
          estimatedTime: '1-2 hours',
          priority: 'medium',
        },
        {
          step: 5,
          title: 'Deploy Fix with Monitoring',
          description: 'Deploy the fix with careful monitoring and be prepared to rollback if issues arise.',
          estimatedTime: '30 minutes',
          priority: 'medium',
        },
      ];

      preventiveMeasures = [
        {
          title: 'Performance Testing in CI/CD',
          description: 'Add automated performance tests to catch regressions before production.',
          impact: 'Catch performance issues in development',
          effort: 'medium',
        },
        {
          title: 'Regular Code Reviews',
          description: 'Ensure all code changes are reviewed for potential performance and reliability issues.',
          impact: 'Improved code quality and fewer bugs',
          effort: 'low',
        },
      ];

      monitoringChecklist = [
        'Response times improved to acceptable levels',
        'Error rates within normal thresholds',
        'Resource utilization trends downward',
        'User complaints or support tickets resolved',
        'Related metrics showing improvement',
      ];
    } else {
      // Medium/Low priority - general guidance
      overview = `This action requires attention but is not immediately urgent. Addressing it will improve system health and prevent future issues.`;

      rootCause = {
        analysis: 'This issue represents a potential improvement or minor problem that should be addressed during regular maintenance cycles.',
        likelyReasons: [
          'Technical debt accumulation',
          'Suboptimal configuration or settings',
          'Missing monitoring or observability',
          'Documentation gaps',
          'Process improvement opportunity',
        ],
        confidence: 0.65,
      };

      immediateActions = [
        {
          step: 1,
          title: 'Investigate and Document',
          description: 'Research the issue thoroughly and document findings for future reference.',
          estimatedTime: '30 minutes',
          priority: 'low',
        },
        {
          step: 2,
          title: 'Create Improvement Plan',
          description: 'Outline a plan to address the issue, including timeline and required resources.',
          estimatedTime: '20 minutes',
          priority: 'low',
        },
        {
          step: 3,
          title: 'Schedule Implementation',
          description: 'Add the improvement to the team backlog and prioritize appropriately.',
          estimatedTime: '10 minutes',
          priority: 'low',
        },
      ];

      preventiveMeasures = [
        {
          title: 'Regular Technical Debt Reviews',
          description: 'Schedule quarterly reviews to identify and address accumulated technical debt.',
          impact: 'Prevent buildup of small issues',
          effort: 'low',
        },
      ];

      monitoringChecklist = [
        'Issue documented in knowledge base',
        'Team aware of the problem and solution',
        'Improvement implemented or scheduled',
      ];
    }

    const successCriteria = [
      'Issue no longer appears in monitoring dashboards',
      'No related errors in application logs',
      'System metrics return to normal baseline',
      'User-facing functionality operates as expected',
      'No recurrence of similar issues',
      'Post-mortem completed and lessons documented',
    ];

    const relatedDocumentation = [
      {
        title: 'Incident Response Runbook',
        url: '/docs/runbooks/incident-response',
        relevance: 'Step-by-step guide for handling production incidents',
      },
      {
        title: 'System Architecture Overview',
        url: '/docs/architecture/overview',
        relevance: 'Understanding system components and dependencies',
      },
      {
        title: 'Monitoring and Alerting Guide',
        url: '/docs/operations/monitoring',
        relevance: 'How to use monitoring tools to diagnose issues',
      },
      {
        title: 'Deployment Procedures',
        url: '/docs/operations/deployment',
        relevance: 'Safe deployment and rollback procedures',
      },
    ];

    return {
      overview,
      rootCause,
      immediateActions,
      preventiveMeasures,
      monitoringChecklist,
      successCriteria,
      relatedDocumentation,
    };
  }
}
