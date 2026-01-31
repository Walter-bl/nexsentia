import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlackConnection } from '../entities/slack-connection.entity';

@Injectable()
export class SlackOAuthService {
  private readonly logger = new Logger(SlackOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    @InjectRepository(SlackConnection)
    private readonly connectionRepository: Repository<SlackConnection>,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('SLACK_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('SLACK_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('SLACK_REDIRECT_URI') || '';
  }

  /**
   * Generate Slack OAuth authorization URL
   */
  generateAuthorizationUrl(state?: string): string {
    const scopes = [
      'channels:history',
      'channels:read',
      'channels:join',
      'chat:write',
      'groups:history',
      'groups:read',
      'im:history',
      'im:read',
      'mpim:history',
      'mpim:read',
      'reactions:read',
      'team:read',
      'users:read',
      'users:read.email',
      'files:read',
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: scopes.join(','),
      redirect_uri: this.redirectUri,
      ...(state && { state }),
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<any> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!data.ok) {
      this.logger.error(`Slack OAuth error: ${data.error}`);
      throw new HttpException(
        `Slack OAuth failed: ${data.error}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return data;
  }

  /**
   * Complete OAuth flow and save connection
   */
  async completeOAuthFlow(
    tenantId: number,
    code: string,
    connectionName?: string,
  ): Promise<SlackConnection> {
    // Exchange code for token
    const oauthData = await this.exchangeCodeForToken(code);

    // Check if connection already exists for this team
    let connection = await this.connectionRepository.findOne({
      where: {
        tenantId,
        teamId: oauthData.team.id,
      },
    });

    const finalConnectionName =
      connectionName || oauthData.team.name || 'Slack Workspace';

    const connectionData = {
      name: finalConnectionName,
      teamId: oauthData.team.id,
      teamName: oauthData.team.name,
      accessToken: oauthData.access_token,
      tokenType: 'bot',
      scope: oauthData.scope,
      botUserId: oauthData.bot_user_id,
      installingUserId: oauthData.authed_user?.id,
      oauthMetadata: {
        appId: oauthData.app_id,
        authedUser: oauthData.authed_user,
        enterpriseId: oauthData.enterprise?.id,
        enterpriseName: oauthData.enterprise?.name,
        isEnterpriseInstall: oauthData.is_enterprise_install,
        incomingWebhook: oauthData.incoming_webhook,
      },
      isActive: true,
    };

    if (connection) {
      // Update existing connection
      this.logger.log(`Updating existing Slack connection for team ${oauthData.team.id}`);
      Object.assign(connection, connectionData);
    } else {
      // Create new connection
      this.logger.log(`Creating new Slack connection for team ${oauthData.team.id}`);
      connection = this.connectionRepository.create({
        tenantId,
        ...connectionData,
      });
    }

    await this.connectionRepository.save(connection);

    this.logger.log(`Slack OAuth completed for connection ${connection.id}`);
    return connection;
  }

  /**
   * Revoke Slack connection (optional - Slack doesn't require explicit revocation)
   */
  async revokeConnection(connectionId: number, tenantId: number): Promise<void> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      throw new HttpException('Connection not found', HttpStatus.NOT_FOUND);
    }

    // Slack doesn't provide a token revocation endpoint
    // So we just deactivate the connection
    connection.isActive = false;
    await this.connectionRepository.save(connection);

    this.logger.log(`Slack connection ${connectionId} deactivated`);
  }
}
