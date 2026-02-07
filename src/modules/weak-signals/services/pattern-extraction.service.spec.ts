import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PatternExtractionService } from './pattern-extraction.service';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../../slack/entities/slack-message.entity';
import { TeamsMessage } from '../../teams/entities/teams-message.entity';
import { TimelineEvent } from '../../timeline/entities/timeline-event.entity';

describe('PatternExtractionService', () => {
  let service: PatternExtractionService;

  const mockJiraRepository = {
    find: jest.fn(),
  };

  const mockServiceNowRepository = {
    find: jest.fn(),
  };

  const mockSlackRepository = {
    find: jest.fn(),
  };

  const mockTeamsRepository = {
    find: jest.fn(),
  };

  const mockTimelineRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatternExtractionService,
        {
          provide: getRepositoryToken(JiraIssue),
          useValue: mockJiraRepository,
        },
        {
          provide: getRepositoryToken(ServiceNowIncident),
          useValue: mockServiceNowRepository,
        },
        {
          provide: getRepositoryToken(SlackMessage),
          useValue: mockSlackRepository,
        },
        {
          provide: getRepositoryToken(TeamsMessage),
          useValue: mockTeamsRepository,
        },
        {
          provide: getRepositoryToken(TimelineEvent),
          useValue: mockTimelineRepository,
        },
      ],
    }).compile();

    service = module.get<PatternExtractionService>(PatternExtractionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractRecurringPatterns', () => {
    it('should extract patterns from Jira issues', async () => {
      const now = new Date();
      const mockIssues = [
        {
          id: 1,
          tenantId: 1,
          summary: 'Production database connection pool timeout',
          jiraCreatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: 2,
          tenantId: 1,
          summary: 'Production database connection pool timeout issue',
          jiraCreatedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        },
        {
          id: 3,
          tenantId: 1,
          summary: 'Production database connection pool timeout error',
          jiraCreatedAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
          createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
        },
      ];

      mockJiraRepository.find.mockResolvedValue(mockIssues);
      mockServiceNowRepository.find.mockResolvedValue([]);
      mockSlackRepository.find.mockResolvedValue([]);
      mockTeamsRepository.find.mockResolvedValue([]);
      mockTimelineRepository.find.mockResolvedValue([]);

      const result = await service.extractRecurringPatterns(1, 90);

      expect(result.length).toBeGreaterThan(0);
      const jiraPattern = result.find(p => p.type === 'issue_recurrence');
      expect(jiraPattern).toBeDefined();
      expect(jiraPattern?.occurrences).toBe(3);
      expect(jiraPattern?.frequency).toBe('weekly');
    });

    it('should detect keyword spikes in communication', async () => {
      const now = new Date();
      const recentMessages = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: i,
          text: 'Server error detected in production',
          slackCreatedAt: new Date(now.getTime() - i * 12 * 60 * 60 * 1000), // Last 5 days
        }));

      const olderMessages = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: i + 10,
          text: 'Server error in staging',
          slackCreatedAt: new Date(now.getTime() - (20 + i) * 24 * 60 * 60 * 1000), // 20-25 days ago
        }));

      mockJiraRepository.find.mockResolvedValue([]);
      mockServiceNowRepository.find.mockResolvedValue([]);
      mockSlackRepository.find.mockResolvedValue([...recentMessages, ...olderMessages]);
      mockTeamsRepository.find.mockResolvedValue([]);
      mockTimelineRepository.find.mockResolvedValue([]);

      const result = await service.extractRecurringPatterns(1, 90);

      const keywordPattern = result.find(p => p.type === 'keyword_spike');
      expect(keywordPattern).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      mockJiraRepository.find.mockResolvedValue([]);
      mockServiceNowRepository.find.mockResolvedValue([]);
      mockSlackRepository.find.mockResolvedValue([]);
      mockTeamsRepository.find.mockResolvedValue([]);
      mockTimelineRepository.find.mockResolvedValue([]);

      const result = await service.extractRecurringPatterns(1, 90);

      expect(result).toEqual([]);
    });
  });
});
