import {
  Controller,
  Get,
  Query,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ServiceNowOAuthService } from '../services/servicenow-oauth.service';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@Controller('servicenow/oauth')
export class ServiceNowOAuthController {
  constructor(private readonly oauthService: ServiceNowOAuthService) {}

  /**
   * Initiate OAuth flow
   * GET /api/v1/servicenow/oauth/authorize?instanceUrl=https://dev12345.service-now.com&tenantId=1&connectionName=My%20Instance
   */
  @Get('authorize')
  @Public()
  async initiateOAuth(
    @Query('instanceUrl') instanceUrl: string,
    @Query('tenantId') queryTenantId?: number,
    @CurrentTenant() currentTenantId?: number,
    @Query('connectionName') connectionName?: string,
    @Query('state') state?: string,
    @Res() res?: Response,
  ) {
    if (!res) {
      throw new Error('Response object is required');
    }

    if (!instanceUrl) {
      return res.status(400).send('instanceUrl parameter is required');
    }

    // Use query param tenantId if provided (for public access), otherwise use authenticated tenant
    const tenantId = queryTenantId || currentTenantId;

    if (!tenantId) {
      return res.status(401).send('Authentication required or tenantId parameter must be provided');
    }

    // Encode state with tenant and connection info
    const stateData = {
      tenantId,
      instanceUrl,
      connectionName: connectionName || `ServiceNow ${instanceUrl}`,
      timestamp: Date.now(),
    };

    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    const authUrl = this.oauthService.generateAuthorizationUrl(
      instanceUrl,
      state || encodedState,
    );

    return res.redirect(authUrl);
  }

  /**
   * OAuth callback
   * GET /api/v1/servicenow/oauth/callback?code=xxx&state=xxx
   */
  @Get('callback')
  @Public()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res?: Response,
  ) {
    if (!res) {
      throw new Error('Response object is required');
    }

    if (!code) {
      return res.status(400).send('Authorization code is required');
    }

    if (!state) {
      return res.status(400).send('Missing state parameter');
    }

    try {
      // Decode state to get tenant and connection info
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));

      // Complete OAuth flow
      const connection = await this.oauthService.completeOAuthFlow(
        stateData.tenantId,
        stateData.instanceUrl,
        code,
        stateData.connectionName,
      );

      return res.send(`
        <html>
          <head>
            <title>ServiceNow Authorization Successful</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f5f5f5;
              }
              .container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .success {
                color: #28a745;
                font-size: 48px;
                margin-bottom: 20px;
              }
              h1 { color: #333; }
              p { color: #666; }
              .connection-id {
                font-weight: bold;
                color: #007bff;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">✓</div>
              <h1>Authorization Successful!</h1>
              <p>Your ServiceNow instance has been connected successfully.</p>
              <p>Connection ID: <span class="connection-id">${connection.id}</span></p>
              <p>Instance: <span class="connection-id">${connection.instanceUrl}</span></p>
              <p style="margin-top: 30px; color: #999;">You can close this window now.</p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      return res.status(500).send(`
        <html>
          <head>
            <title>ServiceNow Authorization Failed</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f5f5f5;
              }
              .container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .error {
                color: #dc3545;
                font-size: 48px;
                margin-bottom: 20px;
              }
              h1 { color: #333; }
              p { color: #666; }
              .error-message {
                color: #dc3545;
                font-family: monospace;
                background: #f8f9fa;
                padding: 10px;
                border-radius: 4px;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">✗</div>
              <h1>Authorization Failed</h1>
              <p>There was an error connecting your ServiceNow instance.</p>
              <div class="error-message">${error.message}</div>
              <p style="margin-top: 30px; color: #999;">Please try again or contact support.</p>
            </div>
          </body>
        </html>
      `);
    }
  }
}
