import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { GmailMessage } from '../../gmail/entities/gmail-message.entity';
import { OutlookMessage } from '../../outlook/entities/outlook-message.entity';
import { TimelineEvent } from '../../timeline/entities/timeline-event.entity';

export interface RecurringPattern {
  patternId: string;
  type: 'issue_recurrence' | 'incident_recurrence' | 'keyword_spike' | 'temporal_pattern';
  description: string;
  occurrences: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'irregular';
  lastOccurrence: Date;
  predictedNext: Date | null;
  similarities: string[];
  confidenceScore: number;
  evidence: {
    source: string;
    sourceId: string;
    timestamp: Date;
    relevanceScore: number;
  }[];
}

@Injectable()
export class PatternExtractionService {
  private readonly logger = new Logger(PatternExtractionService.name);

  constructor(
    @InjectRepository(JiraIssue)
    private readonly jiraIssueRepository: Repository<JiraIssue>,
    @InjectRepository(ServiceNowIncident)
    private readonly serviceNowIncidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(SlackMessage)
    private readonly slackMessageRepository: Repository<SlackMessage>,
    @InjectRepository(TeamsMessage)
    private readonly teamsMessageRepository: Repository<TeamsMessage>,
    @InjectRepository(GmailMessage)
    private readonly gmailMessageRepository: Repository<GmailMessage>,
    @InjectRepository(OutlookMessage)
    private readonly outlookMessageRepository: Repository<OutlookMessage>,
    @InjectRepository(TimelineEvent)
    private readonly timelineEventRepository: Repository<TimelineEvent>,
  ) {}

