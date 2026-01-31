import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlackIngestionService } from './slack-ingestion.service';
import { SlackConnection } from '../entities/slack-connection.entity';
import { SlackChannel } from '../entities/slack-channel.entity';
import { SlackUser } from '../entities/slack-user.entity';
import { SlackMessage } from '../entities/slack-message.entity';
import { SlackSyncHistory } from '../entities/slack-sync-history.entity';
import { SlackApiClientService } from './slack-api-client.service';

describe('SlackIngestionService', () => {
  let service: SlackIngestionService;
  let connectionRepository: Repository<SlackConnection>;
  let channelRepository: Repository<SlackChannel>;
  let userRepository: Repository<SlackUser>;
  let messageRepository: Repository<SlackMessage>;
  let syncHistoryRepository: Repository<SlackSyncHistory>;
  let apiClient: SlackApiClientService;

  const mockConnectionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockChannelRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
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
    count: jest.fn(),
  };

  const mockSyncHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockApiClient = {
    getConversations: jest.fn(),
    getConversationHistory: jest.fn(),
    getUsers: jest.fn(),
    joinChannel: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'SLACK_SYNC_INTERVAL_MINUTES') return 30;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackIngestionService,
        {
          provide: getRepositoryToken(SlackConnection),
          useValue: mockConnectionRepository,
        },
        {
          provide: getRepositoryToken(SlackChannel),
          useValue: mockChannelRepository,
        },
        {
          provide: getRepositoryToken(SlackUser),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(SlackMessage),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(SlackSyncHistory),
          useValue: mockSyncHistoryRepository,
        },
        {
          provide: SlackApiClientService,
          useValue: mockApiClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SlackIngestionService>(SlackIngestionService);
    connectionRepository = module.get<Repository<SlackConnection>>(
      getRepositoryToken(SlackConnection),
    );
    channelRepository = module.get<Repository<SlackChannel>>(
      getRepositoryToken(SlackChannel),
    );
    userRepository = module.get<Repository<SlackUser>>(
      getRepositoryToken(SlackUser),
    );
    messageRepository = module.get<Repository<SlackMessage>>(
      getRepositoryToken(SlackMessage),
    );
    syncHistoryRepository = module.get<Repository<SlackSyncHistory>>(
      getRepositoryToken(SlackSyncHistory),
    );
    apiClient = module.get<SlackApiClientService>(SlackApiClientService);
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
      teamId: 'T123456',
      accessToken: 'xoxb-test-token',
      botUserId: 'U123456',
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
    });

    it('should successfully sync a connection with channels and messages', async () => {
      const mockUsers = {
        members: [
          {
            id: 'U123',
            name: 'testuser',
            real_name: 'Test User',
            profile: {
              email: 'test@example.com',
            },
          },
        ],
      };

      const mockChannels = {
        channels: [
          {
            id: 'C123',
            name: 'general',
            is_private: false,
            is_archived: false,
          },
        ],
      };

      const mockMessages = {
        messages: [
          {
            ts: '1234567890.123456',
            user: 'U123',
            text: 'Hello world',
            type: 'message',
          },
        ],
      };

      mockApiClient.getUsers.mockResolvedValue(mockUsers);
      mockApiClient.getConversations.mockResolvedValue(mockChannels);
      mockApiClient.getConversationHistory.mockResolvedValue(mockMessages);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: 1 });
      mockUserRepository.save.mockResolvedValue({ id: 1 });
      mockChannelRepository.findOne.mockResolvedValue(null);
      mockChannelRepository.find.mockResolvedValue([{ id: 1, slackChannelId: 'C123', name: 'general', isActive: true }]);
      mockChannelRepository.create.mockReturnValue({ id: 1 });
      mockChannelRepository.save.mockResolvedValue({ id: 1 });
      mockChannelRepository.count.mockResolvedValue(1);
      mockMessageRepository.findOne.mockResolvedValue(null);
      mockMessageRepository.create.mockReturnValue({ id: 1 });
      mockMessageRepository.save.mockResolvedValue({ id: 1 });
      mockConnectionRepository.save.mockResolvedValue(mockConnection);

      const result = await service.syncConnection(1, 1, 'full');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(mockApiClient.getUsers).toHaveBeenCalled();
      expect(mockApiClient.getConversations).toHaveBeenCalled();
      expect(mockApiClient.getConversationHistory).toHaveBeenCalled();
      expect(mockConnectionRepository.save).toHaveBeenCalled();
    });

    it('should handle not_in_channel error and attempt to join public channel', async () => {
      const mockChannel = {
        id: 1,
        slackChannelId: 'C123',
        name: 'general',
        isPrivate: false,
        isActive: true,
      };

      mockApiClient.getUsers.mockResolvedValue({ members: [] });
      mockApiClient.getConversations.mockResolvedValue({ channels: [] });
      mockChannelRepository.find.mockResolvedValue([mockChannel]);
      mockChannelRepository.count.mockResolvedValue(0);

      const notInChannelError = new Error('Slack API error: not_in_channel');
      mockApiClient.getConversationHistory.mockRejectedValueOnce(
        notInChannelError,
      );
      mockApiClient.joinChannel.mockResolvedValue({ ok: true });
      mockApiClient.getConversationHistory.mockResolvedValueOnce({
        messages: [],
      });

      await service.syncConnection(1, 1, 'full');

      expect(mockApiClient.joinChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'xoxb-test-token',
        }),
        'C123',
      );
    });

    it('should skip private channels when not_in_channel error occurs', async () => {
      const mockPrivateChannel = {
        id: 1,
        slackChannelId: 'C456',
        name: 'private-channel',
        isPrivate: true,
        isActive: true,
        metadata: {
          isDirectMessage: false,
          isMultiPartyDM: false,
        },
      };

      mockApiClient.getUsers.mockResolvedValue({ members: [] });
      mockApiClient.getConversations.mockResolvedValue({ channels: [] });
      mockChannelRepository.find.mockResolvedValue([mockPrivateChannel]);
      mockChannelRepository.count.mockResolvedValue(0);

      const notInChannelError = new Error('Slack API error: not_in_channel');
      mockApiClient.getConversationHistory.mockRejectedValue(
        notInChannelError,
      );

      await service.syncConnection(1, 1, 'full');

      expect(mockApiClient.joinChannel).not.toHaveBeenCalled();
    });

    it('should sync DMs with user-friendly names', async () => {
      const mockDMChannel = {
        id: 'D123',
        name: null,
        is_im: true,
        user: 'U123',
      };

      const mockUser = {
        id: 1,
        slackUserId: 'U123',
        displayName: 'John Doe',
        realName: 'John Doe',
        name: 'johndoe',
      };

      mockApiClient.getUsers.mockResolvedValue({ members: [] });
      mockApiClient.getConversations.mockResolvedValue({
        channels: [mockDMChannel],
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockChannelRepository.findOne.mockResolvedValue(null);
      mockChannelRepository.find.mockResolvedValue([]);
      mockChannelRepository.create.mockImplementation((data) => data);
      mockChannelRepository.save.mockResolvedValue({ id: 1 });

      await service.syncConnection(1, 1, 'full');

      expect(mockChannelRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DM: John Doe',
        }),
      );
    });

    it('should handle sync errors gracefully', async () => {
      const error = new Error('API error');
      mockApiClient.getUsers.mockRejectedValue(error);

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
      mockApiClient.getUsers.mockResolvedValue({ members: [] });
      mockApiClient.getConversations.mockResolvedValue({ channels: [] });
      mockChannelRepository.find.mockResolvedValue([]);

      const sync1 = service.syncConnection(1, 1, 'full');

      await expect(service.syncConnection(1, 1, 'full')).rejects.toThrow(
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
      mockApiClient.getUsers.mockResolvedValue({ members: [] });
      mockApiClient.getConversations.mockResolvedValue({ channels: [] });
      mockChannelRepository.find.mockResolvedValue([
        { id: 1, slackChannelId: 'C123', name: 'general', isActive: true },
      ]);
      mockApiClient.getConversationHistory.mockResolvedValue({ messages: [] });
      mockChannelRepository.count.mockResolvedValue(0);

      await service.syncConnection(1, 1, 'incremental');

      // Verify incremental sync was called
      expect(mockApiClient.getConversationHistory).toHaveBeenCalled();
      const callArgs = mockApiClient.getConversationHistory.mock.calls[0];
      expect(callArgs[2]).toHaveProperty('oldest');
      expect(callArgs[2].oldest).toBeTruthy();
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
        teamId: 'T123',
        accessToken: 'xoxb-test',
        syncSettings: { syncInterval: 30 },
        lastSuccessfulSyncAt: new Date(Date.now() - 60 * 60 * 1000),
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
      mockApiClient.getUsers.mockResolvedValue({ members: [] });
      mockApiClient.getConversations.mockResolvedValue({ channels: [] });
      mockChannelRepository.find.mockResolvedValue([]);

      await service.handleScheduledSync();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockConnectionRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });
});
