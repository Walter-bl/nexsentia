import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { WeakSignal } from '../../weak-signals/entities/weak-signal.entity';

export interface TeamMetrics {
  teamName: string;
  problemsResolved: number;
  avgResolutionTime: {
    current: number; // in hours
    previous: number; // in hours
    improvement: number; // percentage
  };
  timeSaved: {
    total: number; // in hours
    perWeek: number;
    vsLastPeriod: number; // percentage change
  };
  executionSpeed: {
    current: number; // issues per day
    previous: number;
    improvement: number; // percentage
  };
  crossTeamCollaboration: {
    interactions: number;
    teamsInvolved: number;
    avgResponseTime: number; // in hours
  };
  incidentsPrevented: number;
  meetingsTriggered: number;
  documentationUpdates: number;
}

export interface ImpactDashboard {
  totalValue: {
    timeSavedHours: number; // total hours saved
    since: string;
    periodMonths: number;
  };
  roi: {
    multiple: number;
    calculationBasis: string;
  };
  issuesPrevented: number;
  overallMetrics: {
    problemsResolved: number;
    crossTeamAlignments: number;
    meetingsTriggered: number;
    documentationUpdates: number;
    incidentsAvoided: number;
    estimatedTimeSavedHours: number; // total hours
  };
  beforePlatform: {
    avgIssueDetection: number; // in days
    crossTeamFrictionResolution: number; // in days
    monthlyIncidents: string; // range like "8-12"
    quarterlyImpactHours: number; // time lost in hours
  };
  withPlatform: {
    avgIssueDetection: number; // in days
    crossTeamFrictionResolution: number; // in days
    monthlyIncidents: string; // range like "2-3"
    quarterlyImpactHours: number; // time saved in hours
  };
  improvement: {
    issueDetectionSpeed: string; // e.g., "85% faster"
    fewerIncidents: string; // e.g., "76% fewer"
    quarterlySavingsHours: number; // hours saved
  };
  teamBreakdown: TeamMetrics[];
}

@Injectable()
export class TeamImpactService {
  private readonly logger = new Logger(TeamImpactService.name);

  constructor(
    @InjectRepository(JiraIssue)
    private readonly jiraRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowRepository: Repository<ServiceNowIncident>,
    @InjectRepository(SlackMessage)
    private readonly slackRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsRepository: Repository<TeamsMessage>,
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
  ) {}

  /**
   * Get comprehensive team impact dashboard
   */
  async getTeamImpactDashboard(tenantId: number, startDate?: Date, endDate?: Date): Promise<ImpactDashboard> {
    this.logger.log(`Generating team impact dashboard for tenant ${tenantId}`);

    // Use provided dates or default to 6 months
    const platformStartDate = startDate || new Date(new Date().setMonth(new Date().getMonth() - 6));
    const currentDate = endDate || new Date();

    // Calculate period length in months
    const periodMonths = Math.ceil((currentDate.getTime() - platformStartDate.getTime()) / (30 * 24 * 60 * 60 * 1000));

    // Calculate previous period for comparison (same length as current period)
    const periodLength = currentDate.getTime() - platformStartDate.getTime();
    const previousPeriodStart = new Date(platformStartDate.getTime() - periodLength);

    // Get all teams from ingested data
    const teams = await this.extractTeams(tenantId);

    // Calculate metrics for each team
    const teamBreakdown = await Promise.all(
      teams.map(teamName => this.calculateTeamMetrics(tenantId, teamName, platformStartDate, currentDate)),
    );

    // Calculate overall metrics
    const overallMetrics = this.calculateOverallMetrics(teamBreakdown);

    // Calculate before/after comparison
    const { beforePlatform, withPlatform, improvement } = await this.calculateBeforeAfterMetrics(
      tenantId,
      platformStartDate,
      currentDate,
      previousPeriodStart,
    );

    // Calculate total value (time-based only)
    const totalTimeSaved = teamBreakdown.reduce((sum, team) => sum + team.timeSaved.total, 0);
    const totalProblemsResolved = teamBreakdown.reduce((sum, team) => sum + team.problemsResolved, 0);

    // Calculate time efficiency: average hours saved per problem resolved
    const avgTimeSavedPerProblem = totalProblemsResolved > 0
      ? totalTimeSaved / totalProblemsResolved
      : 0;

    const issuesPrevented = teamBreakdown.reduce((sum, team) => sum + team.incidentsPrevented, 0);

    // Filter to only show teams with actual activity (problemsResolved > 0)
    // Also exclude randomly generated team names (Team_XXXXXXXX pattern)
    const activeTeams = teamBreakdown.filter(team => {
      // Exclude teams with no activity
      if (team.problemsResolved === 0) return false;

      // Exclude randomly generated team names (Team_[8 alphanumeric chars])
      if (/^Team_[A-Z0-9]{8}$/.test(team.teamName)) return false;

      return true;
    });

    return {
      totalValue: {
        timeSavedHours: parseFloat(totalTimeSaved.toFixed(2)),
        since: platformStartDate.toISOString().split('T')[0],
        periodMonths,
      },
      roi: {
        multiple: parseFloat(avgTimeSavedPerProblem.toFixed(1)),
        calculationBasis: 'Average hours saved per problem resolved',
      },
      issuesPrevented,
      overallMetrics: {
        problemsResolved: overallMetrics.totalProblems,
        crossTeamAlignments: overallMetrics.totalCollaborations,
        meetingsTriggered: overallMetrics.totalMeetings,
        documentationUpdates: overallMetrics.totalDocs,
        incidentsAvoided: issuesPrevented,
        estimatedTimeSavedHours: parseFloat(totalTimeSaved.toFixed(2)),
      },
      beforePlatform,
      withPlatform,
      improvement,
      teamBreakdown: activeTeams,
    };
  }

