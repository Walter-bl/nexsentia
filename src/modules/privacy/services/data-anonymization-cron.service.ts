import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { PiiAnonymizationService } from './pii-anonymization.service';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';

@Injectable()
export class DataAnonymizationCronService implements OnModuleInit {
  private readonly logger = new Logger(DataAnonymizationCronService.name);
  private readonly isEnabled: boolean;
  private readonly cronSchedule: string;
  private readonly cronTimezone: string;

  constructor(
    private readonly anonymizationService: PiiAnonymizationService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(JiraIssue)
    private readonly jiraRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowRepository: Repository<ServiceNowIncident>,
    @InjectRepository(SlackMessage)
    private readonly slackRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsRepository: Repository<TeamsMessage>,
  ) {
    // Check if anonymization cron is enabled
    this.isEnabled = this.configService.get<string>('ENABLE_ANONYMIZATION_CRON', 'false') === 'true';
    this.cronSchedule = this.configService.get<string>('ANONYMIZATION_CRON_SCHEDULE', '0 0 2 * * *');
    this.cronTimezone = this.configService.get<string>('ANONYMIZATION_CRON_TIMEZONE', 'America/New_York');

    if (this.isEnabled) {
      this.logger.log(`Data anonymization cron job is ENABLED (schedule: ${this.cronSchedule}, timezone: ${this.cronTimezone})`);
    } else {
      this.logger.warn('Data anonymization cron job is DISABLED. Set ENABLE_ANONYMIZATION_CRON=true to enable.');
    }
  }

  onModuleInit() {
    if (!this.isEnabled) {
      return;
    }

    // Register dynamic cron job for anonymization
    const anonymizationJob = new CronJob(
      this.cronSchedule,
      () => {
        this.handleDailyAnonymization();
      },
      null,
      true,
      this.cronTimezone,
    );

    this.schedulerRegistry.addCronJob('data-anonymization', anonymizationJob);
    this.logger.log(`Registered data-anonymization cron job: ${this.cronSchedule} (${this.cronTimezone})`);

    // Register cleanup job (runs 1 hour after anonymization)
    const cleanupSchedule = this.calculateCleanupSchedule(this.cronSchedule);
    const cleanupJob = new CronJob(
      cleanupSchedule,
      () => {
        this.cleanupOldMappings();
      },
      null,
      true,
      this.cronTimezone,
    );

    this.schedulerRegistry.addCronJob('cleanup-anonymization-mappings', cleanupJob);
    this.logger.log(`Registered cleanup cron job: ${cleanupSchedule} (${this.cronTimezone})`);
  }

  /**
   * Calculate cleanup schedule to run 1 hour after anonymization
   */
  private calculateCleanupSchedule(anonymizationSchedule: string): string {
    // Parse the schedule (format: second minute hour day month weekday)
    // Filter out empty strings from split to handle multiple spaces
    const parts = anonymizationSchedule.trim().split(/\s+/);

    if (parts.length === 6) {
      const hourPart = parts[2];
      // If hour is a wildcard, pattern, or can't be parsed, use default cleanup schedule
      if (hourPart === '*' || hourPart.includes('*') || hourPart.includes('/')) {
        this.logger.debug(`Hour field contains wildcard/pattern (${hourPart}), using default cleanup schedule`);
        return '0 0 3 * * *'; // Default: 3 AM daily
      }

      const hour = parseInt(hourPart, 10);
      if (isNaN(hour)) {
        this.logger.debug(`Could not parse hour (${hourPart}), using default cleanup schedule`);
        return '0 0 3 * * *';
      }

      const cleanupHour = (hour + 1) % 24;
      parts[2] = cleanupHour.toString();
      return parts.join(' ');
    }

    // Fallback to 3 AM if can't parse
    this.logger.debug(`Invalid cron format (${parts.length} parts), using default cleanup schedule`);
    return '0 0 3 * * *';
  }

