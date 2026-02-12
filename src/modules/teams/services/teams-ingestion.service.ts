import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamsConnection } from '../entities/teams-connection.entity';
import { TeamsChannel } from '../entities/teams-channel.entity';
import { TeamsUser } from '../entities/teams-user.entity';
import { TeamsMessage } from '../entities/teams-message.entity';
import { TeamsSyncHistory } from '../entities/teams-sync-history.entity';
import { TeamsApiClientService } from './teams-api-client.service';
import { TeamsOAuthService } from './teams-oauth.service';

@Injectable()
export class TeamsIngestionService {
  private readonly logger = new Logger(TeamsIngestionService.name);
  private readonly defaultSyncInterval: number;
  private readonly activeSyncs = new Map<number, boolean>();

  constructor(
    @InjectRepository(TeamsConnection)
    private readonly connectionRepository: Repository<TeamsConnection>,
    @InjectRepository(TeamsChannel)
    private readonly channelRepository: Repository<TeamsChannel>,
    @InjectRepository(TeamsUser)
    private readonly userRepository: Repository<TeamsUser>,
    @InjectRepository(TeamsMessage)
    private readonly messageRepository: Repository<TeamsMessage>,
    @InjectRepository(TeamsSyncHistory)
    private readonly syncHistoryRepository: Repository<TeamsSyncHistory>,
    private readonly teamsApiClient: TeamsApiClientService,
    private readonly teamsOAuthService: TeamsOAuthService,
    private readonly configService: ConfigService,
  ) {
    this.defaultSyncInterval = this.configService.get<number>('TEAMS_SYNC_INTERVAL_MINUTES', 30);
    this.logger.log(`Teams sync default interval: ${this.defaultSyncInterval} minutes`);
  }

  /**
   * Scheduled job to sync all active connections
   * DISABLED: Cron disabled to reduce server load
   */
  // @Cron(process.env.TEAMS_SYNC_CRON_SCHEDULE || '0 */30 * * * *')
  async handleScheduledSync() {
    this.logger.log('Starting scheduled sync for all active Teams connections');

    const activeConnections = await this.connectionRepository.find({
      where: { isActive: true },
    });

    for (const connection of activeConnections) {
      const syncSettings = connection.syncSettings || {};

      if (syncSettings.autoSync === false) {
        continue;
      }

      const syncInterval = syncSettings.syncInterval || this.defaultSyncInterval;
      const lastSync = connection.lastSuccessfulSyncAt || connection.lastSyncAt;

      if (lastSync) {
        const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
        if (minutesSinceLastSync < syncInterval) {
          this.logger.debug(
            `Skipping connection ${connection.id} - last sync was ${minutesSinceLastSync.toFixed(1)} minutes ago`,
          );
          continue;
        }
      }

      this.syncConnection(connection.tenantId, connection.id).catch((error) => {
        this.logger.error(`Failed to sync connection ${connection.id}: ${error.message}`, error.stack);
      });
    }
  }

  /**
   * Sync a specific connection
   */
  async syncConnection(tenantId: number, connectionId: number): Promise<TeamsSyncHistory> {
    if (this.activeSyncs.get(connectionId)) {
      throw new Error(`Sync already in progress for connection ${connectionId}`);
    }

    this.activeSyncs.set(connectionId, true);

    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      this.activeSyncs.delete(connectionId);
      throw new Error(`Connection ${connectionId} not found`);
    }

    const syncHistory = this.syncHistoryRepository.create({
      tenantId,
      connectionId,
      syncType: connection.lastSuccessfulSyncAt ? 'incremental' : 'full',
      status: 'in_progress',
      startedAt: new Date(),
      stats: {
        teamsProcessed: 0,
        channelsProcessed: 0,
        messagesCreated: 0,
        messagesUpdated: 0,
        usersCreated: 0,
        usersUpdated: 0,
        apiCallsCount: 0,
      },
      teamIds: [],
    });

    await this.syncHistoryRepository.save(syncHistory);

    const startTime = Date.now();

