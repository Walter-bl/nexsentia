import { Controller, Get, Query, Res, Logger, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TeamsOAuthService } from '../services/teams-oauth.service';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('teams/oauth')
export class TeamsOAuthController {
  private readonly logger = new Logger(TeamsOAuthController.name);

  constructor(private readonly oauthService: TeamsOAuthService) {}

  /**
   * Initiate Microsoft Teams OAuth flow
   * GET /teams/oauth/authorize
   */
  @Get('authorize')
  @UseGuards(JwtAuthGuard)
  async initiateOAuth(
    @CurrentTenant() tenantId: number,
    @Query('connectionName') connectionName?: string,
    @Res() res?: Response,
  ) {
    if (!res) {
      throw new Error('Response object is required');
    }

    try {
      // Encode tenant info and connection name in state parameter
      const stateData = {
        tenantId,
        connectionName,
        random: Math.random().toString(36).substring(7),
      };
      const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

      // Generate Microsoft authorization URL
      const authUrl = this.oauthService.generateAuthorizationUrl(encodedState);

      this.logger.log(`Initiating Teams OAuth for tenant ${tenantId}`);

      return res.redirect(authUrl);
    } catch (error: any) {
      this.logger.error('Failed to initiate OAuth', error);
      return res.status(500).json({
        error: 'Failed to initiate OAuth',
        message: error.message,
      });
    }
  }

  /**
   * Handle Microsoft OAuth callback
   * GET /teams/oauth/callback
   */
  @Get('callback')
  @Public()
  async handleCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Res() res?: Response,
  ) {
    if (!res) {
      throw new Error('Response object is required');
    }

    try {
      // Handle OAuth errors
      if (error) {
        this.logger.error(`OAuth error: ${error} - ${errorDescription}`);
        return res.send(`
          <html>
            <head><title>Teams OAuth Error</title></head>
            <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
              <h1 style="color: #d32f2f;">❌ OAuth Error</h1>
              <p><strong>Error:</strong> ${error}</p>
              <p>${errorDescription || ''}</p>
              <p><a href="/">Return to app</a></p>
            </body>
          </html>
        `);
      }

      if (!code) {
        return res.status(400).send('Missing authorization code');
      }

      if (!state) {
        return res.status(400).send('Missing state parameter');
      }

      // Decode state to get tenant info
      let decodedState: any;
      try {
        decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      } catch (e) {
        this.logger.error('Failed to decode state parameter', e);
        return res.status(400).send('Invalid state parameter');
      }

      const { tenantId, connectionName } = decodedState;

      // Complete OAuth flow
      this.logger.log(`Completing Teams OAuth for tenant ${tenantId}`);
      const connection = await this.oauthService.completeOAuthFlow(
        tenantId,
        code,
        connectionName,
      );

      // Return success page
      return res.send(`
        <html>
          <head><title>Teams Connected</title></head>
          <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
            <h1 style="color: #4caf50;">✅ Microsoft Teams Connected!</h1>
            <p>Your Teams workspace has been successfully connected.</p>
            <p><strong>Connection:</strong> ${connection.name}</p>
            <p><strong>Team:</strong> ${connection.teamName || 'N/A'}</p>
            <p>You can now close this window and return to the application.</p>
            <script>
              // Auto-close after 3 seconds
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      this.logger.error('OAuth callback failed', error);
      return res.status(500).send(`
        <html>
          <head><title>Teams OAuth Error</title></head>
          <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
            <h1 style="color: #d32f2f;">❌ Connection Failed</h1>
            <p>Failed to connect Microsoft Teams workspace.</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <p><a href="/">Return to app</a></p>
          </body>
        </html>
      `);
    }
  }
}
