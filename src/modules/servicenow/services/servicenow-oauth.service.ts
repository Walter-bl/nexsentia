import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceNowConnection } from '../entities/servicenow-connection.entity';

@Injectable()
export class ServiceNowOAuthService {
  private readonly logger = new Logger(ServiceNowOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    @InjectRepository(ServiceNowConnection)
    private readonly connectionRepository: Repository<ServiceNowConnection>,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('SERVICENOW_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('SERVICENOW_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('SERVICENOW_REDIRECT_URI') || '';
  }

  /**
   * Generate ServiceNow OAuth authorization URL
   */
  generateAuthorizationUrl(instanceUrl: string, state?: string): string {
    const scopes = [
      'useraccount',
      'user_impersonation',
    ];

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      ...(state && { state }),
    });

    return `${instanceUrl}/oauth_auth.do?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(instanceUrl: string, code: string): Promise<any> {
    const tokenUrl = `${instanceUrl}/oauth_token.do`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        this.logger.error(`ServiceNow OAuth error: ${data.error || data.error_description}`);
        throw new HttpException(
          `ServiceNow OAuth failed: ${data.error_description || data.error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return data;
    } catch (error) {
      this.logger.error(`OAuth token exchange failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(instanceUrl: string, refreshToken: string): Promise<any> {
    const tokenUrl = `${instanceUrl}/oauth_token.do`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        this.logger.error(`Token refresh error: ${data.error || data.error_description}`);
        throw new HttpException(
          `Token refresh failed: ${data.error_description || data.error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return data;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Ensure the connection has a valid access token
   */
  async ensureValidToken(connection: ServiceNowConnection): Promise<string> {
    const expiresIn = connection.tokenExpiresAt
      ? (connection.tokenExpiresAt.getTime() - Date.now()) / 1000
      : 0;

    // Refresh if token expires in less than 5 minutes
    if (expiresIn < 300 && connection.refreshToken) {
      this.logger.log(`Refreshing access token for connection ${connection.id}`);

      const tokenData = await this.refreshAccessToken(
        connection.instanceUrl,
        connection.refreshToken,
      );

      // Update connection with new token
      connection.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        connection.refreshToken = tokenData.refresh_token;
      }
      if (tokenData.expires_in) {
        connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      }

      await this.connectionRepository.save(connection);
      this.logger.log(`Access token refreshed for connection ${connection.id}`);
    }

    return connection.accessToken;
  }

  /**
   * Complete OAuth flow and save connection
   */
  async completeOAuthFlow(
    tenantId: number,
    instanceUrl: string,
    code: string,
    connectionName?: string,
  ): Promise<ServiceNowConnection> {
    // Exchange code for token
    const oauthData = await this.exchangeCodeForToken(instanceUrl, code);

    // Check if connection already exists for this instance
    let connection = await this.connectionRepository.findOne({
      where: {
        tenantId,
        instanceUrl,
      },
    });

    const finalConnectionName = connectionName || `ServiceNow ${instanceUrl}`;

    const connectionData = {
      name: finalConnectionName,
      instanceUrl,
      accessToken: oauthData.access_token,
      refreshToken: oauthData.refresh_token,
      tokenExpiresAt: oauthData.expires_in
        ? new Date(Date.now() + oauthData.expires_in * 1000)
        : undefined,
      oauthMetadata: {
        scope: oauthData.scope,
      },
      isActive: true,
    };

    if (connection) {
      // Update existing connection
      this.logger.log(`Updating existing ServiceNow connection for ${instanceUrl}`);
      Object.assign(connection, connectionData);
    } else {
      // Create new connection
      this.logger.log(`Creating new ServiceNow connection for ${instanceUrl}`);
      connection = this.connectionRepository.create({
        tenantId,
        ...connectionData,
      });
    }

    await this.connectionRepository.save(connection);

    this.logger.log(`ServiceNow OAuth completed for connection ${connection.id}`);
    return connection;
  }

  /**
   * Revoke ServiceNow connection
   */
  async revokeConnection(connectionId: number, tenantId: number): Promise<void> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      throw new HttpException('Connection not found', HttpStatus.NOT_FOUND);
    }

    // ServiceNow OAuth revocation
    try {
      const revokeUrl = `${connection.instanceUrl}/oauth_revoke_token.do`;
      const params = new URLSearchParams({
        token: connection.accessToken,
      });

      await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    } catch (error) {
      this.logger.warn(`Token revocation failed: ${error.message}`);
    }

    // Deactivate the connection
    connection.isActive = false;
    await this.connectionRepository.save(connection);

    this.logger.log(`ServiceNow connection ${connectionId} deactivated`);
  }
}
