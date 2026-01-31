import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceNowIngestionService } from './servicenow-ingestion.service';
import { ServiceNowConnection } from '../entities/servicenow-connection.entity';
import { ServiceNowIncident } from '../entities/servicenow-incident.entity';
import { ServiceNowChange } from '../entities/servicenow-change.entity';
import { ServiceNowUser } from '../entities/servicenow-user.entity';
import { ServiceNowSyncHistory } from '../entities/servicenow-sync-history.entity';
import { ServiceNowApiClientService } from './servicenow-api-client.service';
import { ServiceNowOAuthService } from './servicenow-oauth.service';

describe('ServiceNowIngestionService', () => {
  let service: ServiceNowIngestionService;
  let connectionRepository: Repository<ServiceNowConnection>;
  let incidentRepository: Repository<ServiceNowIncident>;
  let changeRepository: Repository<ServiceNowChange>;
  let userRepository: Repository<ServiceNowUser>;
  let syncHistoryRepository: Repository<ServiceNowSyncHistory>;
  let apiClient: ServiceNowApiClientService;
  let oauthService: ServiceNowOAuthService;

  const mockConnectionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockIncidentRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockChangeRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSyncHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockApiClient = {
    getIncidents: jest.fn(),
    getChangeRequests: jest.fn(),
    getUsers: jest.fn(),
  };

  const mockOAuthService = {
    ensureValidToken: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'SERVICENOW_SYNC_INTERVAL_MINUTES') return 30;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceNowIngestionService,
        {
          provide: getRepositoryToken(ServiceNowConnection),
          useValue: mockConnectionRepository,
        },
        {
          provide: getRepositoryToken(ServiceNowIncident),
          useValue: mockIncidentRepository,
        },
        {
          provide: getRepositoryToken(ServiceNowChange),
          useValue: mockChangeRepository,
        },
        {
          provide: getRepositoryToken(ServiceNowUser),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(ServiceNowSyncHistory),
          useValue: mockSyncHistoryRepository,
        },
        {
          provide: ServiceNowApiClientService,
          useValue: mockApiClient,
        },
        {
          provide: ServiceNowOAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ServiceNowIngestionService>(
      ServiceNowIngestionService,
    );
    connectionRepository = module.get<Repository<ServiceNowConnection>>(
      getRepositoryToken(ServiceNowConnection),
    );
    incidentRepository = module.get<Repository<ServiceNowIncident>>(
      getRepositoryToken(ServiceNowIncident),
    );
    changeRepository = module.get<Repository<ServiceNowChange>>(
      getRepositoryToken(ServiceNowChange),
    );
    userRepository = module.get<Repository<ServiceNowUser>>(
      getRepositoryToken(ServiceNowUser),
    );
    syncHistoryRepository = module.get<Repository<ServiceNowSyncHistory>>(
      getRepositoryToken(ServiceNowSyncHistory),
    );
    apiClient = module.get<ServiceNowApiClientService>(
      ServiceNowApiClientService,
    );
    oauthService = module.get<ServiceNowOAuthService>(ServiceNowOAuthService);
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
      instanceUrl: 'https://dev12345.service-now.com',
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      syncSettings: {
        syncInterval: 30,
        syncTables: ['incident', 'change_request', 'user'],
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

    it('should successfully sync incidents, changes, and users', async () => {
      const mockUsers = {
        result: [
          {
            sys_id: 'user-1',
            user_name: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            active: 'true',
          },
        ],
      };

      const mockIncidents = {
        result: [
          {
            sys_id: 'inc-1',
            number: 'INC0001234',
            short_description: 'Test incident',
            state: { value: '1', display_value: 'New' },
            priority: { value: '2', display_value: 'High' },
            sys_created_on: '2024-01-01 00:00:00',
            sys_updated_on: '2024-01-01 00:00:00',
          },
        ],
      };

      const mockChanges = {
        result: [
          {
            sys_id: 'chg-1',
            number: 'CHG0001234',
            short_description: 'Test change',
            state: { value: '1', display_value: 'New' },
            risk: { value: '2', display_value: 'Medium' },
            sys_created_on: '2024-01-01 00:00:00',
            sys_updated_on: '2024-01-01 00:00:00',
          },
        ],
      };

      mockApiClient.getUsers.mockResolvedValue(mockUsers);
      mockApiClient.getIncidents.mockResolvedValue(mockIncidents);
      mockApiClient.getChangeRequests.mockResolvedValue(mockChanges);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: 1 });
      mockUserRepository.save.mockResolvedValue({ id: 1 });
      mockIncidentRepository.findOne.mockResolvedValue(null);
      mockIncidentRepository.create.mockReturnValue({ id: 1 });
      mockIncidentRepository.save.mockResolvedValue({ id: 1 });
      mockChangeRepository.findOne.mockResolvedValue(null);
      mockChangeRepository.create.mockReturnValue({ id: 1 });
      mockChangeRepository.save.mockResolvedValue({ id: 1 });
      mockConnectionRepository.save.mockResolvedValue(mockConnection);

      const result = await service.syncConnection(1, 1, 'full');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(mockOAuthService.ensureValidToken).toHaveBeenCalledWith(
        mockConnection,
      );
      expect(mockApiClient.getUsers).toHaveBeenCalled();
      expect(mockApiClient.getIncidents).toHaveBeenCalled();
      expect(mockApiClient.getChangeRequests).toHaveBeenCalled();
      expect(mockConnectionRepository.save).toHaveBeenCalled();
    });

    it('should update existing incidents instead of creating duplicates', async () => {
      const existingIncident = {
        id: 1,
        sysId: 'inc-1',
        number: 'INC0001234',
      };

      const mockIncidents = {
        result: [
          {
            sys_id: 'inc-1',
            number: 'INC0001234',
            short_description: 'Updated incident',
            state: { value: '2', display_value: 'In Progress' },
            priority: { value: '1', display_value: 'Critical' },
            sys_created_on: '2024-01-01 00:00:00',
            sys_updated_on: '2024-01-02 00:00:00',
          },
        ],
      };

      mockApiClient.getUsers.mockResolvedValue({ result: [] });
      mockApiClient.getIncidents.mockResolvedValue(mockIncidents);
      mockApiClient.getChangeRequests.mockResolvedValue({ result: [] });
      mockIncidentRepository.findOne.mockResolvedValue(existingIncident);
      mockIncidentRepository.save.mockResolvedValue(existingIncident);

      const result = await service.syncConnection(1, 1, 'full');

      expect(result.incidentsUpdated).toBe(1);
      expect(result.incidentsCreated).toBe(0);
      expect(mockIncidentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          shortDescription: 'Updated incident',
          state: 'In Progress',
        }),
      );
    });

    it('should handle sync errors gracefully', async () => {
      const error = new Error('ServiceNow API error');
      mockApiClient.getUsers.mockRejectedValue(error);

      await expect(service.syncConnection(1, 1, 'full')).rejects.toThrow(
        'ServiceNow API error',
      );

      expect(mockSyncHistoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'ServiceNow API error',
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
      mockApiClient.getUsers.mockResolvedValue({ result: [] });
      mockApiClient.getIncidents.mockResolvedValue({ result: [] });
      mockApiClient.getChangeRequests.mockResolvedValue({ result: [] });

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
      mockApiClient.getUsers.mockResolvedValue({ result: [] });
      mockApiClient.getIncidents.mockResolvedValue({ result: [] });
      mockApiClient.getChangeRequests.mockResolvedValue({ result: [] });

      await service.syncConnection(1, 1, 'incremental');

      // Verify incremental sync was called with updatedAfter parameter
      expect(mockApiClient.getIncidents).toHaveBeenCalled();
      const incidentCallArgs = mockApiClient.getIncidents.mock.calls[0];
      expect(incidentCallArgs[1]).toHaveProperty('updatedAfter');
      expect(incidentCallArgs[1].updatedAfter).toBeInstanceOf(Date);

      expect(mockApiClient.getChangeRequests).toHaveBeenCalled();
      const changeCallArgs = mockApiClient.getChangeRequests.mock.calls[0];
      expect(changeCallArgs[1]).toHaveProperty('updatedAfter');
      expect(changeCallArgs[1].updatedAfter).toBeInstanceOf(Date);
    });

    it('should sync only specified tables from syncSettings', async () => {
      const customConnection = {
        ...mockConnection,
        syncSettings: {
          syncInterval: 30,
          syncTables: ['incident'], // Only incidents
        },
      };

      mockConnectionRepository.findOne.mockResolvedValue(customConnection);
      mockApiClient.getIncidents.mockResolvedValue({ result: [] });

      await service.syncConnection(1, 1, 'full');

      expect(mockApiClient.getIncidents).toHaveBeenCalled();
      expect(mockApiClient.getChangeRequests).not.toHaveBeenCalled();
      expect(mockApiClient.getUsers).not.toHaveBeenCalled();
    });

    it('should track statistics for incidents and changes', async () => {
      const mockIncidents = {
        result: [
          { sys_id: 'inc-1', number: 'INC001', sys_created_on: '2024-01-01', sys_updated_on: '2024-01-01' },
          { sys_id: 'inc-2', number: 'INC002', sys_created_on: '2024-01-01', sys_updated_on: '2024-01-01' },
        ],
      };

      const mockChanges = {
        result: [
          { sys_id: 'chg-1', number: 'CHG001', sys_created_on: '2024-01-01', sys_updated_on: '2024-01-01' },
        ],
      };

      mockApiClient.getUsers.mockResolvedValue({ result: [] });
      mockApiClient.getIncidents.mockResolvedValue(mockIncidents);
      mockApiClient.getChangeRequests.mockResolvedValue(mockChanges);
      mockIncidentRepository.findOne.mockResolvedValue(null);
      mockIncidentRepository.create.mockReturnValue({ id: 1 });
      mockIncidentRepository.save.mockResolvedValue({ id: 1 });
      mockChangeRepository.findOne.mockResolvedValue(null);
      mockChangeRepository.create.mockReturnValue({ id: 1 });
      mockChangeRepository.save.mockResolvedValue({ id: 1 });

      const result = await service.syncConnection(1, 1, 'full');

      expect(result.incidentsProcessed).toBe(2);
      expect(result.incidentsCreated).toBe(2);
      expect(result.changesProcessed).toBe(1);
      expect(result.changesCreated).toBe(1);
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
        instanceUrl: 'https://dev12345.service-now.com',
        accessToken: 'test-token',
        syncSettings: {
          syncInterval: 30,
          syncTables: ['incident'],
        },
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
      mockOAuthService.ensureValidToken.mockResolvedValue('valid-token');
      mockApiClient.getIncidents.mockResolvedValue({ result: [] });

      await service.handleScheduledSync();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockConnectionRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });
});
