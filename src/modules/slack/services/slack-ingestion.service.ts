import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SlackConnection } from '../entities/slack-connection.entity';
import { SlackChannel } from '../entities/slack-channel.entity';
import { SlackUser } from '../entities/slack-user.entity';
import { SlackMessage } from '../entities/slack-message.entity';
import { SlackSyncHistory } from '../entities/slack-sync-history.entity';
import { SlackApiClientService, SlackApiConfig } from './slack-api-client.service';

@Injectable()
export class SlackIngestionService {
  private readonly logger = new Logger(SlackIngestionService.name);
  private readonly activeSyncs = new Map<number, boolean>();
  private readonly defaultSyncInterval: number;

  constructor(
    @InjectRepository(SlackConnection)
    private readonly connectionRepository: Repository<SlackConnection>,
    @InjectRepository(SlackChannel)
    private readonly channelRepository: Repository<SlackChannel>,
    @InjectRepository(SlackUser)
    private readonly userRepository: Repository<SlackUser>,
    @InjectRepository(SlackMessage)
    private readonly messageRepository: Repository<SlackMessage>,
    @InjectRepository(SlackSyncHistory)
    private readonly syncHistoryRepository: Repository<SlackSyncHistory>,
    private readonly slackApiClient: SlackApiClientService,
    private readonly configService: ConfigService,
  ) {
    this.defaultSyncInterval = this.configService.get<number>('SLACK_SYNC_INTERVAL_MINUTES', 30);
    this.logger.log(`Slack sync default interval: ${this.defaultSyncInterval} minutes`);
  }

  /**
   * Scheduled sync job for all active Slack connections
   * DISABLED: Cron disabled to reduce server load
   */
  // @Cron(process.env.SLACK_SYNC_CRON_SCHEDULE || '0 */30 * * * *')
  async handleScheduledSync() {
    this.logger.log('Starting scheduled sync for all active Slack connections');

    const activeConnections = await this.connectionRepository.find({
      where: { isActive: true },
    });

    for (const connection of activeConnections) {
      const syncSettings = connection.syncSettings || {};
      const syncInterval = syncSettings.syncInterval || this.defaultSyncInterval;

      // Use lastSuccessfulSyncAt if available, otherwise use lastSyncAt
      const lastSync = connection.lastSuccessfulSyncAt || connection.lastSyncAt;

      if (lastSync) {
        const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
        if (minutesSinceLastSync < syncInterval) {
          this.logger.debug(
            `Skipping connection ${connection.id} - last successful sync was ${minutesSinceLastSync.toFixed(1)} minutes ago`,
          );
          continue;
        }
      }

      // Skip if already syncing
      if (this.activeSyncs.get(connection.id)) {
        this.logger.warn(`Sync already in progress for connection ${connection.id}`);
        continue;
      }

      // Start sync in background
      this.syncConnection(connection.id, connection.tenantId).catch((error) => {
        this.logger.error(
          `Background sync failed for connection ${connection.id}: ${error.message}`,
        );
      });
    }
  }

