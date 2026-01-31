import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

export interface SlackApiConfig {
  accessToken: string;
  teamId?: string;
}

@Injectable()
export class SlackApiClientService {
  private readonly logger = new Logger(SlackApiClientService.name);
  private readonly baseUrl = 'https://slack.com/api';

  /**
   * Make a request to the Slack API
   */
  private async makeRequest<T>(
    config: SlackApiConfig,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(`Making ${method} request to: ${url}`);

      const response = await fetch(url, options);
      const data = await response.json();

      if (!data.ok) {
        this.logger.error(`Slack API error: ${data.error}`);
        throw new HttpException(
          `Slack API error: ${data.error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return data as T;
    } catch (error) {
      this.logger.error(`Slack API request failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Test authentication
   */
  async testAuth(config: SlackApiConfig): Promise<any> {
    return this.makeRequest(config, 'auth.test');
  }

  /**
   * Get team info
   */
  async getTeamInfo(config: SlackApiConfig): Promise<any> {
    return this.makeRequest(config, 'team.info');
  }

  /**
   * Get list of conversations (channels)
   */
  async getConversations(
    config: SlackApiConfig,
    options?: {
      types?: string; // 'public_channel,private_channel'
      excludeArchived?: boolean;
      limit?: number;
      cursor?: string;
    },
  ): Promise<any> {
    const params = new URLSearchParams({
      types: options?.types || 'public_channel,private_channel',
      exclude_archived: options?.excludeArchived !== false ? 'true' : 'false',
      limit: (options?.limit || 100).toString(),
      ...(options?.cursor && { cursor: options.cursor }),
    });

    return this.makeRequest(config, `conversations.list?${params.toString()}`);
  }

  /**
   * Get conversation info
   */
  async getConversationInfo(
    config: SlackApiConfig,
    channelId: string,
  ): Promise<any> {
    return this.makeRequest(config, `conversations.info?channel=${channelId}`);
  }

  /**
   * Get conversation members
   */
  async getConversationMembers(
    config: SlackApiConfig,
    channelId: string,
    cursor?: string,
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channelId,
      limit: '100',
      ...(cursor && { cursor }),
    });

    return this.makeRequest(config, `conversations.members?${params.toString()}`);
  }

  /**
   * Get conversation history (messages)
   */
  async getConversationHistory(
    config: SlackApiConfig,
    channelId: string,
    options?: {
      oldest?: string; // Unix timestamp
      latest?: string; // Unix timestamp
      limit?: number;
      cursor?: string;
      inclusive?: boolean;
    },
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channelId,
      limit: (options?.limit || 100).toString(),
      ...(options?.oldest && { oldest: options.oldest }),
      ...(options?.latest && { latest: options.latest }),
      ...(options?.cursor && { cursor: options.cursor }),
      ...(options?.inclusive !== undefined && {
        inclusive: options.inclusive.toString(),
      }),
    });

    return this.makeRequest(config, `conversations.history?${params.toString()}`);
  }

  /**
   * Get thread replies
   */
  async getThreadReplies(
    config: SlackApiConfig,
    channelId: string,
    threadTs: string,
    cursor?: string,
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channelId,
      ts: threadTs,
      limit: '100',
      ...(cursor && { cursor }),
    });

    return this.makeRequest(config, `conversations.replies?${params.toString()}`);
  }

  /**
   * Get list of users
   */
  async getUsers(
    config: SlackApiConfig,
    cursor?: string,
  ): Promise<any> {
    const params = new URLSearchParams({
      limit: '100',
      ...(cursor && { cursor }),
    });

    return this.makeRequest(config, `users.list?${params.toString()}`);
  }

  /**
   * Get user info
   */
  async getUserInfo(
    config: SlackApiConfig,
    userId: string,
  ): Promise<any> {
    return this.makeRequest(config, `users.info?user=${userId}`);
  }

  /**
   * Get reactions for a message
   */
  async getReactions(
    config: SlackApiConfig,
    channelId: string,
    timestamp: string,
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channelId,
      timestamp,
    });

    return this.makeRequest(config, `reactions.get?${params.toString()}`);
  }

  /**
   * Join a channel (bot must have channels:join scope)
   */
  async joinChannel(
    config: SlackApiConfig,
    channelId: string,
  ): Promise<any> {
    return this.makeRequest(
      config,
      'conversations.join',
      'POST',
      { channel: channelId },
    );
  }

  /**
   * Check if bot is member of a channel
   */
  async isBotInChannel(
    config: SlackApiConfig,
    channelId: string,
    botUserId: string,
  ): Promise<boolean> {
    try {
      let cursor: string | undefined;
      do {
        const response = await this.getConversationMembers(config, channelId, cursor);
        if (response.members && response.members.includes(botUserId)) {
          return true;
        }
        cursor = response.response_metadata?.next_cursor;
      } while (cursor);
      return false;
    } catch (error) {
      // If we can't check, assume not in channel
      return false;
    }
  }
}
