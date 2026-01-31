import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { JiraConnection } from '../entities/jira-connection.entity';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface JiraUserInfo {
  account_id: string;
  email: string;
  name: string;
  picture?: string;
}

interface JiraAccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
}

@Injectable()
export class JiraOAuthService {
  private readonly logger = new Logger(JiraOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly authorizationUrl = 'https://auth.atlassian.com/authorize';
  private readonly tokenUrl = 'https://auth.atlassian.com/oauth/token';
  private readonly userInfoUrl = 'https://api.atlassian.com/me';
  private readonly accessibleResourcesUrl = 'https://api.atlassian.com/oauth/token/accessible-resources';

  constructor(
    @InjectRepository(JiraConnection)
    private readonly connectionRepository: Repository<JiraConnection>,
    private readonly configService: ConfigService,
  ) {
    // Load OAuth configuration from environment
    this.clientId = this.configService.get<string>('JIRA_OAUTH_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('JIRA_OAUTH_CLIENT_SECRET') || '';
    this.callbackUrl = this.configService.get<string>('JIRA_OAUTH_CALLBACK_URL') ||
                       `${this.configService.get<string>('APP_URL')}/api/jira/oauth/callback`;

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('Jira OAuth credentials not configured. OAuth flow will not work.');
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthorizationUrl(state?: string): string {
    const scopes = [
      'read:jira-work',
      'read:jira-user',
      'write:jira-work',
      'read:me',         // Required to fetch user profile information
      'offline_access',  // For refresh token
    ];

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope: scopes.join(' '),
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      prompt: 'consent',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    try {
      this.logger.log('Exchanging authorization code for access token');

      const response = await axios.post<OAuthTokenResponse>(
        this.tokenUrl,
        {
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.callbackUrl,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange code for token', error.response?.data || error.message);
      throw new BadRequestException('Failed to exchange authorization code for token');
    }
  }

  /**
   * Refresh OAuth access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      this.logger.log('Refreshing OAuth access token');

      const response = await axios.post<OAuthTokenResponse>(
        this.tokenUrl,
        {
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to refresh access token', error.response?.data || error.message);
      throw new UnauthorizedException('Failed to refresh access token. Please re-authenticate.');
    }
  }

  /**
   * Get user information from Jira
   */
  async getUserInfo(accessToken: string): Promise<JiraUserInfo> {
    try {
      const response = await axios.get<JiraUserInfo>(this.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch user info', error.response?.data || error.message);
      throw new BadRequestException('Failed to fetch user information');
    }
  }

  /**
   * Get accessible Jira resources (sites)
   */
  async getAccessibleResources(accessToken: string): Promise<JiraAccessibleResource[]> {
    try {
      const response = await axios.get<JiraAccessibleResource[]>(this.accessibleResourcesUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch accessible resources', error.response?.data || error.message);
      throw new BadRequestException('Failed to fetch accessible Jira resources');
    }
  }

  /**
   * Complete OAuth flow and create/update connection
   */
  async completeOAuthFlow(
    tenantId: number,
    code: string,
    connectionName?: string,
    existingConnectionId?: number,
  ): Promise<JiraConnection> {
    // Exchange code for token
    const tokenData = await this.exchangeCodeForToken(code);

    // Get user info
    const userInfo = await this.getUserInfo(tokenData.access_token);

    // Get accessible resources
    const resources = await this.getAccessibleResources(tokenData.access_token);

    if (!resources || resources.length === 0) {
      throw new BadRequestException('No accessible Jira resources found for this account');
    }

    // Use the first accessible resource (or allow user to select)
    const primaryResource = resources[0];

    // Use provided connection name, or fallback to Jira workspace name
    const finalConnectionName = connectionName || primaryResource.name || 'Jira Connection';

    this.logger.log(`Creating connection: "${finalConnectionName}" for workspace: ${primaryResource.name}`);

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const connectionData = {
      name: finalConnectionName,
      jiraInstanceUrl: primaryResource.url,
      jiraCloudId: primaryResource.id,
      jiraType: 'cloud',
      authType: 'oauth',
      oauthAccessToken: tokenData.access_token,
      oauthRefreshToken: tokenData.refresh_token,
      oauthTokenExpiresAt: expiresAt,
      oauthScope: tokenData.scope,
      oauthMetadata: {
        cloudId: primaryResource.id,
        accountId: userInfo.account_id,
        displayName: userInfo.name,
        email: userInfo.email,
        workspaceName: primaryResource.name, // Store original workspace name
        workspaceUrl: primaryResource.url,
      },
      isActive: true,
      tenantId,
    };

    if (existingConnectionId) {
      // Update existing connection
      const connection = await this.connectionRepository.findOne({
        where: { id: existingConnectionId, tenantId },
      });

      if (!connection) {
        throw new BadRequestException('Connection not found');
      }

      Object.assign(connection, connectionData);
      return await this.connectionRepository.save(connection);
    } else {
      // Create new connection
      const connection = this.connectionRepository.create(connectionData);
      return await this.connectionRepository.save(connection);
    }
  }

  /**
   * Refresh token for a connection if needed
   */
  async refreshTokenIfNeeded(connection: JiraConnection): Promise<JiraConnection> {
    // Check if token is expired or will expire in next 5 minutes
    const now = new Date();
    const expiresAt = new Date(connection.oauthTokenExpiresAt);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
      // Token is still valid
      return connection;
    }

    if (!connection.oauthRefreshToken) {
      throw new UnauthorizedException('No refresh token available. Please re-authenticate.');
    }

    this.logger.log(`Refreshing OAuth token for connection ${connection.id}`);

    // Refresh the token
    const tokenData = await this.refreshAccessToken(connection.oauthRefreshToken);

    // Update connection with new token
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

    connection.oauthAccessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      connection.oauthRefreshToken = tokenData.refresh_token;
    }
    connection.oauthTokenExpiresAt = newExpiresAt;
    connection.oauthScope = tokenData.scope;

    return await this.connectionRepository.save(connection);
  }

  /**
   * Get valid access token for a connection (refreshes if needed)
   */
  async getValidAccessToken(connection: JiraConnection): Promise<string> {
    const refreshedConnection = await this.refreshTokenIfNeeded(connection);
    return refreshedConnection.oauthAccessToken;
  }

  /**
   * Revoke OAuth access (disconnect)
   */
  async revokeAccess(connection: JiraConnection): Promise<void> {
    if (!connection.oauthAccessToken) {
      return;
    }

    try {
      // Note: Atlassian doesn't have a standard revoke endpoint
      // We'll soft delete the connection
      connection.isActive = false;

      await this.connectionRepository.softRemove(connection);
      this.logger.log(`OAuth access revoked for connection ${connection.id}`);
    } catch (error) {
      this.logger.error('Failed to revoke OAuth access', error.message);
      throw new BadRequestException('Failed to revoke OAuth access');
    }
  }
}