  /**
   * Sync a single Slack connection
   */
  async syncConnection(
    connectionId: number,
    tenantId: number,
    syncType: 'full' | 'incremental' = 'incremental',
  ): Promise<SlackSyncHistory> {
    // Check if already syncing
    if (this.activeSyncs.get(connectionId)) {
      throw new Error(`Sync already in progress for connection ${connectionId}`);
    }

    this.activeSyncs.set(connectionId, true);
    const startTime = Date.now();

    // Create sync history record
    const syncHistory = this.syncHistoryRepository.create({
      tenantId,
      connectionId,
      syncType,
      status: 'in_progress',
      startedAt: new Date(),
    });
    await this.syncHistoryRepository.save(syncHistory);

    try {
      this.logger.log(`Starting ${syncType} sync for connection ${connectionId}`);

      const connection = await this.connectionRepository.findOne({
        where: { id: connectionId, tenantId },
      });

      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      // Update last sync timestamp
      connection.lastSyncAt = new Date();
      await this.connectionRepository.save(connection);

      const apiConfig: SlackApiConfig = {
        accessToken: connection.accessToken,
        teamId: connection.teamId,
      };

      // Sync users first
      await this.syncUsers(tenantId, connection, apiConfig);

      // Sync channels
      await this.syncChannels(tenantId, connection, apiConfig);

      // Sync messages
      const stats = await this.syncMessages(
        tenantId,
        connection,
        apiConfig,
        syncType,
      );

      // Update sync history
      const duration = (Date.now() - startTime) / 1000;
      syncHistory.status = 'completed';
      syncHistory.completedAt = new Date();
      syncHistory.channelsProcessed = stats.channelsProcessed;
      syncHistory.messagesCreated = stats.messagesCreated;
      syncHistory.messagesUpdated = stats.messagesUpdated;
      syncHistory.totalMessagesProcessed = stats.totalMessagesProcessed;
      syncHistory.usersProcessed = stats.usersProcessed;
      syncHistory.syncStats = {
        duration,
        apiCallsCount: stats.apiCallsCount,
        channelIds: stats.channelIds,
      };

      await this.syncHistoryRepository.save(syncHistory);

      // Update connection
      connection.lastSuccessfulSyncAt = new Date();
      connection.totalMessagesSynced = stats.totalMessagesProcessed;
      connection.failedSyncAttempts = 0;
      connection.lastSyncError = undefined;
      await this.connectionRepository.save(connection);

      this.logger.log(
        `✅ Sync completed for connection ${connectionId} in ${duration.toFixed(2)}s\n` +
          `   📊 Stats: ${stats.totalMessagesProcessed} total messages | ${stats.messagesCreated} created | ${stats.messagesUpdated} updated\n` +
          `   📁 Channels: ${stats.channelIds.join(', ')}\n` +
          `   👥 Users: ${stats.usersProcessed}\n` +
          `   🔄 API calls: ${stats.apiCallsCount}`,
      );

      return syncHistory;
    } catch (error) {
      this.logger.error(`Sync failed for connection ${connectionId}: ${error.message}`, error.stack);

      // Update sync history
      syncHistory.status = 'failed';
      syncHistory.completedAt = new Date();
      syncHistory.errorMessage = error.message;
      syncHistory.errorDetails = {
        stack: error.stack,
        name: error.name,
      };
      await this.syncHistoryRepository.save(syncHistory);

      // Update connection
      const connection = await this.connectionRepository.findOne({
        where: { id: connectionId },
      });
      if (connection) {
        connection.lastSyncError = error.message;
        connection.failedSyncAttempts += 1;
        await this.connectionRepository.save(connection);
      }

      throw error;
    } finally {
      this.activeSyncs.delete(connectionId);
    }
  }

