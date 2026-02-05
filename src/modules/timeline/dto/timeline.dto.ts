import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTimelineEventDto {
  @ApiProperty({ description: 'Event title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Event date' })
  @IsDateString()
  eventDate: string;

  @ApiProperty({ enum: ['high', 'medium', 'low'], description: 'Impact level' })
  @IsEnum(['high', 'medium', 'low'])
  impactLevel: string;

  @ApiProperty({ description: 'Event category' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ description: 'Source system type' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Source system ID' })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Event metadata' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'AI analysis data' })
  @IsOptional()
  aiAnalysis?: any;
}

export class UpdateTimelineEventDto {
  @ApiPropertyOptional({ description: 'Event title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Is resolved' })
  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class TimelineQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'], description: 'Filter by impact level' })
  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  impactLevel?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by resolved status' })
  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
