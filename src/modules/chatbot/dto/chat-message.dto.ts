import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageHistoryDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsString()
  role: 'user' | 'assistant' | 'system';

  @ApiProperty()
  @IsString()
  content: string;
}

export class ChatMessageDto {
  @ApiProperty({ description: 'User message to send to the chatbot' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Conversation history for context', type: [MessageHistoryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageHistoryDto)
  conversationHistory?: MessageHistoryDto[];

  @ApiPropertyOptional({ description: 'Session ID for maintaining conversation context' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class ChatResponseDto {
  @ApiProperty()
  response: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty({ description: 'Data sources used to generate the response' })
  sources: {
    signals?: number;
    incidents?: number;
    issues?: number;
    metrics?: number;
  };

  @ApiProperty()
  timestamp: Date;
}

/**
 * Server-Sent Events (SSE) Stream Event Types
 *
 * The streaming endpoint sends different event types:
 *
 * 1. metadata: { type: 'metadata', sessionId: string, sources: {...} }
 *    - Sent first with session and source information
 *
 * 2. token: { type: 'token', content: string }
 *    - Sent for each token/word as it's generated
 *
 * 3. done: { type: 'done' }
 *    - Sent when streaming is complete
 */
export interface StreamEvent {
  type: 'metadata' | 'token' | 'done';
  content?: string;
  sessionId?: string;
  sources?: {
    signals?: number;
    incidents?: number;
    issues?: number;
    metrics?: number;
  };
}