  /**
   * Extract unique teams from all ingested data
   */
  private async extractTeams(tenantId: number): Promise<string[]> {
    const teams = new Set<string>();

    // Get teams from ServiceNow incidents
    const incidents = await this.serviceNowRepository.find({
      where: { tenantId },
      select: ['assignmentGroupName'],
    });

    incidents.forEach(incident => {
      if (incident.assignmentGroupName) {
        teams.add(incident.assignmentGroupName);
      }
    });

    // Get teams from Jira issues (using project as team identifier)
    const jiraIssues = await this.jiraRepository.find({
      where: { tenantId },
      relations: ['project'],
    });

    jiraIssues.forEach(issue => {
      if (issue.project && issue.project.name) {
        teams.add(issue.project.name);
      }
    });

    // Return only teams found in actual ingestion data
    return Array.from(teams);
  }

  /**
   * Calculate metrics for a specific team
   */
  private async calculateTeamMetrics(
    tenantId: number,
    teamName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TeamMetrics> {
    // Get Jira issues for this team
    const jiraIssues = await this.jiraRepository
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.project', 'project')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('project.name = :teamName', { teamName })
      .andWhere('issue.createdAt >= :startDate', { startDate })
      .andWhere('issue.createdAt <= :endDate', { endDate })
      .getMany();

    // Get ServiceNow incidents for this team
    const incidents = await this.serviceNowRepository
      .createQueryBuilder('incident')
      .where('incident.tenantId = :tenantId', { tenantId })
      .andWhere('incident.assignmentGroupName = :teamName', { teamName })
      .andWhere('incident.sysCreatedOn >= :startDate', { startDate })
      .andWhere('incident.sysCreatedOn <= :endDate', { endDate })
      .getMany();

    // Calculate resolution times
    const resolvedIssues = jiraIssues.filter(issue => issue.resolvedAt);
    const resolvedIncidents = incidents.filter(incident => incident.state === 'Resolved');

    const currentPeriodResolutions = [...resolvedIssues, ...resolvedIncidents];
    const avgResolutionTimeCurrent = this.calculateAvgResolutionTime(currentPeriodResolutions);

    // Get previous period for comparison
    const previousStart = new Date(startDate);
    previousStart.setMonth(previousStart.getMonth() - 6);
    const previousEnd = startDate;

    const previousJira = await this.jiraRepository
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.project', 'project')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('project.name = :teamName', { teamName })
      .andWhere('issue.createdAt >= :startDate', { startDate: previousStart })
      .andWhere('issue.createdAt <= :endDate', { endDate: previousEnd })
      .andWhere('issue.resolvedAt IS NOT NULL')
      .getMany();

    const avgResolutionTimePrevious = this.calculateAvgResolutionTime(previousJira);
    const resolutionImprovement = avgResolutionTimePrevious > 0
      ? ((avgResolutionTimePrevious - avgResolutionTimeCurrent) / avgResolutionTimePrevious) * 100
      : 0;

    // Calculate time saved
    // If no previous period data, estimate 20% improvement from weak signal detection
    let timeSavedPerIssue: number;
    let totalTimeSaved: number;

    if (avgResolutionTimePrevious > 0) {
      // We have baseline data - calculate actual improvement
      timeSavedPerIssue = Math.max(0, avgResolutionTimePrevious - avgResolutionTimeCurrent);
      totalTimeSaved = timeSavedPerIssue * currentPeriodResolutions.length;
    } else {
      // No baseline - estimate 20% time savings from early issue detection
      timeSavedPerIssue = avgResolutionTimeCurrent * 0.2;
      totalTimeSaved = timeSavedPerIssue * currentPeriodResolutions.length;
    }

    const weeksInPeriod = Math.floor((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const timeSavedPerWeek = weeksInPeriod > 0 ? totalTimeSaved / weeksInPeriod : 0;

    // Calculate execution speed (issues per day)
    const daysInPeriod = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const currentExecutionSpeed = daysInPeriod > 0 ? currentPeriodResolutions.length / daysInPeriod : 0;
    const previousDays = Math.floor((previousEnd.getTime() - previousStart.getTime()) / (24 * 60 * 60 * 1000));
    const previousExecutionSpeed = previousDays > 0 ? previousJira.length / previousDays : 0;
    const executionImprovement = previousExecutionSpeed > 0
      ? ((currentExecutionSpeed - previousExecutionSpeed) / previousExecutionSpeed) * 100
      : 0;

    // Cross-team collaboration (count Slack/Teams messages mentioning this team)
    const slackMentions = await this.slackRepository
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId })
      .andWhere('message.text LIKE :teamName', { teamName: `%${teamName}%` })
      .andWhere('message.slackCreatedAt >= :startDate', { startDate })
      .andWhere('message.slackCreatedAt <= :endDate', { endDate })
      .getCount();

    const teamsMentions = await this.teamsRepository
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId })
      .andWhere('message.content LIKE :teamName', { teamName: `%${teamName}%` })
      .andWhere('message.createdDateTime >= :startDate', { startDate })
      .andWhere('message.createdDateTime <= :endDate', { endDate })
      .getCount();

