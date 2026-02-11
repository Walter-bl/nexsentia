import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ChatbotService } from '../services/chatbot.service';
import { ChatMessageDto, ChatResponseDto } from '../dto/chat-message.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators';
import { JwtPayload } from '../../../common/interfaces';

@ApiTags('Chatbot')
@Controller('chatbot')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI chatbot' })
  @ApiResponse({
    status: 200,
    description: 'AI response generated successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Failed to generate response' })
  async chat(@CurrentUser() user: JwtPayload, @Body() chatDto: ChatMessageDto): Promise<ChatResponseDto> {
    return await this.chatbotService.chat(user.tenantId, user.sub, chatDto);
  }

  @Post('chat-stream')
  @Sse()
  @ApiOperation({ summary: 'Stream AI chatbot responses in real-time using Server-Sent Events' })
  @ApiResponse({ status: 200, description: 'Streaming response' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Failed to generate streaming response' })
  async chatStream(@CurrentUser() user: JwtPayload, @Body() chatDto: ChatMessageDto): Promise<Observable<MessageEvent>> {
    return new Observable((subscriber) => {
      this.chatbotService
        .chatStream(
          user.tenantId,
          user.sub,
          chatDto,
          // onToken callback
          (token: string) => {
            subscriber.next({
              data: { type: 'token', content: token },
            } as MessageEvent);
          },
          // onMetadata callback
          (metadata: { sessionId: string; sources: any }) => {
            subscriber.next({
              data: { type: 'metadata', ...metadata },
            } as MessageEvent);
          },
        )
        .then(() => {
          subscriber.next({
            data: { type: 'done' },
          } as MessageEvent);
          subscriber.complete();
        })
        .catch((error) => {
          subscriber.error(error);
        });
    });
  }

  @Get('conversation/:sessionId')
  @ApiOperation({ summary: 'Get conversation history by session ID' })
  @ApiResponse({ status: 200, description: 'Conversation history retrieved' })
  async getConversationHistory(@CurrentUser() user: JwtPayload, @Param('sessionId') sessionId: string) {
    return await this.chatbotService.getConversationHistory(user.tenantId, sessionId);
  }

  @Delete('conversation/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation session' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  async deleteConversation(@CurrentUser() user: JwtPayload, @Param('sessionId') sessionId: string): Promise<void> {
    await this.chatbotService.deleteConversation(user.tenantId, sessionId);
  }
}
