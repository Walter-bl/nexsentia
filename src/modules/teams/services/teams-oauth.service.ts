import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamsConnection } from '../entities/teams-connection.entity';
import axios from 'axios';

interface MicrosoftTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}

@Injectable()
export class TeamsOAuthService {
  private readonly logger = new Logger(TeamsOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly tenantId: string; // Azure AD Tenant ID
  private readonly authorizationEndpoint: string;
  private readonly tokenEndpoint: string;

  constructor(
    @InjectRepository(TeamsConnection)
    private readonly connectionRepository: Repository<TeamsConnection>,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('TEAMS_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('TEAMS_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('TEAMS_REDIRECT_URI') || '';
    this.tenantId = this.configService.get<string>('TEAMS_TENANT_ID') || 'common'; // 'common' for multi-tenant

    // Microsoft Identity Platform endpoints
    this.authorizationEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`;
    this.tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
  }

  /**
   * Generate Microsoft OAuth authorization URL
   */
  generateAuthorizationUrl(state?: string): string {
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access', // Required for refresh tokens
      'User.Read',
      'Team.ReadBasic.All',
      'Channel.ReadBasic.All',
      'ChannelMessage.Read.All',
      'ChannelSettings.Read.All',
      'TeamMember.Read.All',
      'User.ReadBasic.All',
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: scopes.join(' '),
      ...(state && { state }),
    });

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<MicrosoftTokenResponse> {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await axios.post<MicrosoftTokenResponse>(
        this.tokenEndpoint,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange code for token', error);
      throw new Error('OAuth token exchange failed');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<MicrosoftTokenResponse> {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await axios.post<MicrosoftTokenResponse>(
        this.tokenEndpoint,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to refresh access token', error);
      throw new Error('Token refresh failed');
    }
  }

  /**
   * Get user info from Microsoft Graph API
   */
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get user info', error);
      throw new Error('Failed to fetch user info');
    }
  }

  /**
   * Get organization/tenant info from Microsoft Graph API
   */
  async getOrganizationInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/organization', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.value[0]; // Return first organization
    } catch (error) {
      this.logger.error('Failed to get organization info', error);
      return null; // Organization info is optional
    }
  }

  /**
   * Complete OAuth flow and save connection
   */
  async completeOAuthFlow(
    tenantId: number,
    code: string,
    connectionName?: string,
  ): Promise<TeamsConnection> {
    // Exchange code for tokens
    const tokenData = await this.exchangeCodeForToken(code);

    // Get user info
    const userInfo = await this.getUserInfo(tokenData.access_token);

    // Get organization info (optional)
    const orgInfo = await this.getOrganizationInfo(tokenData.access_token);

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Check if connection already exists for this tenant
    const existingConnection = await this.connectionRepository.findOne({
      where: {
        tenantId,
        tenantIdMs: orgInfo?.id || userInfo.id,
      },
    });

    if (existingConnection) {
      // Update existing connection
      existingConnection.accessToken = tokenData.access_token;
      existingConnection.refreshToken = tokenData.refresh_token;
      existingConnection.tokenExpiresAt = tokenExpiresAt;
      existingConnection.oauthMetadata = {
        scope: tokenData.scope,
        grantedScopes: tokenData.scope?.split(' '),
        userId: userInfo.id,
        userDisplayName: userInfo.displayName,
        userEmail: userInfo.mail || userInfo.userPrincipalName,
      };
      existingConnection.isActive = true;

      return this.connectionRepository.save(existingConnection);
    }

    // Create new connection
    const connection = this.connectionRepository.create({
      tenantId,
      name: connectionName || orgInfo?.displayName || userInfo.displayName || 'Microsoft Teams',
      tenantIdMs: orgInfo?.id || userInfo.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt,
      teamName: orgInfo?.displayName,
      oauthMetadata: {
        scope: tokenData.scope,
        grantedScopes: tokenData.scope?.split(' '),
        userId: userInfo.id,
        userDisplayName: userInfo.displayName,
        userEmail: userInfo.mail || userInfo.userPrincipalName,
      },
      syncSettings: {
        autoSync: true,
        syncInterval: 30, // 30 minutes default
        syncChannels: true,
        syncMessages: true,
        syncFiles: true,
      },
      isActive: true,
    });

    return this.connectionRepository.save(connection);
  }

  /**
   * Ensure access token is valid (refresh if needed)
   */
  async ensureValidToken(connection: TeamsConnection): Promise<string> {
    // Check if token is expired or will expire in the next 5 minutes
    const expiresIn = connection.tokenExpiresAt
      ? (connection.tokenExpiresAt.getTime() - Date.now()) / 1000
      : 0;

    if (expiresIn < 300) {
      // Token expired or expiring soon
      if (!connection.refreshToken) {
        throw new Error('No refresh token available');
      }

      this.logger.log(`Refreshing access token for connection ${connection.id}`);
      const tokenData = await this.refreshAccessToken(connection.refreshToken);

      // Update connection with new tokens
      connection.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        connection.refreshToken = tokenData.refresh_token;
      }
      connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      await this.connectionRepository.save(connection);

      return tokenData.access_token;
    }

    return connection.accessToken;
  }
}