  /**
   * Extract recurring patterns from ingested data
   */
  async extractRecurringPatterns(tenantId: number, daysBack: number = 90): Promise<RecurringPattern[]> {
    this.logger.log(`Extracting recurring patterns for tenant ${tenantId} over last ${daysBack} days`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const patterns: RecurringPattern[] = [];

    // Extract patterns from different sources in parallel
    const [jiraPatterns, serviceNowPatterns, communicationPatterns, timelinePatterns] = await Promise.all([
      this.extractJiraRecurringIssues(tenantId, startDate),
      this.extractServiceNowRecurringIncidents(tenantId, startDate),
      this.extractCommunicationKeywordSpikes(tenantId, startDate),
      this.extractTimelineRecurringEvents(tenantId, startDate),
    ]);

    patterns.push(...jiraPatterns, ...serviceNowPatterns, ...communicationPatterns, ...timelinePatterns);

    // Sort by confidence score
    patterns.sort((a, b) => b.confidenceScore - a.confidenceScore);

    this.logger.log(`Extracted ${patterns.length} recurring patterns`);

    return patterns;
  }

  /**
   * Extract recurring Jira issues
   */
  private async extractJiraRecurringIssues(tenantId: number, startDate: Date): Promise<RecurringPattern[]> {
    const issues = await this.jiraIssueRepository.find({
      where: {
        tenantId,
        jiraCreatedAt: MoreThan(startDate),
      },
      order: { jiraCreatedAt: 'DESC' },
    });

    this.logger.debug(`Found ${issues.length} JIRA issues for tenant ${tenantId}`);

    const patterns: RecurringPattern[] = [];
    const summaryGroups = this.groupBySimilarity(issues.map(i => ({ id: i.id.toString(), text: i.summary, date: i.jiraCreatedAt || i.createdAt })));

    for (const [signature, group] of Object.entries(summaryGroups)) {
      if (group.length >= 3) { // At least 3 similar issues
        const timestamps = group.map(g => g.date.getTime()).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const frequency = this.determineFrequency(avgInterval);
        const lastOccurrence = new Date(timestamps[timestamps.length - 1]);
        const predictedNext = new Date(lastOccurrence.getTime() + avgInterval);

        const confidence = this.calculatePatternConfidence(group.length, intervals, 'jira');

        patterns.push({
          patternId: `jira_recurring_${signature}`,
          type: 'issue_recurrence',
          description: `Recurring issue pattern detected: "${group[0].text.substring(0, 100)}"`,
          occurrences: group.length,
          frequency,
          lastOccurrence,
          predictedNext,
          similarities: group.map(g => g.text),
          confidenceScore: confidence,
          evidence: group.map(g => ({
            source: 'jira',
            sourceId: g.id,
            timestamp: g.date,
            relevanceScore: 90,
          })),
        });
      }
    }

    return patterns;
  }

  /**
   * Extract recurring ServiceNow incidents
   */
  private async extractServiceNowRecurringIncidents(tenantId: number, startDate: Date): Promise<RecurringPattern[]> {
    const incidents = await this.serviceNowIncidentRepository.find({
      where: {
        tenantId,
        sysCreatedOn: MoreThan(startDate),
      },
      order: { sysCreatedOn: 'DESC' },
    });

    this.logger.debug(`Found ${incidents.length} ServiceNow incidents for tenant ${tenantId}`);

    const patterns: RecurringPattern[] = [];
    const descriptionGroups = this.groupBySimilarity(
      incidents.map(i => ({
        id: i.id.toString(),
        text: i.shortDescription || i.description || '',
        date: i.sysCreatedOn || i.createdAt,
      }))
    );

    for (const [signature, group] of Object.entries(descriptionGroups)) {
      if (group.length >= 3) {
        const timestamps = group.map(g => g.date.getTime()).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const frequency = this.determineFrequency(avgInterval);
        const lastOccurrence = new Date(timestamps[timestamps.length - 1]);
        const predictedNext = new Date(lastOccurrence.getTime() + avgInterval);

        const confidence = this.calculatePatternConfidence(group.length, intervals, 'servicenow');

        patterns.push({
          patternId: `servicenow_recurring_${signature}`,
          type: 'incident_recurrence',
          description: `Recurring incident pattern: "${group[0].text.substring(0, 100)}"`,
          occurrences: group.length,
          frequency,
          lastOccurrence,
          predictedNext,
          similarities: group.map(g => g.text),
          confidenceScore: confidence,
          evidence: group.map(g => ({
            source: 'servicenow',
            sourceId: g.id,
            timestamp: g.date,
            relevanceScore: 85,
          })),
        });
      }
    }

    return patterns;
  }

  /**
   * Extract keyword spikes from communication channels
   */
  private async extractCommunicationKeywordSpikes(tenantId: number, startDate: Date): Promise<RecurringPattern[]> {
    const [slackMessages, teamsMessages, gmailMessages, outlookMessages] = await Promise.all([
      this.slackMessageRepository.find({
        where: {
          tenantId,
          slackCreatedAt: MoreThan(startDate),
        },
        order: { slackCreatedAt: 'DESC' },
      }),
      this.teamsMessageRepository.find({
        where: {
          tenantId,
          createdDateTime: MoreThan(startDate),
        },
        order: { createdDateTime: 'DESC' },
      }),
      this.gmailMessageRepository.find({
        where: {
          tenantId,
          gmailCreatedAt: MoreThan(startDate),
        },
        order: { gmailCreatedAt: 'DESC' },
      }),
      this.outlookMessageRepository.find({
        where: {
          tenantId,
          outlookCreatedAt: MoreThan(startDate),
        },
        order: { outlookCreatedAt: 'DESC' },
      }),
    ]);

    const patterns: RecurringPattern[] = [];

    // Extract keywords from messages
    const allMessages = [
      ...slackMessages.map(m => ({ text: m.text || '', date: m.slackCreatedAt, source: 'slack', id: m.id.toString() })),
      ...teamsMessages.map(m => ({ text: m.content || '', date: m.createdDateTime, source: 'teams', id: m.id.toString() })),
      ...gmailMessages.map(m => ({ text: `${m.subject} ${m.bodyText || ''}`, date: m.gmailCreatedAt, source: 'gmail', id: m.id.toString() })),
      ...outlookMessages.map(m => ({ text: `${m.subject} ${m.bodyText || ''}`, date: m.outlookCreatedAt, source: 'outlook', id: m.id.toString() })),
    ];

    this.logger.log(`[extractCommunicationKeywordSpikes] Message counts - Slack: ${slackMessages.length}, Teams: ${teamsMessages.length}, Gmail: ${gmailMessages.length}, Outlook: ${outlookMessages.length}`);

    const keywordFrequency = this.extractKeywords(allMessages);

    // Detect spikes in keyword usage - analyze per source to create separate patterns
    for (const [keyword, mentions] of Object.entries(keywordFrequency)) {
      // Group mentions by source first
      const mentionsBySource = {
        slack: mentions.filter(m => m.source === 'slack'),
        teams: mentions.filter(m => m.source === 'teams'),
        gmail: mentions.filter(m => m.source === 'gmail'),
        outlook: mentions.filter(m => m.source === 'outlook'),
      };

      // Analyze each source independently
      for (const [source, sourceMentions] of Object.entries(mentionsBySource)) {
        // Skip if this source doesn't have enough mentions
        if (sourceMentions.length < 5) {
          if ((source === 'gmail' || source === 'outlook') && sourceMentions.length > 0) {
            this.logger.log(`[extractCommunicationKeywordSpikes] Skipping ${source} for keyword "${keyword}" - only ${sourceMentions.length} mentions (need 5)`);
          }
          continue;
        }

        const sourceRecentMentions = sourceMentions.filter(m => m.date.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sourceOlderMentions = sourceMentions.filter(m => m.date.getTime() <= Date.now() - 7 * 24 * 60 * 60 * 1000);

        const sourceRecentRate = sourceRecentMentions.length / 7;
        const sourceHistoricalRate = sourceOlderMentions.length > 0
          ? sourceOlderMentions.length / Math.max(1, (sourceMentions.length - sourceRecentMentions.length) / 7)
          : 0.1; // Small baseline if no historical data

        // Check if this source has a spike (2x increase) and at least 3 recent mentions
        if (sourceRecentRate > sourceHistoricalRate * 2 && sourceRecentMentions.length >= 3) {
          const sourceConfidence = Math.min(95, 60 + (sourceRecentRate / sourceHistoricalRate) * 10);

          if (source === 'gmail' || source === 'outlook') {
            this.logger.log(`[extractCommunicationKeywordSpikes] Creating ${source} pattern for keyword "${keyword}" - ${sourceRecentMentions.length} recent mentions, confidence: ${sourceConfidence}`);
          }

          patterns.push({
            patternId: `keyword_spike_${this.hashString(keyword)}_${source}`,
            type: 'keyword_spike',
            description: `Keyword spike detected: "${keyword}" mentioned ${sourceRecentMentions.length}x in last 7 days (${Math.round(sourceRecentRate / sourceHistoricalRate)}x increase)`,
            occurrences: sourceRecentMentions.length,
            frequency: 'irregular',
            lastOccurrence: sourceRecentMentions[sourceRecentMentions.length - 1].date,
            predictedNext: null,
            similarities: sourceMentions.map(m => m.text.substring(0, 100)),
            confidenceScore: sourceConfidence,
            evidence: sourceRecentMentions.map(m => ({
              source: m.source,
              sourceId: m.id,
              timestamp: m.date,
              relevanceScore: 70,
            })),
          });
        } else if (source === 'gmail' || source === 'outlook') {
          this.logger.log(`[extractCommunicationKeywordSpikes] ${source} keyword "${keyword}" did not meet spike criteria - recent: ${sourceRecentMentions.length}, rate: ${sourceRecentRate.toFixed(2)}, historical: ${sourceHistoricalRate.toFixed(2)}`);
        }
      }
    }

    this.logger.log(`[extractCommunicationKeywordSpikes] Total patterns created: ${patterns.length}`);

    return patterns;
  }

  /**
   * Extract recurring timeline events
   */
  private async extractTimelineRecurringEvents(tenantId: number, startDate: Date): Promise<RecurringPattern[]> {
    const events = await this.timelineEventRepository.find({
      where: {
        tenantId,
        eventDate: MoreThan(startDate),
        isActive: true,
      },
      order: { eventDate: 'DESC' },
    });

    const patterns: RecurringPattern[] = [];
    const eventGroups = this.groupBySimilarity(events.map(e => ({ id: e.id.toString(), text: e.title, date: e.eventDate })));

    for (const [signature, group] of Object.entries(eventGroups)) {
      if (group.length >= 2) {
        const timestamps = group.map(g => g.date.getTime()).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
        const frequency = this.determineFrequency(avgInterval);
        const lastOccurrence = new Date(timestamps[timestamps.length - 1]);
        const predictedNext = avgInterval > 0 ? new Date(lastOccurrence.getTime() + avgInterval) : null;

        const confidence = this.calculatePatternConfidence(group.length, intervals, 'timeline');

        patterns.push({
          patternId: `timeline_recurring_${signature}`,
          type: 'temporal_pattern',
          description: `Recurring timeline event: "${group[0].text.substring(0, 100)}"`,
          occurrences: group.length,
          frequency,
          lastOccurrence,
          predictedNext,
          similarities: group.map(g => g.text),
          confidenceScore: confidence,
          evidence: group.map(g => ({
            source: 'timeline',
            sourceId: g.id,
            timestamp: g.date,
            relevanceScore: 80,
          })),
        });
      }
    }

    return patterns;
  }

  /**
   * Group items by similarity using simple text matching
   */
  private groupBySimilarity(items: { id: string; text: string; date: Date }[]): Record<string, typeof items> {
    const groups: Record<string, typeof items> = {};

    for (const item of items) {
      const signature = this.generateTextSignature(item.text);
      if (!groups[signature]) {
        groups[signature] = [];
      }
      groups[signature].push(item);
    }

    return groups;
  }

  /**
   * Generate a signature for text similarity matching
   */
  private generateTextSignature(text: string): string {
    // Remove numbers, normalize whitespace, convert to lowercase
    const normalized = text
      .toLowerCase()
      .replace(/\d+/g, 'N') // Replace numbers with 'N'
      .replace(/\s+/g, ' ')
      .trim();

    // Extract key words (words longer than 3 chars)
    const words = normalized.split(' ').filter(w => w.length > 3);

    // Take first 5 significant words as signature
    return words.slice(0, 5).join('_');
  }

  /**
   * Extract keywords from messages
   */
  private extractKeywords(messages: { text: string; date: Date; source: string; id: string }[]): Record<
    string,
    typeof messages
  > {
    const keywords: Record<string, typeof messages> = {};

    // Common technical keywords to track
    const technicalTerms = [
      'error',
      'failure',
      'crash',
      'down',
      'outage',
      'timeout',
      'slow',
      'performance',
      'bug',
      'issue',
      'problem',
      'critical',
      'urgent',
      'broken',
      'failed',
      'exception',
      'warning',
      'alert',
      'incident',
      'degraded',
      'unavailable',
    ];

    for (const message of messages) {
      const textLower = message.text.toLowerCase();

      for (const term of technicalTerms) {
        if (textLower.includes(term)) {
          if (!keywords[term]) {
            keywords[term] = [];
          }
          keywords[term].push(message);
        }
      }
    }

    return keywords;
  }

  /**
   * Determine frequency based on average interval
   */
  private determineFrequency(avgInterval: number): 'daily' | 'weekly' | 'monthly' | 'irregular' {
    const days = avgInterval / (24 * 60 * 60 * 1000);

    if (days < 2) return 'daily';
    if (days < 10) return 'weekly';
    if (days < 35) return 'monthly';
    return 'irregular';
  }

  /**
   * Calculate pattern confidence score
   */
  private calculatePatternConfidence(occurrences: number, intervals: number[], source: string): number {
    // Base confidence on number of occurrences
    let confidence = Math.min(50 + occurrences * 5, 70);

    // Adjust for interval consistency
    if (intervals.length > 1) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / avgInterval;

      // Lower variation = higher confidence
      if (coefficientOfVariation < 0.2) confidence += 15;
      else if (coefficientOfVariation < 0.4) confidence += 10;
      else if (coefficientOfVariation < 0.6) confidence += 5;
    }

    // Adjust for source reliability
    const sourceBonus: Record<string, number> = { jira: 10, servicenow: 10, timeline: 5, slack: 0, teams: 0 };
    confidence += sourceBonus[source] || 0;

    return Math.min(confidence, 95);
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