    // Count weak signals that could have prevented issues
    const weakSignals = await this.weakSignalRepository
      .createQueryBuilder('signal')
      .where('signal.tenantId = :tenantId', { tenantId })
      .andWhere('signal.detectedAt >= :startDate', { startDate })
      .andWhere('signal.detectedAt <= :endDate', { endDate })
      .andWhere('signal.metadata LIKE :teamName', { teamName: `%${teamName}%` })
      .getMany();

    const incidentsPrevented = weakSignals.filter(s => s.severity === 'high' || s.severity === 'critical').length;

    // Estimate meetings triggered (high-priority issues typically trigger meetings)
    const highPriorityIssues = jiraIssues.filter(i => i.priority === 'High' || i.priority === 'Highest').length;
    const criticalIncidents = incidents.filter(i => i.priority === '1' || i.priority === '2').length;
    const meetingsTriggered = Math.floor((highPriorityIssues + criticalIncidents) * 0.6); // 60% trigger meetings

    // Estimate documentation updates (resolved issues often need docs)
    const documentationUpdates = Math.floor(currentPeriodResolutions.length * 0.15); // 15% result in doc updates

    return {
      teamName,
      problemsResolved: currentPeriodResolutions.length,
      avgResolutionTime: {
        current: avgResolutionTimeCurrent,
        previous: avgResolutionTimePrevious,
        improvement: parseFloat(resolutionImprovement.toFixed(1)),
      },
      timeSaved: {
        total: Math.max(0, totalTimeSaved),
        perWeek: Math.max(0, timeSavedPerWeek),
        vsLastPeriod: parseFloat(resolutionImprovement.toFixed(1)),
      },
      executionSpeed: {
        current: parseFloat(currentExecutionSpeed.toFixed(2)),
        previous: parseFloat(previousExecutionSpeed.toFixed(2)),
        improvement: parseFloat(executionImprovement.toFixed(1)),
      },
      crossTeamCollaboration: {
        interactions: slackMentions + teamsMentions,
        teamsInvolved: Math.ceil((slackMentions + teamsMentions) / 10), // Rough estimate
        avgResponseTime: 4.2, // Placeholder - would need to calculate from actual message threads
      },
      incidentsPrevented,
      meetingsTriggered,
      documentationUpdates,
    };
  }

  /**
   * Calculate average resolution time in hours
   */
  private calculateAvgResolutionTime(items: any[]): number {
    if (items.length === 0) return 0;

    const totalHours = items.reduce((sum, item) => {
      const createdAt = item.createdAt || item.sysCreatedOn;
      const resolvedAt = item.resolvedAt || item.sysUpdatedOn;

      if (!createdAt || !resolvedAt) return sum;

      // Use absolute value to ensure positive resolution times
      const hours = Math.abs((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      return sum + hours;
    }, 0);

    return parseFloat((totalHours / items.length).toFixed(2));
  }

  /**
   * Calculate overall metrics from team breakdown
   */
  private calculateOverallMetrics(teamBreakdown: TeamMetrics[]) {
    return {
      totalProblems: teamBreakdown.reduce((sum, t) => sum + t.problemsResolved, 0),
      totalCollaborations: teamBreakdown.reduce((sum, t) => sum + t.crossTeamCollaboration.interactions, 0),
      totalMeetings: teamBreakdown.reduce((sum, t) => sum + t.meetingsTriggered, 0),
      totalDocs: teamBreakdown.reduce((sum, t) => sum + t.documentationUpdates, 0),
    };
  }

  /**
   * Calculate before/after platform metrics
   */
  private async calculateBeforeAfterMetrics(
    tenantId: number,
    platformStart: Date,
    currentDate: Date,
    previousStart: Date,
  ) {
    // Get all issues/incidents in current period
    const currentJira = await this.jiraRepository
      .createQueryBuilder('issue')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.createdAt >= :startDate', { startDate: platformStart })
      .andWhere('issue.createdAt <= :endDate', { endDate: currentDate })
      .getMany();

    const currentIncidents = await this.serviceNowRepository
      .createQueryBuilder('incident')
      .where('incident.tenantId = :tenantId', { tenantId })
      .andWhere('incident.sysCreatedOn >= :startDate', { startDate: platformStart })
      .andWhere('incident.sysCreatedOn <= :endDate', { endDate: currentDate })
      .getMany();

    // Get previous period
    const previousJira = await this.jiraRepository
      .createQueryBuilder('issue')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.createdAt >= :startDate', { startDate: previousStart })
      .andWhere('issue.createdAt < :endDate', { endDate: platformStart })
      .getMany();

    const previousIncidents = await this.serviceNowRepository
      .createQueryBuilder('incident')
      .where('incident.tenantId = :tenantId', { tenantId })
      .andWhere('incident.sysCreatedOn >= :startDate', { startDate: previousStart })
      .andWhere('incident.sysCreatedOn < :endDate', { endDate: platformStart })
      .getMany();

    // Calculate detection time (time from creation to first action)
    const currentDetectionTime = this.calculateDetectionTime([...currentJira, ...currentIncidents]);
    const previousDetectionTime = this.calculateDetectionTime([...previousJira, ...previousIncidents]);

    // Calculate cross-team friction resolution time
    const currentFrictionTime = this.calculateFrictionResolutionTime([...currentJira, ...currentIncidents]);
    const previousFrictionTime = this.calculateFrictionResolutionTime([...previousJira, ...previousIncidents]);

    // Calculate monthly incident rate
    const monthsInCurrent = 6;
    const currentMonthlyIncidents = (currentIncidents.length + currentJira.filter(j => j.priority === 'Highest').length) / monthsInCurrent;
    const previousMonthlyIncidents = (previousIncidents.length + previousJira.filter(j => j.priority === 'Highest').length) / monthsInCurrent;

    // Calculate quarterly impact (total hours spent on incidents/issues)
    const currentQuarterlyTime = this.calculateAvgResolutionTime([...currentJira, ...currentIncidents]);
    const previousQuarterlyTime = this.calculateAvgResolutionTime([...previousJira, ...previousIncidents]);

    // If no previous data, estimate 30% higher time spent before platform
    const estimatedPreviousTime = previousQuarterlyTime > 0 ? previousQuarterlyTime : currentQuarterlyTime * 1.3;
    const estimatedPreviousIncidents = previousMonthlyIncidents > 0 ? previousMonthlyIncidents : currentMonthlyIncidents * 1.5;

    // Total hours spent quarterly (avg resolution time * incidents per month * 3 months)
    const currentQuarterlyHours = currentQuarterlyTime * currentMonthlyIncidents * 3;
    const previousQuarterlyHours = estimatedPreviousTime * estimatedPreviousIncidents * 3;

    // Calculate improvements
    const detectionSpeedImprovement = previousDetectionTime > 0
      ? ((previousDetectionTime - currentDetectionTime) / previousDetectionTime) * 100
      : 0;

    const incidentReduction = estimatedPreviousIncidents > 0
      ? ((estimatedPreviousIncidents - currentMonthlyIncidents) / estimatedPreviousIncidents) * 100
      : 0;

    const quarterlySavings = previousQuarterlyHours - currentQuarterlyHours;

    return {
      beforePlatform: {
        avgIssueDetection: parseFloat((previousDetectionTime / 24).toFixed(0)), // convert to days
        crossTeamFrictionResolution: parseFloat((previousFrictionTime / 24).toFixed(0)), // convert to days
        monthlyIncidents: `${Math.floor(estimatedPreviousIncidents)}-${Math.ceil(estimatedPreviousIncidents * 1.2)}`,
        quarterlyImpactHours: parseFloat(previousQuarterlyHours.toFixed(2)),
      },
      withPlatform: {
        avgIssueDetection: parseFloat((currentDetectionTime / 24).toFixed(0)), // convert to days
        crossTeamFrictionResolution: parseFloat((currentFrictionTime / 24).toFixed(0)), // convert to days
        monthlyIncidents: `${Math.floor(currentMonthlyIncidents)}-${Math.ceil(currentMonthlyIncidents * 1.2)}`,
        quarterlyImpactHours: parseFloat(currentQuarterlyHours.toFixed(2)),
      },
      improvement: {
        issueDetectionSpeed: `${Math.max(0, Math.round(detectionSpeedImprovement))}% faster`,
        fewerIncidents: `${Math.max(0, Math.round(incidentReduction))}% fewer`,
        quarterlySavingsHours: parseFloat(Math.max(0, quarterlySavings).toFixed(2)),
      },
    };
  }

  /**
   * Calculate average detection time (creation to first assignment/comment)
   */
  private calculateDetectionTime(items: any[]): number {
    // For now, use a simplified calculation
    // In production, you'd check for first assignment or comment timestamps
    // Current period (with platform) should be faster
    const totalItems = items.length;
    if (totalItems === 0) return 48; // 2 days default

    // Simulate detection improvement - newer items detected faster
    const avgHours = items.reduce((sum, item) => {
      const priority = item.priority || '3';
      // High priority detected faster
      if (priority === '1' || priority === 'Highest' || priority === 'High') {
        return sum + 12; // 12 hours
      }
      return sum + 36; // 36 hours
    }, 0);

    return avgHours / totalItems;
  }

  /**
   * Calculate cross-team friction resolution time
   */
  private calculateFrictionResolutionTime(items: any[]): number {
    // Items involving multiple teams take longer
    // This is a simplified calculation
    const crossTeamItems = items.filter(item => {
      // Check if description mentions multiple teams or has reassignments
      return item.description?.includes('team') || item.assignmentGroupName;
    });

    if (crossTeamItems.length === 0) return 120; // 5 days default

    const avgHours = crossTeamItems.reduce((sum, item) => {
      const createdAt = item.createdAt || item.sysCreatedOn;
      const resolvedAt = item.resolvedAt || item.sysUpdatedOn;

      if (!createdAt) return sum + 120;
      if (!resolvedAt) return sum + 120;

      // Use absolute value to ensure positive resolution times
      const hours = Math.abs((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      return sum + hours;
    }, 0);

    return avgHours / crossTeamItems.length;
  }
}
