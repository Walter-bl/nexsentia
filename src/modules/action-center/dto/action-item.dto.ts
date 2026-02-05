import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActionItemDto {
  @ApiProperty({ description: 'Action item title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'], default: 'medium' })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Source type' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Source ID' })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Metadata JSON' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'AI analysis JSON' })
  @IsOptional()
  aiAnalysis?: any;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsOptional()
  @IsNumber()
  assignedToId?: number;

  @ApiPropertyOptional({ description: 'Assigned user name' })
  @IsOptional()
  @IsString()
  assignedToName?: string;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateActionItemDto {
  @ApiPropertyOptional({ description: 'Action item title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'done', 'cancelled'] })
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'done', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsOptional()
  @IsNumber()
  assignedToId?: number;

  @ApiPropertyOptional({ description: 'Assigned user name' })
  @IsOptional()
  @IsString()
  assignedToName?: string;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsOptional()
  @IsString()
  completionNotes?: string;
}

export class ActionItemQueryDto {
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

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'done', 'cancelled'] })
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'done', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: string;

  @ApiPropertyOptional({ description: 'Category filter' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsOptional()
  @IsNumber()
  assignedToId?: number;

  @ApiPropertyOptional({ description: 'Source type filter' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;
}