  /**
   * Sync users from Slack
   */
  private async syncUsers(
    tenantId: number,
    connection: SlackConnection,
    apiConfig: SlackApiConfig,
  ): Promise<number> {
    this.logger.debug(`Syncing users for connection ${connection.id}`);

    let cursor: string | undefined;
    let userCount = 0;

    do {
      const response = await this.slackApiClient.getUsers(apiConfig, cursor);

      for (const slackUser of response.members || []) {
        let user = await this.userRepository.findOne({
          where: {
            tenantId,
            connectionId: connection.id,
            slackUserId: slackUser.id,
          },
        });

        const userData = {
          slackUserId: slackUser.id,
          teamId: slackUser.team_id,
          name: slackUser.name,
          realName: slackUser.real_name || slackUser.profile?.real_name,
          displayName: slackUser.profile?.display_name,
          email: slackUser.profile?.email,
          avatarUrl: slackUser.profile?.image_512 || slackUser.profile?.image_192,
          statusText: slackUser.profile?.status_text,
          statusEmoji: slackUser.profile?.status_emoji,
          title: slackUser.profile?.title,
          timezone: slackUser.tz,
          timezoneOffset: slackUser.tz_offset,
          isBot: slackUser.is_bot,
          isAdmin: slackUser.is_admin,
          isOwner: slackUser.is_owner,
          isPrimaryOwner: slackUser.is_primary_owner,
          isRestricted: slackUser.is_restricted,
          isUltraRestricted: slackUser.is_ultra_restricted,
          isDeleted: slackUser.deleted,
          slackUpdatedAt: slackUser.updated ? new Date(slackUser.updated * 1000) : undefined,
          lastSyncedAt: new Date(),
          metadata: {
            phone: slackUser.profile?.phone,
            skype: slackUser.profile?.skype,
            fields: slackUser.profile?.fields,
            locale: slackUser.locale,
          },
        };

        if (user) {
          Object.assign(user, userData);
        } else {
          user = this.userRepository.create({
            tenantId,
            connectionId: connection.id,
            ...userData,
          });
        }

        await this.userRepository.save(user);
        userCount++;
      }

      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    this.logger.log(`Synced ${userCount} users for connection ${connection.id}`);
    return userCount;
  }

  /**
   * Sync channels from Slack
   */
  private async syncChannels(
    tenantId: number,
    connection: SlackConnection,
    apiConfig: SlackApiConfig,
  ): Promise<void> {
    this.logger.debug(`Syncing channels for connection ${connection.id}`);

    let cursor: string | undefined;

    do {
      const response = await this.slackApiClient.getConversations(apiConfig, {
        types: 'public_channel,private_channel,im,mpim',
        cursor,
      });

      for (const slackChannel of response.channels || []) {
        let channel = await this.channelRepository.findOne({
          where: {
            tenantId,
            connectionId: connection.id,
            slackChannelId: slackChannel.id,
          },
        });

        // Determine channel name based on type
        let channelName = slackChannel.name;
        const isDirectMessage = slackChannel.is_im === true;
        const isMultiPartyDM = slackChannel.is_mpim === true;

        // For DMs, try to get a better name using the user info
        if (isDirectMessage && slackChannel.user) {
          try {
            const user = await this.userRepository.findOne({
              where: {
                tenantId,
                connectionId: connection.id,
                slackUserId: slackChannel.user,
              },
            });
            if (user) {
              channelName = `DM: ${user.displayName || user.realName || user.name || slackChannel.user}`;
            } else {
              channelName = `DM: ${slackChannel.user}`;
            }
          } catch (error) {
            channelName = `DM: ${slackChannel.user}`;
          }
        } else if (isMultiPartyDM) {
          channelName = slackChannel.name || `Group DM: ${slackChannel.id}`;
        } else if (!channelName) {
          channelName = slackChannel.id;
        }

        const channelData = {
          slackChannelId: slackChannel.id,
          name: channelName,
          description: slackChannel.purpose?.value,
          topic: slackChannel.topic?.value,
          purpose: slackChannel.purpose?.value,
          isPrivate: slackChannel.is_private || isDirectMessage || isMultiPartyDM,
          isArchived: slackChannel.is_archived,
          isGeneral: slackChannel.is_general,
          memberCount: slackChannel.num_members || 0,
          creatorId: slackChannel.creator,
          slackCreatedAt: slackChannel.created ? new Date(slackChannel.created * 1000) : undefined,
          lastSyncedAt: new Date(),
          isActive: !slackChannel.is_archived,
          metadata: {
            isDirectMessage,
            isMultiPartyDM,
            dmUserId: slackChannel.user,
            locale: slackChannel.locale,
            sharedTeamIds: slackChannel.shared_team_ids,
            pendingShared: slackChannel.pending_shared,
            previousNames: slackChannel.previous_names,
          },
        };

        if (channel) {
          Object.assign(channel, channelData);
        } else {
          channel = this.channelRepository.create({
            tenantId,
            connectionId: connection.id,
            ...channelData,
          });
        }

        await this.channelRepository.save(channel);
      }

      cursor = response.response_metadata?.next_cursor;
    } while (cursor);
  }

  /**
   * Sync messages from Slack channels
   */
  private async syncMessages(
    tenantId: number,
    connection: SlackConnection,
    apiConfig: SlackApiConfig,
    syncType: 'full' | 'incremental',
  ): Promise<{
    channelsProcessed: number;
    messagesCreated: number;
    messagesUpdated: number;
    totalMessagesProcessed: number;
    usersProcessed: number;
    apiCallsCount: number;
    channelIds: string[];
  }> {
    const stats = {
      channelsProcessed: 0,
      messagesCreated: 0,
      messagesUpdated: 0,
      totalMessagesProcessed: 0,
      usersProcessed: 0,
      apiCallsCount: 0,
      channelIds: [] as string[],
    };

    const whereClause: any = {
      tenantId,
      connectionId: connection.id,
      isActive: true,
    };

    const channels = await this.channelRepository.find({ where: whereClause });

    for (const channel of channels) {
      this.logger.log(`[${channel.name}] Syncing messages...`);

      stats.channelsProcessed += 1;
      stats.channelIds.push(channel.name);

      let cursor: string | undefined;
      let oldest: string | undefined;

      // For incremental sync, only get messages since last successful sync
      if (syncType === 'incremental' && connection.lastSuccessfulSyncAt) {
        oldest = (connection.lastSuccessfulSyncAt.getTime() / 1000).toString();
        this.logger.log(`[${channel.name}] Fetching incremental updates since ${connection.lastSuccessfulSyncAt.toISOString()}`);
      }

      try {
        do {
          const response = await this.slackApiClient.getConversationHistory(apiConfig, channel.slackChannelId, {
            oldest,
            cursor,
            limit: 100,
          });

          stats.apiCallsCount += 1;

          this.logger.log(`[${channel.name}] Retrieved ${response.messages?.length || 0} messages`);

          for (const slackMessage of response.messages || []) {
            try {
              await this.saveMessage(tenantId, channel, slackMessage);
              stats.totalMessagesProcessed += 1;

              const existingMessage = await this.messageRepository.findOne({
                where: { slackMessageTs: slackMessage.ts },
              });

              if (existingMessage) {
                stats.messagesUpdated += 1;
              } else {
                stats.messagesCreated += 1;
              }
            } catch (error) {
              this.logger.error(
                `Failed to save message ${slackMessage.ts}: ${error.message}`,
              );
            }
          }

          cursor = response.response_metadata?.next_cursor;
        } while (cursor);
      } catch (error) {
        if (error.message?.includes('not_in_channel')) {
          // Check if it's a DM or group DM (they don't need joining)
          const isDirectMessage = channel.metadata?.isDirectMessage === true;
          const isMultiPartyDM = channel.metadata?.isMultiPartyDM === true;

          if (isDirectMessage || isMultiPartyDM) {
            this.logger.warn(`[${channel.name}] Cannot access DM/Group DM (may be inactive or archived)`);
          } else if (!channel.isPrivate) {
            // Try to join the channel if it's public
            this.logger.log(`[${channel.name}] Bot not in channel, attempting to join...`);
            try {
              await this.slackApiClient.joinChannel(apiConfig, channel.slackChannelId);
              this.logger.log(`[${channel.name}] Successfully joined channel`);

              // Retry fetching messages after joining
              const response = await this.slackApiClient.getConversationHistory(apiConfig, channel.slackChannelId, {
                oldest,
                limit: 100,
              });

              stats.apiCallsCount += 1;
              this.logger.log(`[${channel.name}] Retrieved ${response.messages?.length || 0} messages after joining`);

              for (const slackMessage of response.messages || []) {
                try {
                  await this.saveMessage(tenantId, channel, slackMessage);
                  stats.totalMessagesProcessed += 1;
                  stats.messagesCreated += 1;
                } catch (error) {
                  this.logger.error(
                    `Failed to save message ${slackMessage.ts}: ${error.message}`,
                  );
                }
              }
            } catch (joinError) {
              this.logger.warn(`[${channel.name}] Could not join channel: ${joinError.message}`);
            }
          } else {
            this.logger.warn(`[${channel.name}] Bot not in private channel, skipping...`);
          }
        } else {
          this.logger.error(`[${channel.name}] Error syncing messages: ${error.message}`);
        }
      }

      // Update channel stats
      const messageCount = await this.messageRepository.count({
        where: { channelId: channel.id },
      });
      channel.totalMessages = messageCount;
      channel.lastSyncedAt = new Date();
      await this.channelRepository.save(channel);

      this.logger.log(`[${channel.name}] Sync complete. Created: ${stats.messagesCreated}, Updated: ${stats.messagesUpdated}`);
    }

    return stats;
  }

  /**
   * Save or update a message
   */
  private async saveMessage(
    tenantId: number,
    channel: SlackChannel,
    slackMessage: any,
  ): Promise<void> {
    let message = await this.messageRepository.findOne({
      where: { slackMessageTs: slackMessage.ts },
    });

    const messageData = {
      slackMessageTs: slackMessage.ts,
      slackChannelId: channel.slackChannelId,
      slackUserId: slackMessage.user || slackMessage.bot_id || 'unknown',
      text: slackMessage.text || '',
      type: slackMessage.type || 'message',
      subtype: slackMessage.subtype,
      slackThreadTs: slackMessage.thread_ts,
      isThreadReply: !!slackMessage.thread_ts && slackMessage.thread_ts !== slackMessage.ts,
      replyCount: slackMessage.reply_count || 0,
      replyUsers: slackMessage.reply_users,
      latestReplyAt: slackMessage.latest_reply ? new Date(parseFloat(slackMessage.latest_reply) * 1000) : undefined,
      reactions: slackMessage.reactions,
      attachments: slackMessage.attachments,
      files: slackMessage.files,
      isEdited: !!slackMessage.edited,
      editedAt: slackMessage.edited?.ts ? new Date(parseFloat(slackMessage.edited.ts) * 1000) : undefined,
      isPinned: slackMessage.pinned_to?.length > 0,
      isStarred: false,
      botId: slackMessage.bot_id,
      botUsername: slackMessage.username,
      slackCreatedAt: new Date(parseFloat(slackMessage.ts) * 1000),
      lastSyncedAt: new Date(),
      metadata: {
        blocks: slackMessage.blocks,
        clientMsgId: slackMessage.client_msg_id,
        team: slackMessage.team,
      },
    };

    if (message) {
      Object.assign(message, messageData);
    } else {
      message = this.messageRepository.create({
        tenantId,
        channelId: channel.id,
        ...messageData,
      });
    }

    await this.messageRepository.save(message);
  }
}
