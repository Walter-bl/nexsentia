import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JiraIngestionService } from './jira-ingestion.service';
import { JiraConnection } from '../entities/jira-connection.entity';
import { JiraIssue } from '../entities/jira-issue.entity';
import { JiraProject } from '../entities/jira-project.entity';
import { JiraSyncHistory } from '../entities/jira-sync-history.entity';
import { JiraApiClientService } from './jira-api-client.service';
import { JiraOAuthService } from './jira-oauth.service';

describe('JiraIngestionService', () => {
  let service: JiraIngestionService;
  let connectionRepository: Repository<JiraConnection>;
  let issueRepository: Repository<JiraIssue>;
  let projectRepository: Repository<JiraProject>;
  let syncHistoryRepository: Repository<JiraSyncHistory>;
  let apiClient: JiraApiClientService;
  let oauthService: JiraOAuthService;

  const mockConnectionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockIssueRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockProjectRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };


  const mockSyncHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockApiClient = {
    getProjects: jest.fn(),
    searchIssues: jest.fn(),
    getUsers: jest.fn(),
  };

  const mockOAuthService = {
    ensureValidToken: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'JIRA_SYNC_INTERVAL_MINUTES') return 30;
      if (key === 'JIRA_MAX_ISSUES_PER_SYNC') return 1000;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JiraIngestionService,
        {
          provide: getRepositoryToken(JiraConnection),
          useValue: mockConnectionRepository,
        },
        {
          provide: getRepositoryToken(JiraIssue),
          useValue: mockIssueRepository,
        },
        {
          provide: getRepositoryToken(JiraProject),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(JiraSyncHistory),
          useValue: mockSyncHistoryRepository,
        },
        {
          provide: JiraApiClientService,
          useValue: mockApiClient,
        },
        {
          provide: JiraOAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<JiraIngestionService>(JiraIngestionService);
    connectionRepository = module.get<Repository<JiraConnection>>(
      getRepositoryToken(JiraConnection),
    );
    issueRepository = module.get<Repository<JiraIssue>>(
      getRepositoryToken(JiraIssue),
    );
    projectRepository = module.get<Repository<JiraProject>>(
      getRepositoryToken(JiraProject),
    );
    syncHistoryRepository = module.get<Repository<JiraSyncHistory>>(
      getRepositoryToken(JiraSyncHistory),
    );
    apiClient = module.get<JiraApiClientService>(JiraApiClientService);
    oauthService = module.get<JiraOAuthService>(JiraOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncConnection', () => {
    const mockConnection = {
      id: 1,
      tenantId: 1,
      cloudId: 'test-cloud-id',
      siteUrl: 'https://test.atlassian.net',
      accessToken: 'test-token',
      syncSettings: {
        syncInterval: 30,
      },
      isActive: true,
    };

    const mockSyncHistory = {
      id: 1,
      tenantId: 1,
      connectionId: 1,
      syncType: 'incremental',
      status: 'in_progress',
      startedAt: new Date(),
    };

    beforeEach(() => {
      mockConnectionRepository.findOne.mockResolvedValue(mockConnection);
      mockSyncHistoryRepository.create.mockReturnValue(mockSyncHistory);
      mockSyncHistoryRepository.save.mockResolvedValue(mockSyncHistory);
      mockOAuthService.ensureValidToken.mockResolvedValue('valid-token');
    });

    it('should successfully sync a connection', async () => {
      const mockProjects = {
        values: [
          {
            id: 'proj-1',
            key: 'TEST',
            name: 'Test Project',
          },
        ],
      };

      const mockIssues = {
        issues: [
          {
            id: 'issue-1',
            key: 'TEST-1',
            fields: {
              summary: 'Test issue',
              status: { name: 'Open' },
              priority: { name: 'High' },
            },
          },
        ],
        total: 1,
      };

      mockApiClient.getProjects.mockResolvedValue(mockProjects);
      mockApiClient.searchIssues.mockResolvedValue(mockIssues);
      mockProjectRepository.findOne.mockResolvedValue(null);
      mockProjectRepository.create.mockReturnValue({ id: 1 });
      mockProjectRepository.save.mockResolvedValue({ id: 1 });
      mockIssueRepository.findOne.mockResolvedValue(null);
      mockIssueRepository.create.mockReturnValue({ id: 1 });
      mockIssueRepository.save.mockResolvedValue({ id: 1 });
      mockConnectionRepository.save.mockResolvedValue(mockConnection);

      const result = await service.syncConnection(1, 1, 'full');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(mockOAuthService.ensureValidToken).toHaveBeenCalledWith(
        mockConnection,
      );
      expect(mockApiClient.getProjects).toHaveBeenCalled();
      expect(mockApiClient.searchIssues).toHaveBeenCalled();
      expect(mockConnectionRepository.save).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      const error = new Error('API error');
      mockApiClient.getProjects.mockRejectedValue(error);

      await expect(service.syncConnection(1, 1, 'full')).rejects.toThrow(
        'API error',
      );

      expect(mockSyncHistoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'API error',
        }),
      );
    });

    it('should throw error if connection not found', async () => {
      mockConnectionRepository.findOne.mockResolvedValue(null);

      await expect(service.syncConnection(999, 1, 'full')).rejects.toThrow(
        'Connection 999 not found',
      );
    });

    it('should prevent concurrent syncs for same connection', async () => {
      // Start first sync (doesn't await)
      const sync1 = service.syncConnection(1, 1, 'full');

      // Try to start second sync immediately
      await expect(service.syncConnection(1, 1, 'full')).rejects.toThrow(
        'Sync already in progress for connection 1',
      );

      // Clean up
      await sync1.catch(() => {});
    });

    it('should perform incremental sync when lastSuccessfulSyncAt exists', async () => {
      const connectionWithLastSync = {
        ...mockConnection,
        lastSuccessfulSyncAt: new Date('2024-01-01'),
      };

      mockConnectionRepository.findOne.mockResolvedValue(
        connectionWithLastSync,
      );
      mockApiClient.getProjects.mockResolvedValue({ values: [] });
      mockApiClient.searchIssues.mockResolvedValue({ issues: [], total: 0 });

      await service.syncConnection(1, 1, 'incremental');

      expect(mockApiClient.searchIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          cloudId: 'test-cloud-id',
        }),
        expect.stringContaining('updated'),
        expect.any(Object),
      );
    });
  });

  describe('handleScheduledSync', () => {
    it('should skip connections that were recently synced', async () => {
      const recentlySyncedConnection = {
        id: 1,
        tenantId: 1,
        isActive: true,
        syncSettings: { syncInterval: 30 },
        lastSuccessfulSyncAt: new Date(),
      };

      mockConnectionRepository.find.mockResolvedValue([
        recentlySyncedConnection,
      ]);

      await service.handleScheduledSync();

      expect(mockConnectionRepository.find).toHaveBeenCalled();
      expect(mockSyncHistoryRepository.create).not.toHaveBeenCalled();
    });

    it('should sync connections that are due for sync', async () => {
      const dueConnection = {
        id: 1,
        tenantId: 1,
        isActive: true,
        cloudId: 'test-cloud-id',
        siteUrl: 'https://test.atlassian.net',
        accessToken: 'test-token',
        syncSettings: { syncInterval: 30 },
        lastSuccessfulSyncAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      mockConnectionRepository.find.mockResolvedValue([dueConnection]);
      mockConnectionRepository.findOne.mockResolvedValue(dueConnection);
      mockSyncHistoryRepository.create.mockReturnValue({
        id: 1,
        status: 'in_progress',
      });
      mockSyncHistoryRepository.save.mockResolvedValue({
        id: 1,
        status: 'completed',
      });
      mockOAuthService.ensureValidToken.mockResolvedValue('valid-token');
      mockApiClient.getProjects.mockResolvedValue({ values: [] });
      mockApiClient.searchIssues.mockResolvedValue({ issues: [], total: 0 });

      await service.handleScheduledSync();

      // Wait a bit for background sync to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockConnectionRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });
});
