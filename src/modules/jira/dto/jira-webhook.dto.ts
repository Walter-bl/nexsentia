import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JiraWebhookDto {
  @ApiProperty({ description: 'Webhook event type', example: 'jira:issue_updated' })
  @IsString()
  webhookEvent: string;

  @ApiPropertyOptional({ description: 'Issue event type', example: 'issue_updated' })
  @IsOptional()
  @IsString()
  issue_event_type_name?: string;

  @ApiPropertyOptional({ description: 'User who triggered the event' })
  @IsOptional()
  @IsObject()
  user?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Issue data' })
  @IsOptional()
  @IsObject()
  issue?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Changelog data' })
  @IsOptional()
  @IsObject()
  changelog?: Record<string, any>;

  // Index signature for additional webhook data
  [key: string]: any;
}
