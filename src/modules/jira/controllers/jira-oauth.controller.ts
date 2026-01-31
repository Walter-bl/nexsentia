import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Redirect,
  Session,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JiraOAuthService } from '../services/jira-oauth.service';
import { JiraConnectionService } from '../services/jira-connection.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { UserRole } from '../../../common/enums';
import { InitiateOAuthDto, OAuthCallbackDto } from '../dto/jira-oauth-config.dto';

@ApiTags('Jira OAuth')
@Controller('jira/oauth')
export class JiraOAuthController {
  private readonly logger = new Logger(JiraOAuthController.name);

  constructor(
    private readonly oauthService: JiraOAuthService,
    private readonly connectionService: JiraConnectionService,
  ) {}

  @Get('authorize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Initiate OAuth authorization flow',
    description: 'Start OAuth flow. If connectionName is not provided, the Jira workspace name will be used automatically.'
  })
  @ApiQuery({ name: 'connectionName', description: 'Optional custom name for the connection', required: false })
  @ApiQuery({ name: 'state', description: 'State parameter for security', required: false })
  @ApiResponse({ status: 200, description: 'Authorization URL generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async initiateOAuth(
    @CurrentTenant() tenantId: number,
    @Query('connectionName') connectionName?: string,
    @Query('state') state?: string,
    @Session() session?: any,
  ) {
    // Encode tenantId and connectionName in state parameter
    const stateData = {
      tenantId,
      connectionName,
      random: state || Math.random().toString(36).substring(7),
    };

    // Base64 encode the state to include tenantId
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Store in session as backup (if available)
    if (session) {
      session.jiraOAuthState = encodedState;
      session.jiraOAuthTenantId = tenantId;
      if (connectionName) {
        session.jiraOAuthConnectionName = connectionName;
      }
    }

    const authorizationUrl = this.oauthService.generateAuthorizationUrl(encodedState);

    return {
      authorizationUrl,
      state: encodedState,
      message: connectionName
        ? `Redirect user to authorizationUrl. Connection will be named: "${connectionName}"`
        : 'Redirect user to authorizationUrl. Connection will use Jira workspace name.',
    };
  }

  @Get('callback')
  @Public()
  @ApiOperation({
    summary: 'OAuth callback endpoint (public)',
    description: 'Automatically completes OAuth flow after Atlassian redirects here with authorization code.'
  })
  @ApiQuery({ name: 'code', description: 'Authorization code from Jira', required: true })
  @ApiQuery({ name: 'state', description: 'State parameter for validation', required: false })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID (optional, retrieved from session if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'OAuth connection created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid authorization code or missing tenantId' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
    @Query('tenantId') tenantIdParam?: string,
    @Session() session?: any,
  ) {
    let tenantId: number | undefined;
    let connectionName: string | undefined;

    // Try to decode state parameter to get tenantId and connectionName
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        tenantId = decodedState.tenantId;
        connectionName = decodedState.connectionName;

        // Validate state against session (if available)
        if (session?.jiraOAuthState && state !== session.jiraOAuthState) {
          return {
            success: false,
            message: 'Invalid state parameter. Possible CSRF attack.',
          };
        }
      } catch (error) {
        // If state decoding fails, fall back to session or query param
        this.logger.warn('Failed to decode state parameter', error.message);
      }
    }

    // Fallback to query param or session if state decoding failed
    if (!tenantId) {
      tenantId = tenantIdParam
        ? parseInt(tenantIdParam, 10)
        : session?.jiraOAuthTenantId;
    }

    // Fallback to session for connectionName if not in state
    if (!connectionName && session?.jiraOAuthConnectionName) {
      connectionName = session.jiraOAuthConnectionName;
    }

    // If no tenantId available, return code for manual completion
    if (!tenantId) {
      return {
        success: true,
        code,
        state,
        message: 'Authorization successful. Use the code with POST /jira/oauth/complete to finish setup.',
        note: 'Auto-completion skipped: tenantId not available. Please complete manually.',
      };
    }

    try {
      // Automatically complete the OAuth flow
      const connection = await this.oauthService.completeOAuthFlow(
        tenantId,
        code,
        connectionName,
      );

      // Clear session data
      if (session) {
        delete session.jiraOAuthConnectionName;
        delete session.jiraOAuthState;
        delete session.jiraOAuthTenantId;
      }

      return {
        success: true,
        connection: {
          id: connection.id,
          name: connection.name,
          jiraInstanceUrl: connection.jiraInstanceUrl,
          jiraCloudId: connection.oauthMetadata.cloudId,
          workspaceName: connection.oauthMetadata.workspaceName,
          isActive: connection.isActive,
          user: connection.oauthMetadata,
        },
        message: connectionName
          ? `OAuth connection created successfully as "${connection.name}"`
          : `OAuth connection created successfully using workspace name: "${connection.name}"`,
      };
    } catch (error) {
      // If auto-completion fails, return code for manual completion
      return {
        success: false,
        code,
        state,
        error: error.message,
        message: 'Auto-completion failed. Use the code with POST /jira/oauth/complete to finish setup manually.',
      };
    }
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Complete OAuth flow and create connection',
    description: 'Complete the OAuth flow. If connectionName is not provided, the Jira workspace name will be used automatically.'
  })
  @ApiResponse({ status: 201, description: 'OAuth connection created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid authorization code' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async completeOAuth(
    @CurrentTenant() tenantId: number,
    @Body() dto: OAuthCallbackDto & { connectionName?: string },
  ) {
    const connection = await this.oauthService.completeOAuthFlow(
      tenantId,
      dto.code,
      dto.connectionName,
    );

    return {
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        jiraInstanceUrl: connection.jiraInstanceUrl,
        jiraCloudId: connection.oauthMetadata.cloudId,
        workspaceName: connection.oauthMetadata.workspaceName,
        isActive: connection.isActive,
        user: connection.oauthMetadata,
      },
      message: dto.connectionName
        ? `OAuth connection created successfully as "${connection.name}"`
        : `OAuth connection created successfully using workspace name: "${connection.name}"`,
    };
  }

  @Post(':id/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Manually refresh OAuth token' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async refreshToken(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const connection = await this.connectionService.findOne(tenantId, id);
    const refreshedConnection = await this.oauthService.refreshTokenIfNeeded(connection);

    return {
      success: true,
      expiresAt: refreshedConnection.oauthTokenExpiresAt,
      message: 'Token refreshed successfully',
    };
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Revoke OAuth access and disconnect' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'OAuth access revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async revokeAccess(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const connection = await this.connectionService.findOne(tenantId, id);

    await this.oauthService.revokeAccess(connection);

    return {
      success: true,
      message: 'OAuth access revoked successfully',
    };
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.ANALYST)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get OAuth token status' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({ status: 200, description: 'OAuth status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async getOAuthStatus(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const connection = await this.connectionService.findOne(tenantId, id);

    const now = new Date();
    const expiresAt = new Date(connection.oauthTokenExpiresAt);
    const isExpired = expiresAt <= now;
    const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60);

    return {
      authType: 'oauth',
      isOAuth: true,
      tokenExpiresAt: connection.oauthTokenExpiresAt,
      isExpired,
      expiresInMinutes: isExpired ? 0 : expiresInMinutes,
      hasRefreshToken: !!connection.oauthRefreshToken,
      scope: connection.oauthScope,
      user: connection.oauthMetadata,
    };
  }
}
