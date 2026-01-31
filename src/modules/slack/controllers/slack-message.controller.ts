import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { SlackMessageService } from '../services/slack-message.service';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

@Controller('slack/messages')
export class SlackMessageController {
  constructor(private readonly messageService: SlackMessageService) {}

  /**
   * Get all messages with optional filters
   * GET /api/v1/slack/messages
   */
  @Get()
  findAll(
    @CurrentTenant() tenantId: number,
    @Query('channelId') channelId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('hasReactions') hasReactions?: string,
    @Query('isThread') isThread?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters = {
      channelId: channelId ? parseInt(channelId) : undefined,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      hasReactions: hasReactions === 'true',
      isThread: isThread ? isThread === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };

    return this.messageService.findAll(tenantId, filters);
  }

  /**
   * Get a single message
   * GET /api/v1/slack/messages/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ) {
    return this.messageService.findOne(id, tenantId);
  }

  /**
   * Get thread replies for a message
   * GET /api/v1/slack/messages/thread/:messageTs
   */
  @Get('thread/:messageTs')
  getThreadReplies(
    @Param('messageTs') messageTs: string,
    @CurrentTenant() tenantId: number,
  ) {
    return this.messageService.getThreadReplies(messageTs, tenantId);
  }

  /**
   * Search messages by text
   * GET /api/v1/slack/messages/search
   */
  @Get('search')
  search(
    @CurrentTenant() tenantId: number,
    @Query('q') searchText: string,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters = {
      channelId: channelId ? parseInt(channelId) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };

    return this.messageService.search(tenantId, searchText, filters);
  }
}
