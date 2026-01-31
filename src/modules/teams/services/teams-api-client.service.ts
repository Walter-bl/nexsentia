import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface TeamsApiConfig {
  accessToken: string;
}

@Injectable()
export class TeamsApiClientService {
  private readonly logger = new Logger(TeamsApiClientService.name);
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';

  /**
   * Create axios instance with authentication
   */
  private createClient(config: TeamsApiConfig): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Make API request with error handling
   */
  private async makeRequest(config: TeamsApiConfig, endpoint: string): Promise<any> {
    try {
      const client = this.createClient(config);
      const response = await client.get(endpoint);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `API request failed: ${endpoint}`,
          error.response?.data || error.message,
        );
        throw new Error(`Microsoft Graph API error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all teams the user is a member of
   */
  async getJoinedTeams(config: TeamsApiConfig): Promise<any> {
    return this.makeRequest(config, '/me/joinedTeams');
  }

  /**
   * Get team details
   */
  async getTeam(config: TeamsApiConfig, teamId: string): Promise<any> {
    return this.makeRequest(config, `/teams/${teamId}`);
  }

  /**
   * Get all channels in a team
   */
  async getTeamChannels(config: TeamsApiConfig, teamId: string): Promise<any> {
    return this.makeRequest(config, `/teams/${teamId}/channels`);
  }

  /**
   * Get channel details
   */
  async getChannel(config: TeamsApiConfig, teamId: string, channelId: string): Promise<any> {
    return this.makeRequest(config, `/teams/${teamId}/channels/${channelId}`);
  }

  /**
   * Get messages from a channel
   */
  async getChannelMessages(
    config: TeamsApiConfig,
    teamId: string,
    channelId: string,
    options?: {
      top?: number;
      filter?: string;
      orderBy?: string;
      nextLink?: string;
    },
  ): Promise<any> {
    if (options?.nextLink) {
      // Use the full nextLink URL
      try {
        const client = this.createClient(config);
        const response = await client.get(options.nextLink.replace(this.baseUrl, ''));
        return response.data;
      } catch (error) {
        this.logger.error(`Failed to fetch next page: ${options.nextLink}`, error);
        throw error;
      }
    }

    const params = new URLSearchParams();
    if (options?.top) params.append('$top', options.top.toString());
    if (options?.filter) params.append('$filter', options.filter);
    if (options?.orderBy) params.append('$orderby', options.orderBy);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest(
      config,
      `/teams/${teamId}/channels/${channelId}/messages${queryString}`,
    );
  }

  /**
   * Get message replies (thread messages)
   */
  async getMessageReplies(
    config: TeamsApiConfig,
    teamId: string,
    channelId: string,
    messageId: string,
    options?: {
      top?: number;
      nextLink?: string;
    },
  ): Promise<any> {
    if (options?.nextLink) {
      try {
        const client = this.createClient(config);
        const response = await client.get(options.nextLink.replace(this.baseUrl, ''));
        return response.data;
      } catch (error) {
        this.logger.error(`Failed to fetch reply next page: ${options.nextLink}`, error);
        throw error;
      }
    }

    const params = new URLSearchParams();
    if (options?.top) params.append('$top', options.top.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest(
      config,
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies${queryString}`,
    );
  }

  /**
   * Get team members
   */
  async getTeamMembers(
    config: TeamsApiConfig,
    teamId: string,
    options?: {
      top?: number;
      nextLink?: string;
    },
  ): Promise<any> {
    if (options?.nextLink) {
      try {
        const client = this.createClient(config);
        const response = await client.get(options.nextLink.replace(this.baseUrl, ''));
        return response.data;
      } catch (error) {
        this.logger.error(`Failed to fetch members next page: ${options.nextLink}`, error);
        throw error;
      }
    }

    const params = new URLSearchParams();
    if (options?.top) params.append('$top', options.top.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest(config, `/teams/${teamId}/members${queryString}`);
  }

  /**
   * Get user details
   */
  async getUser(config: TeamsApiConfig, userId: string): Promise<any> {
    return this.makeRequest(config, `/users/${userId}`);
  }

  /**
   * Get multiple users in a batch
   */
  async getBatchUsers(config: TeamsApiConfig, userIds: string[]): Promise<any[]> {
    // Microsoft Graph supports batch requests, but for simplicity we'll do individual requests
    // In production, you might want to use the $batch endpoint for efficiency
    const users = [];
    for (const userId of userIds) {
      try {
        const user = await this.getUser(config, userId);
        users.push(user);
      } catch (error) {
        this.logger.warn(`Failed to fetch user ${userId}`, error);
      }
    }
    return users;
  }

  /**
   * Get channel tabs
   */
  async getChannelTabs(config: TeamsApiConfig, teamId: string, channelId: string): Promise<any> {
    return this.makeRequest(config, `/teams/${teamId}/channels/${channelId}/tabs`);
  }

  /**
   * Get channel files (via SharePoint drive)
   */
  async getChannelFiles(config: TeamsApiConfig, teamId: string, channelId: string): Promise<any> {
    return this.makeRequest(
      config,
      `/teams/${teamId}/channels/${channelId}/filesFolder/children`,
    );
  }
}