  /**
   * Run daily to anonymize ingestion data
   * Schedule configured via ANONYMIZATION_CRON_SCHEDULE env variable
   * Only runs if ENABLE_ANONYMIZATION_CRON=true in .env
   *
   * This only anonymizes data from external integrations (Jira, ServiceNow, Slack, Teams)
   * User accounts are NOT anonymized
   */
  async handleDailyAnonymization() {
    this.logger.log('Starting daily data anonymization job for ingestion data...');

    try {
      const stats = {
        jira: 0,
        serviceNow: 0,
        slack: 0,
        teams: 0,
      };

      // Anonymize Jira data
      stats.jira = await this.anonymizeJiraData();

      // Anonymize ServiceNow data
      stats.serviceNow = await this.anonymizeServiceNowData();

      // Anonymize Slack data
      stats.slack = await this.anonymizeSlackData();

      // Anonymize Teams data
      stats.teams = await this.anonymizeTeamsData();

      this.logger.log('Data anonymization completed successfully', stats);
    } catch (error) {
      this.logger.error('Error during data anonymization:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for anonymization (can be called via API endpoint)
   * Only anonymizes ingestion data, NOT user accounts
   */
  async anonymizeAllData(): Promise<{
    jira: number;
    serviceNow: number;
    slack: number;
    teams: number;
  }> {
    this.logger.log('Manual anonymization triggered for ingestion data...');

    return {
      jira: await this.anonymizeJiraData(),
      serviceNow: await this.anonymizeServiceNowData(),
      slack: await this.anonymizeSlackData(),
      teams: await this.anonymizeTeamsData(),
    };
  }

  /**
   * Anonymize Jira issues
   */
  private async anonymizeJiraData(): Promise<number> {
    const issues = await this.jiraRepository.find();
    let count = 0;

    for (const issue of issues) {
      let updated = false;

      // Anonymize assignee display name
      if (issue.assigneeDisplayName && !issue.assigneeDisplayName.startsWith('User_')) {
        issue.assigneeDisplayName = `User_${this.generateRandomId()}`;
        updated = true;
      }

      // Anonymize reporter display name
      if (issue.reporterDisplayName && !issue.reporterDisplayName.startsWith('User_')) {
        issue.reporterDisplayName = `User_${this.generateRandomId()}`;
        updated = true;
      }

      // Anonymize account IDs (email-like values)
      if (issue.assigneeAccountId && issue.assigneeAccountId.includes('@')) {
        issue.assigneeAccountId = `user${this.generateRandomId()}@anonymized.local`;
        updated = true;
      }

      if (issue.reporterAccountId && issue.reporterAccountId.includes('@')) {
        issue.reporterAccountId = `user${this.generateRandomId()}@anonymized.local`;
        updated = true;
      }

      // Anonymize sensitive content in description
      if (issue.description && this.containsSensitiveData(issue.description)) {
        issue.description = this.anonymizeSensitiveContent(issue.description);
        updated = true;
      }

      if (updated) {
        await this.jiraRepository.save(issue);
        count++;
      }
    }

    this.logger.log(`Anonymized ${count} Jira issues`);
    return count;
  }

  /**
   * Anonymize ServiceNow incidents
   */
  private async anonymizeServiceNowData(): Promise<number> {
    const incidents = await this.serviceNowRepository.find();
    let count = 0;

    for (const incident of incidents) {
      let updated = false;

      // Anonymize assigned user name
      if (incident.assignedToName && !incident.assignedToName.startsWith('User_')) {
        incident.assignedToName = `User_${this.generateRandomId()}`;
        updated = true;
      }

      // Anonymize caller name
      if (incident.callerName && !incident.callerName.startsWith('User_')) {
        incident.callerName = `User_${this.generateRandomId()}`;
        updated = true;
      }

      // Anonymize assignment group if it contains real names
      if (incident.assignmentGroupName && !incident.assignmentGroupName.includes('Team')) {
        incident.assignmentGroupName = `Team_${this.generateRandomId()}`;
        updated = true;
      }

      // Anonymize description
      if (incident.description && this.containsSensitiveData(incident.description)) {
        incident.description = this.anonymizeSensitiveContent(incident.description);
        updated = true;
      }

      // Anonymize resolution notes
      if (incident.resolutionNotes && this.containsSensitiveData(incident.resolutionNotes)) {
        incident.resolutionNotes = this.anonymizeSensitiveContent(incident.resolutionNotes);
        updated = true;
      }

      if (updated) {
        await this.serviceNowRepository.save(incident);
        count++;
      }
    }

    this.logger.log(`Anonymized ${count} ServiceNow incidents`);
    return count;
  }

  /**
   * Anonymize Slack messages
   */
  private async anonymizeSlackData(): Promise<number> {
    const messages = await this.slackRepository.find();
    let count = 0;

    for (const message of messages) {
      let updated = false;

      // Anonymize user ID
      if (message.slackUserId && !message.slackUserId.startsWith('U_ANON_')) {
        message.slackUserId = `U_ANON_${this.generateRandomId()}`;
        updated = true;
      }

      // Anonymize message text containing sensitive data
      if (message.text && this.containsSensitiveData(message.text)) {
        message.text = this.anonymizeSensitiveContent(message.text);
        updated = true;
      }

      if (updated) {
        await this.slackRepository.save(message);
        count++;
      }
    }

    this.logger.log(`Anonymized ${count} Slack messages`);
    return count;
  }

  /**
   * Anonymize Teams messages
   */
  private async anonymizeTeamsData(): Promise<number> {
    const messages = await this.teamsRepository.find();
    let count = 0;

    for (const message of messages) {
      let updated = false;

      // Anonymize user ID
      if (message.teamsUserId && !message.teamsUserId.startsWith('TEAMS_ANON_')) {
        message.teamsUserId = `TEAMS_ANON_${this.generateRandomId()}`;
        updated = true;
      }

      // Anonymize content
      if (message.content && this.containsSensitiveData(message.content)) {
        message.content = this.anonymizeSensitiveContent(message.content);
        updated = true;
      }

      if (updated) {
        await this.teamsRepository.save(message);
        count++;
      }
    }

    this.logger.log(`Anonymized ${count} Teams messages`);
    return count;
  }

  /**
   * Check if text contains potentially sensitive data
   */
  private containsSensitiveData(text: string): boolean {
    const sensitivePatterns = [
      // Email addresses
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      // Phone numbers
      /(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/,
      // SSN-like patterns
      /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
      // Credit card-like patterns
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
      // IP addresses (might be sensitive in some contexts)
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
      // Names (common patterns - this is basic and may need enhancement)
      /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
    ];

    return sensitivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Anonymize sensitive content in text
   */
  private anonymizeSensitiveContent(text: string): string {
    let anonymized = text;

    // Replace emails
    anonymized = anonymized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      (match) => `user${this.generateRandomId()}@anonymized.local`,
    );

    // Replace phone numbers
    anonymized = anonymized.replace(
      /(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g,
      '***-***-****',
    );

    // Replace SSN-like patterns
    anonymized = anonymized.replace(
      /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
      '***-**-****',
    );

    // Replace credit card-like patterns
    anonymized = anonymized.replace(
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      '****-****-****-****',
    );

    // Replace IP addresses
    anonymized = anonymized.replace(
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      'XXX.XXX.XXX.XXX',
    );

    // Replace names with titles
    anonymized = anonymized.replace(
      /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
      (match) => `Anonymized Person ${this.generateRandomId()}`,
    );

    return anonymized;
  }

  /**
   * Generate random alphanumeric ID
   */
  private generateRandomId(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  /**
   * Cleanup old anonymization mappings (keep mappings for 90 days)
   * Schedule calculated to run 1 hour after anonymization
   * Only runs if ENABLE_ANONYMIZATION_CRON=true in .env
   */
  async cleanupOldMappings() {
    this.logger.log('Starting cleanup of old anonymization mappings...');

    const count = await this.anonymizationService.cleanupExpiredTokens();

    this.logger.log(`Cleaned up ${count} expired anonymization mappings`);
  }
}
