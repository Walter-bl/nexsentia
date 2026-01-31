import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { TeamsMessageService, TeamsMessageFilters } from '../services/teams-message.service';
import { TeamsMessage } from '../entities/teams-message.entity';

@Controller('teams/messages')
@UseGuards(JwtAuthGuard)
export class TeamsMessageController {
  constructor(private readonly messageService: TeamsMessageService) {}

  /**
   * Get messages with filters
   * GET /teams/messages?channelId=1&limit=100
   */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query('channelId') channelId?: string,
    @Query('userId') userId?: string,
    @Query('teamId') teamId?: string,
    @Query('teamsChannelId') teamsChannelId?: string,
    @Query('teamsUserId') teamsUserId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('messageType') messageType?: string,
    @Query('hasReactions') hasReactions?: string,
    @Query('isDeleted') isDeleted?: string,
    @Query('replyToId') replyToId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<TeamsMessage[]> {
    const filters: TeamsMessageFilters = {};

    if (channelId) filters.channelId = parseInt(channelId, 10);
    if (userId) filters.userId = parseInt(userId, 10);
    if (teamId) filters.teamId = teamId;
    if (teamsChannelId) filters.teamsChannelId = teamsChannelId;
    if (teamsUserId) filters.teamsUserId = teamsUserId;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (messageType) filters.messageType = messageType;
    if (hasReactions) filters.hasReactions = hasReactions === 'true';
    if (isDeleted) filters.isDeleted = isDeleted === 'true';
    if (replyToId) filters.replyToId = replyToId;

    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.messageService.findAll(tenantId, filters, limitNum, offsetNum);
  }

  /**
   * Get a specific message
   * GET /teams/messages/:id
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ): Promise<TeamsMessage> {
    return this.messageService.findOne(id, tenantId);
  }

  /**
   * Get thread messages (replies)
   * GET /teams/messages/thread/:messageId
   */
  @Get('thread/:messageId')
  async getThreadMessages(
    @Param('messageId') messageId: string,
    @CurrentTenant() tenantId: number,
  ): Promise<TeamsMessage[]> {
    return this.messageService.getThreadMessages(messageId, tenantId);
  }

  /**
   * Search messages by content
   * GET /teams/messages/search?q=keyword&limit=50
   */
  @Get('search')
  async search(
    @CurrentTenant() tenantId: number,
    @Query('q') searchText: string,
    @Query('channelId') channelId?: string,
    @Query('userId') userId?: string,
    @Query('teamId') teamId?: string,
    @Query('isDeleted') isDeleted?: string,
    @Query('limit') limit?: string,
  ): Promise<TeamsMessage[]> {
    if (!searchText) {
      return [];
    }

    const filters: TeamsMessageFilters = {};
    if (channelId) filters.channelId = parseInt(channelId, 10);
    if (userId) filters.userId = parseInt(userId, 10);
    if (teamId) filters.teamId = teamId;
    if (isDeleted) filters.isDeleted = isDeleted === 'true';

    const limitNum = limit ? parseInt(limit, 10) : 50;

    return this.messageService.search(tenantId, searchText, filters, limitNum);
  }

  /**
   * Get messages with reactions
   * GET /teams/messages/reactions?limit=50
   */
  @Get('reactions')
  async getMessagesWithReactions(
    @CurrentTenant() tenantId: number,
    @Query('limit') limit?: string,
  ): Promise<TeamsMessage[]> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.messageService.getMessagesWithReactions(tenantId, limitNum);
  }

  /**
   * Get message statistics
   * GET /teams/messages/stats?teamId=xxx
   */
  @Get('stats')
  async getStatistics(
    @CurrentTenant() tenantId: number,
    @Query('teamId') teamId?: string,
  ): Promise<any> {
    return this.messageService.getStatistics(tenantId, teamId);
  }
}
