import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamsIngestionService } from './teams-ingestion.service';
import { TeamsConnection } from '../entities/teams-connection.entity';
import { TeamsChannel } from '../entities/teams-channel.entity';
import { TeamsUser } from '../entities/teams-user.entity';
import { TeamsMessage } from '../entities/teams-message.entity';
import { TeamsSyncHistory } from '../entities/teams-sync-history.entity';
import { TeamsApiClientService } from './teams-api-client.service';
import { TeamsOAuthService } from './teams-oauth.service';

describe('TeamsIngestionService', () => {
  let service: TeamsIngestionService;
  let connectionRepository: Repository<TeamsConnection>;
  let channelRepository: Repository<TeamsChannel>;
  let userRepository: Repository<TeamsUser>;
  let messageRepository: Repository<TeamsMessage>;
  let syncHistoryRepository: Repository<TeamsSyncHistory>;
  let apiClient: TeamsApiClientService;
  let oauthService: TeamsOAuthService;

  const mockConnectionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockChannelRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMessageRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSyncHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockApiClient = {
    getJoinedTeams: jest.fn(),
    getTeamChannels: jest.fn(),
    getChannelMessages: jest.fn(),
    getTeamMembers: jest.fn(),
    getUser: jest.fn(),
  };

  const mockOAuthService = {
    ensureValidToken: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'TEAMS_SYNC_INTERVAL_MINUTES') return 30;
      if (key === 'TEAMS_MAX_MESSAGES_PER_CHANNEL') return 1000;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsIngestionService,
        {
          provide: getRepositoryToken(TeamsConnection),
          useValue: mockConnectionRepository,
        },
        {
          provide: getRepositoryToken(TeamsChannel),
          useValue: mockChannelRepository,
        },
        {
          provide: getRepositoryToken(TeamsUser),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(TeamsMessage),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(TeamsSyncHistory),
          useValue: mockSyncHistoryRepository,
        },
        {
          provide: TeamsApiClientService,
          useValue: mockApiClient,
        },
        {
          provide: TeamsOAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TeamsIngestionService>(TeamsIngestionService);
    connectionRepository = module.get<Repository<TeamsConnection>>(
      getRepositoryToken(TeamsConnection),
    );
    channelRepository = module.get<Repository<TeamsChannel>>(
      getRepositoryToken(TeamsChannel),
    );
    userRepository = module.get<Repository<TeamsUser>>(
      getRepositoryToken(TeamsUser),
    );
    messageRepository = module.get<Repository<TeamsMessage>>(
      getRepositoryToken(TeamsMessage),
    );
    syncHistoryRepository = module.get<Repository<TeamsSyncHistory>>(
      getRepositoryToken(TeamsSyncHistory),
    );
    apiClient = module.get<TeamsApiClientService>(TeamsApiClientService);
    oauthService = module.get<TeamsOAuthService>(TeamsOAuthService);
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
      tenantIdMs: 'tenant-ms-id',
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: new Date(Date.now() + 3600000),
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
      teamIds: [],
      stats: {
        teamsProcessed: 0,
        channelsProcessed: 0,
        messagesProcessed: 0,
        usersProcessed: 0,
        apiCallsCount: 0,
      },
    };

    beforeEach(() => {
      mockConnectionRepository.findOne.mockResolvedValue(mockConnection);
      mockSyncHistoryRepository.create.mockReturnValue(mockSyncHistory);
      mockSyncHistoryRepository.save.mockResolvedValue(mockSyncHistory);
      mockOAuthService.ensureValidToken.mockResolvedValue('valid-token');
    });

    it('should successfully sync a connection with teams, channels, and messages', async () => {
      const mockTeams = {
        value: [
          {
            id: 'team-1',
            displayName: 'Test Team',
          },
        ],
      };

      const mockChannels = {
        value: [
          {
            id: 'channel-1',
            displayName: 'General',
            membershipType: 'standard',
          },
        ],
      };

      const mockMessages = {
        value: [
          {
            id: 'msg-1',
            body: {
              content: 'Hello from Teams',
            },
            from: {
              user: {
                id: 'user-1',
                displayName: 'Test User',
              },
            },
            createdDateTime: '2024-01-01T00:00:00Z',
          },
        ],
      };

      const mockMembers = {
        value: [
          {
            userId: 'user-1',
            displayName: 'Test User',
            email: 'test@example.com',
          },
        ],
      };

      mockApiClient.getJoinedTeams.mockResolvedValue(mockTeams);
      mockApiClient.getTeamChannels.mockResolvedValue(mockChannels);
      mockApiClient.getChannelMessages.mockResolvedValue(mockMessages);
      mockApiClient.getTeamMembers.mockResolvedValue(mockMembers);
      mockChannelRepository.findOne.mockResolvedValue(null);
      mockChannelRepository.create.mockReturnValue({ id: 1 });
      mockChannelRepository.save.mockResolvedValue({ id: 1 });
      mockChannelRepository.count.mockResolvedValue(1);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: 1 });
      mockUserRepository.save.mockResolvedValue({ id: 1 });
      mockMessageRepository.findOne.mockResolvedValue(null);
      mockMessageRepository.create.mockReturnValue({ id: 1 });
      mockMessageRepository.save.mockResolvedValue({ id: 1 });
      mockConnectionRepository.save.mockResolvedValue(mockConnection);

      const result = await service.syncConnection(1, 1);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(mockOAuthService.ensureValidToken).toHaveBeenCalledWith(
        mockConnection,
      );
      expect(mockApiClient.getJoinedTeams).toHaveBeenCalled();
      expect(mockApiClient.getTeamChannels).toHaveBeenCalled();
      expect(mockApiClient.getChannelMessages).toHaveBeenCalled();
      expect(mockConnectionRepository.save).toHaveBeenCalled();
    });

    it('should handle messages with reactions and mentions', async () => {
      const messageWithReactions = {
        id: 'msg-2',
        body: { content: 'Great work!' },
        from: {
          user: {
            id: 'user-1',
            displayName: 'User 1',
          },
        },
        reactions: [
          {
            reactionType: 'like',
            createdDateTime: '2024-01-01T00:00:00Z',
            user: {
              id: 'user-2',
              displayName: 'User 2',
            },
          },
        ],
        mentions: [
          {
            id: 0,
            mentioned: {
              user: {
                id: 'user-3',
                displayName: 'User 3',
              },
            },
          },
        ],
        createdDateTime: '2024-01-01T00:00:00Z',
      };

      mockApiClient.getJoinedTeams.mockResolvedValue({ value: [{ id: 'team-1' }] });
      mockApiClient.getTeamChannels.mockResolvedValue({
        value: [{ id: 'channel-1' }],
      });
      mockApiClient.getChannelMessages.mockResolvedValue({
        value: [messageWithReactions],
      });
      mockApiClient.getTeamMembers.mockResolvedValue({ value: [] });
      mockChannelRepository.findOne.mockResolvedValue({ id: 1 });
      mockChannelRepository.count.mockResolvedValue(0);
      mockMessageRepository.findOne.mockResolvedValue(null);
      mockMessageRepository.create.mockImplementation((data) => data);
      mockMessageRepository.save.mockResolvedValue({ id: 1 });

      await service.syncConnection(1, 1);

      expect(mockMessageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reactions: expect.arrayContaining([
            expect.objectContaining({
              reactionType: 'like',
            }),
          ]),
          mentions: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user-3',
            }),
          ]),
        }),
      );
    });

    it('should handle sync errors gracefully', async () => {
      const error = new Error('Graph API error');
      mockApiClient.getJoinedTeams.mockRejectedValue(error);

      await expect(service.syncConnection(1, 1)).rejects.toThrow(
        'Graph API error',
      );

      expect(mockSyncHistoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Graph API error',
        }),
      );
    });

    it('should throw error if connection not found', async () => {
      mockConnectionRepository.findOne.mockResolvedValue(null);

      await expect(service.syncConnection(1, 999)).rejects.toThrow(
        'Connection 999 not found',
      );
    });

    it('should prevent concurrent syncs for same connection', async () => {
      mockApiClient.getJoinedTeams.mockResolvedValue({ value: [] });

      const sync1 = service.syncConnection(1, 1);

      await expect(service.syncConnection(1, 1)).rejects.toThrow(
        'Sync already in progress for connection 1',
      );

      await sync1.catch(() => {});
    });

    it('should perform incremental sync based on lastSuccessfulSyncAt', async () => {
      const connectionWithLastSync = {
        ...mockConnection,
        lastSuccessfulSyncAt: new Date('2024-01-01'),
      };

      mockConnectionRepository.findOne.mockResolvedValue(
        connectionWithLastSync,
      );
      mockApiClient.getJoinedTeams.mockResolvedValue({ value: [{ id: 'team-1' }] });
      mockApiClient.getTeamChannels.mockResolvedValue({
        value: [{ id: 'channel-1' }],
      });
      mockChannelRepository.findOne.mockResolvedValue({ id: 1 });
      mockApiClient.getChannelMessages.mockResolvedValue({ value: [] });
      mockApiClient.getTeamMembers.mockResolvedValue({ value: [] });
      mockChannelRepository.count.mockResolvedValue(0);

      await service.syncConnection(1, 1);

      expect(mockApiClient.getChannelMessages).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          filter: expect.stringContaining('lastModifiedDateTime'),
        }),
      );
    });

    it('should handle pagination in message sync', async () => {
      const firstPage = {
        value: [{ id: 'msg-1', body: { content: 'Message 1' }, from: { user: { id: 'user-1' } }, createdDateTime: '2024-01-01' }],
        '@odata.nextLink': 'nextPageUrl',
      };

      const secondPage = {
        value: [{ id: 'msg-2', body: { content: 'Message 2' }, from: { user: { id: 'user-1' } }, createdDateTime: '2024-01-02' }],
      };

      mockApiClient.getJoinedTeams.mockResolvedValue({ value: [{ id: 'team-1' }] });
      mockApiClient.getTeamChannels.mockResolvedValue({
        value: [{ id: 'channel-1' }],
      });
      mockChannelRepository.findOne.mockResolvedValue({ id: 1 });
      mockApiClient.getChannelMessages
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);
      mockApiClient.getTeamMembers.mockResolvedValue({ value: [] });
      mockMessageRepository.findOne.mockResolvedValue(null);
      mockMessageRepository.create.mockImplementation((data) => data);
      mockMessageRepository.save.mockResolvedValue({ id: 1 });
      mockChannelRepository.count.mockResolvedValue(2);

      await service.syncConnection(1, 1);

      expect(mockApiClient.getChannelMessages).toHaveBeenCalledTimes(2);
      expect(mockMessageRepository.save).toHaveBeenCalledTimes(2);
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
        tenantIdMs: 'tenant-ms-id',
        accessToken: 'test-token',
        syncSettings: { syncInterval: 30 },
        lastSuccessfulSyncAt: new Date(Date.now() - 60 * 60 * 1000),
      };

      mockConnectionRepository.find.mockResolvedValue([dueConnection]);
      mockConnectionRepository.findOne.mockResolvedValue(dueConnection);
      mockSyncHistoryRepository.create.mockReturnValue({
        id: 1,
        status: 'in_progress',
        teamIds: [],
      stats: {
        teamsProcessed: 0,
        channelsProcessed: 0,
        messagesProcessed: 0,
        usersProcessed: 0,
        apiCallsCount: 0,
      },
      });
      mockSyncHistoryRepository.save.mockResolvedValue({
        id: 1,
        status: 'completed',
      });
      mockOAuthService.ensureValidToken.mockResolvedValue('valid-token');
      mockApiClient.getJoinedTeams.mockResolvedValue({ value: [] });

      await service.handleScheduledSync();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockConnectionRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });
});