    try {
      connection.lastSyncAt = new Date();
      await this.connectionRepository.save(connection);

      // Ensure valid access token
      const accessToken = await this.teamsOAuthService.ensureValidToken(connection);
      const apiConfig = { accessToken };

      // Get all teams
      this.logger.log(`Fetching teams for connection ${connectionId}`);
      const teamsResponse = await this.teamsApiClient.getJoinedTeams(apiConfig);
      syncHistory.stats!.apiCallsCount! += 1;

      const teams = teamsResponse.value || [];
      this.logger.log(`Found ${teams.length} teams for connection ${connectionId}`);

      for (const team of teams) {
        syncHistory.teamIds!.push(team.id);
        syncHistory.stats!.teamsProcessed! += 1;

        // Sync channels for this team
        await this.syncTeamChannels(connection, team, apiConfig, syncHistory);

        // Sync team members/users
        await this.syncTeamUsers(connection, team, apiConfig, syncHistory);
      }

      // Mark sync as completed
      const duration = (Date.now() - startTime) / 1000;
      syncHistory.status = 'completed';
      syncHistory.completedAt = new Date();
      syncHistory.duration = duration;

      connection.lastSuccessfulSyncAt = new Date();
      connection.syncStats = {
        totalChannels: syncHistory.stats!.channelsProcessed,
        totalMessages: (syncHistory.stats!.messagesCreated || 0) + (syncHistory.stats!.messagesUpdated || 0),
        totalUsers: (syncHistory.stats!.usersCreated || 0) + (syncHistory.stats!.usersUpdated || 0),
        lastSyncDuration: duration,
      };

      await this.connectionRepository.save(connection);
      await this.syncHistoryRepository.save(syncHistory);

      this.logger.log(
        `✅ Sync completed for connection ${connectionId} in ${duration.toFixed(2)}s\n` +
        `   📊 Stats: ${syncHistory.stats!.channelsProcessed} channels | ` +
        `${syncHistory.stats!.messagesCreated} messages created | ` +
        `${syncHistory.stats!.messagesUpdated} messages updated\n` +
        `   👥 Users: ${syncHistory.stats!.usersCreated} created | ${syncHistory.stats!.usersUpdated} updated\n` +
        `   🔄 API calls: ${syncHistory.stats!.apiCallsCount}`,
      );

      return syncHistory;
    } catch (error) {
      this.logger.error(`Sync failed for connection ${connectionId}`, error.stack);

      const duration = (Date.now() - startTime) / 1000;
      syncHistory.status = 'failed';
      syncHistory.error = error.message;
      syncHistory.errorDetails = error.stack;
      syncHistory.completedAt = new Date();
      syncHistory.duration = duration;

      connection.lastSyncError = error.message;
      await this.connectionRepository.save(connection);
      await this.syncHistoryRepository.save(syncHistory);

      throw error;
    } finally {
      this.activeSyncs.delete(connectionId);
    }
  }

  /**
   * Sync channels for a team
   */
  private async syncTeamChannels(
    connection: TeamsConnection,
    team: any,
    apiConfig: any,
    syncHistory: TeamsSyncHistory,
  ): Promise<void> {
    try {
      this.logger.log(`Fetching channels for team ${team.displayName || team.id}`);
      const channelsResponse = await this.teamsApiClient.getTeamChannels(apiConfig, team.id);
      syncHistory.stats!.apiCallsCount! += 1;

      const channels = channelsResponse.value || [];
      this.logger.log(`Found ${channels.length} channels in team ${team.displayName || team.id}`);

      for (const channelData of channels) {
        // Save/update channel
        let channel = await this.channelRepository.findOne({
          where: {
            tenantId: connection.tenantId,
            connectionId: connection.id,
            channelId: channelData.id,
          },
        });

        if (channel) {
          // Update existing channel
          channel.displayName = channelData.displayName;
          channel.description = channelData.description;
          channel.email = channelData.email;
          channel.webUrl = channelData.webUrl;
          channel.membershipType = channelData.membershipType;
        } else {
          // Create new channel
          channel = this.channelRepository.create({
            tenantId: connection.tenantId,
            connectionId: connection.id,
            channelId: channelData.id,
            teamId: team.id,
            displayName: channelData.displayName,
            description: channelData.description,
            email: channelData.email,
            webUrl: channelData.webUrl,
            membershipType: channelData.membershipType,
            metadata: {
              isFavoriteByDefault: channelData.isFavoriteByDefault,
              createdDateTime: channelData.createdDateTime,
              tenantId: channelData.tenantId,
            },
          });
        }

        await this.channelRepository.save(channel);
        syncHistory.stats!.channelsProcessed! += 1;

        // Sync messages for this channel
        await this.syncChannelMessages(connection, team, channel, channelData, apiConfig, syncHistory);
      }
    } catch (error) {
      this.logger.error(`Failed to sync channels for team ${team.id}`, error);
    }
  }

  /**
   * Sync messages for a channel
   */
  private async syncChannelMessages(
    connection: TeamsConnection,
    team: any,
    channel: TeamsChannel,
    channelData: any,
    apiConfig: any,
    syncHistory: TeamsSyncHistory,
  ): Promise<void> {
    try {
      this.logger.debug(`Fetching messages for channel ${channelData.displayName}`);

      // Build filter for incremental sync
      let filter: string | undefined;
      if (connection.lastSuccessfulSyncAt) {
        const lastSyncDate = connection.lastSuccessfulSyncAt.toISOString();
        filter = `lastModifiedDateTime gt ${lastSyncDate}`;
      }

      let hasMore = true;
      let nextLink: string | undefined;
      let messagesProcessed = 0;
      const maxMessagesPerChannel = 1000; // Limit per channel

      while (hasMore && messagesProcessed < maxMessagesPerChannel) {
        const messagesResponse = await this.teamsApiClient.getChannelMessages(
          apiConfig,
          team.id,
          channelData.id,
          {
            top: 50,
            filter,
            orderBy: 'lastModifiedDateTime desc',
            nextLink,
          },
        );
        syncHistory.stats!.apiCallsCount! += 1;

        const messages = messagesResponse.value || [];
        messagesProcessed += messages.length;

        for (const msgData of messages) {
          await this.saveMessage(connection, channel, team.id, channelData.id, msgData, syncHistory);
        }

        // Check for pagination
        nextLink = messagesResponse['@odata.nextLink'];
        hasMore = !!nextLink && messages.length > 0;

        if (messagesProcessed >= maxMessagesPerChannel) {
          this.logger.warn(
            `Reached message limit (${maxMessagesPerChannel}) for channel ${channelData.displayName}`,
          );
          break;
        }
      }

      this.logger.debug(
        `Processed ${messagesProcessed} messages for channel ${channelData.displayName}`,
      );
    } catch (error) {
      this.logger.error(`Failed to sync messages for channel ${channelData.id}`, error);
    }
  }

  /**
   * Save or update a message
   */
  private async saveMessage(
    connection: TeamsConnection,
    channel: TeamsChannel,
    teamId: string,
    teamsChannelId: string,
    msgData: any,
    syncHistory: TeamsSyncHistory,
  ): Promise<void> {
    try {
      let message = await this.messageRepository.findOne({
        where: { messageId: msgData.id },
      });

      const messageContent = msgData.body?.content || '';
      const messageContentType = msgData.body?.contentType || 'html';

      if (message) {
        // Update existing message
        message.content = messageContent;
        message.contentType = messageContentType;
        message.subject = msgData.subject;
        message.importance = msgData.importance;
        message.reactions = msgData.reactions;
        message.mentions = msgData.mentions;
        message.attachments = msgData.attachments;
        message.lastModifiedDateTime = msgData.lastModifiedDateTime ? new Date(msgData.lastModifiedDateTime) : undefined;
        message.isDeleted = !!msgData.deletedDateTime;

        syncHistory.stats!.messagesUpdated! += 1;
      } else {
        // Create new message
        message = this.messageRepository.create({
          tenantId: connection.tenantId,
          connectionId: connection.id,
          channelId: channel.id,
          messageId: msgData.id,
          teamId,
          teamsChannelId,
          teamsUserId: msgData.from?.user?.id,
          content: messageContent,
          contentType: messageContentType,
          subject: msgData.subject,
          messageType: msgData.messageType,
          replyToId: msgData.replyToId,
          importance: msgData.importance,
          webUrl: msgData.webUrl,
          reactions: msgData.reactions,
          mentions: msgData.mentions,
          attachments: msgData.attachments,
          metadata: {
            etag: msgData.etag,
            locale: msgData.locale,
            lastEditedDateTime: msgData.lastEditedDateTime,
            deletedDateTime: msgData.deletedDateTime,
            eventDetail: msgData.eventDetail,
          },
          isDeleted: !!msgData.deletedDateTime,
          createdDateTime: msgData.createdDateTime ? new Date(msgData.createdDateTime) : new Date(),
          lastModifiedDateTime: msgData.lastModifiedDateTime ? new Date(msgData.lastModifiedDateTime) : undefined,
        });

        syncHistory.stats!.messagesCreated! += 1;
      }

      await this.messageRepository.save(message);
    } catch (error) {
      this.logger.error(`Failed to save message ${msgData.id}`, error);
    }
  }

  /**
   * Sync users for a team
   */
  private async syncTeamUsers(
    connection: TeamsConnection,
    team: any,
    apiConfig: any,
    syncHistory: TeamsSyncHistory,
  ): Promise<void> {
    try {
      this.logger.debug(`Fetching members for team ${team.displayName || team.id}`);

      let hasMore = true;
      let nextLink: string | undefined;

      while (hasMore) {
        const membersResponse = await this.teamsApiClient.getTeamMembers(apiConfig, team.id, {
          top: 50,
          nextLink,
        });
        syncHistory.stats!.apiCallsCount! += 1;

        const members = membersResponse.value || [];

        for (const memberData of members) {
          // Get full user details
          const userId = memberData.userId || memberData.id;

          try {
            const userData = await this.teamsApiClient.getUser(apiConfig, userId);
            syncHistory.stats!.apiCallsCount! += 1;

            let user = await this.userRepository.findOne({
              where: {
                tenantId: connection.tenantId,
                connectionId: connection.id,
                userId,
              },
            });

            if (user) {
              // Update existing user
              user.displayName = userData.displayName;
              user.email = userData.mail;
              user.jobTitle = userData.jobTitle;
              user.department = userData.department;
              user.officeLocation = userData.officeLocation;
              user.mobilePhone = userData.mobilePhone;
              user.businessPhones = userData.businessPhones;
              user.userPrincipalName = userData.userPrincipalName;
              user.profile = {
                givenName: userData.givenName,
                surname: userData.surname,
                preferredLanguage: userData.preferredLanguage,
                accountEnabled: userData.accountEnabled,
              };

              syncHistory.stats!.usersUpdated! += 1;
            } else {
              // Create new user
              user = this.userRepository.create({
                tenantId: connection.tenantId,
                connectionId: connection.id,
                userId,
                userPrincipalName: userData.userPrincipalName,
                displayName: userData.displayName,
                email: userData.mail,
                jobTitle: userData.jobTitle,
                department: userData.department,
                officeLocation: userData.officeLocation,
                mobilePhone: userData.mobilePhone,
                businessPhones: userData.businessPhones,
                profile: {
                  givenName: userData.givenName,
                  surname: userData.surname,
                  preferredLanguage: userData.preferredLanguage,
                  accountEnabled: userData.accountEnabled,
                },
                isGuest: userData.userType === 'Guest',
              });

              syncHistory.stats!.usersCreated! += 1;
            }

            await this.userRepository.save(user);
          } catch (error) {
            this.logger.warn(`Failed to fetch user details for ${userId}`, error.message);
          }
        }

        nextLink = membersResponse['@odata.nextLink'];
        hasMore = !!nextLink;
      }
    } catch (error) {
      this.logger.error(`Failed to sync users for team ${team.id}`, error);
    }
  }
}
