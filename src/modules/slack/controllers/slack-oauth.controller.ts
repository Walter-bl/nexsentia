import {
  Controller,
  Get,
  Query,
  Res,
  Logger,
  HttpException,
  HttpStatus,
  Session,
} from '@nestjs/common';
import { Response } from 'express';
import { SlackOAuthService } from '../services/slack-oauth.service';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@Controller('slack/oauth')
export class SlackOAuthController {
  private readonly logger = new Logger(SlackOAuthController.name);

  constructor(private readonly oauthService: SlackOAuthService) {}

  /**
   * Initiate Slack OAuth flow (Public endpoint for testing)
   * GET /api/v1/slack/oauth/authorize?tenantId=1
   */
  @Get('authorize')
  @Public()
  async initiateOAuth(
    @Query('tenantId') queryTenantId?: number,
    @CurrentTenant() currentTenantId?: number,
    @Query('connectionName') connectionName?: string,
    @Query('state') state?: string,
    @Res() res?: Response,
  ) {
    // Use query param tenantId if provided (for public access), otherwise use authenticated tenant
    const tenantId = queryTenantId || currentTenantId;
    try {
      // Encode tenantId and connectionName in state parameter
      const stateData = {
        tenantId,
        connectionName,
        random: state || Math.random().toString(36).substring(7),
      };
      const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

      const authUrl = this.oauthService.generateAuthorizationUrl(encodedState);

      if (res) {
        return res.redirect(authUrl);
      }

      return { authorizationUrl: authUrl };
    } catch (error) {
      this.logger.error(`Failed to initiate OAuth: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to initiate Slack OAuth',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle Slack OAuth callback
   * GET /api/v1/slack/oauth/callback
   */
  @Get('callback')
  @Public()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ) {
    if (error) {
      this.logger.error(`Slack OAuth error: ${error}`);
      return res
        ? res.status(400).send(`OAuth failed: ${error}`)
        : { error: `OAuth failed: ${error}` };
    }

    if (!code) {
      this.logger.error('No authorization code received');
      return res
        ? res.status(400).send('No authorization code received')
        : { error: 'No authorization code received' };
    }

    try {
      let tenantId: number | undefined;
      let connectionName: string | undefined;

      // Decode state parameter to get tenantId and connectionName
      if (state) {
        try {
          const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
          tenantId = decodedState.tenantId;
          connectionName = decodedState.connectionName;
        } catch (e) {
          this.logger.warn(`Failed to decode state parameter: ${e.message}`);
        }
      }

      if (!tenantId) {
        throw new HttpException(
          'Missing tenant information. Please initiate OAuth from the application.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Complete OAuth flow
      const connection = await this.oauthService.completeOAuthFlow(
        tenantId,
        code,
        connectionName,
      );

      this.logger.log(`Slack OAuth completed successfully for connection ${connection.id}`);

      // Redirect to success page or return success response
      if (res) {
        return res.send(`
          <html>
            <head>
              <title>Slack Connected</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 3rem;
                  border-radius: 1rem;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                  text-align: center;
                  max-width: 500px;
                }
                h1 {
                  color: #2d3748;
                  margin-bottom: 1rem;
                  font-size: 2rem;
                }
                p {
                  color: #718096;
                  margin-bottom: 2rem;
                  line-height: 1.6;
                }
                .success-icon {
                  font-size: 4rem;
                  margin-bottom: 1rem;
                }
                .details {
                  background: #f7fafc;
                  padding: 1rem;
                  border-radius: 0.5rem;
                  margin-top: 1.5rem;
                  text-align: left;
                }
                .detail-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 0.5rem 0;
                  border-bottom: 1px solid #e2e8f0;
                }
                .detail-row:last-child {
                  border-bottom: none;
                }
                .detail-label {
                  font-weight: 600;
                  color: #4a5568;
                }
                .detail-value {
                  color: #718096;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="success-icon">✅</div>
                <h1>Slack Connected Successfully!</h1>
                <p>Your Slack workspace has been connected to Nexsentia. You can now close this window and return to the application.</p>
                <div class="details">
                  <div class="detail-row">
                    <span class="detail-label">Workspace:</span>
                    <span class="detail-value">${connection.teamName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Connection ID:</span>
                    <span class="detail-value">${connection.id}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">Active</span>
                  </div>
                </div>
              </div>
              <script>
                // Auto-close after 5 seconds
                setTimeout(() => {
                  window.close();
                }, 5000);
              </script>
            </body>
          </html>
        `);
      }

      return {
        success: true,
        connection: {
          id: connection.id,
          name: connection.name,
          teamName: connection.teamName,
          isActive: connection.isActive,
        },
      };
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error.message}`, error.stack);

      if (res) {
        return res.status(500).send(`
          <html>
            <head>
              <title>Connection Failed</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                }
                .container {
                  background: white;
                  padding: 3rem;
                  border-radius: 1rem;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                  text-align: center;
                  max-width: 500px;
                }
                h1 {
                  color: #e53e3e;
                  margin-bottom: 1rem;
                }
                p {
                  color: #718096;
                }
                .error-icon {
                  font-size: 4rem;
                  margin-bottom: 1rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error-icon">❌</div>
                <h1>Connection Failed</h1>
                <p>${error.message}</p>
                <p style="margin-top: 1rem; font-size: 0.9rem;">Please try again or contact support if the problem persists.</p>
              </div>
            </body>
          </html>
        `);
      }

      throw error;
    }
  }
}
