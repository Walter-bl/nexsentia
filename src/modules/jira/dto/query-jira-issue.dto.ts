import { IsOptional, IsString, IsArray, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryJiraIssueDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @ApiPropertyOptional({ description: 'Filter by issue type', example: 'Story' })
  @IsOptional()
  @IsString()
  issueType?: string;

  @ApiPropertyOptional({ description: 'Filter by status', example: 'In Progress' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by priority', example: 'High' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Filter by assignee account ID' })
  @IsOptional()
  @IsString()
  assigneeAccountId?: string;

  @ApiPropertyOptional({ description: 'Filter by reporter account ID' })
  @IsOptional()
  @IsString()
  reporterAccountId?: string;

  @ApiPropertyOptional({ description: 'Filter by labels', example: ['backend', 'urgent'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiPropertyOptional({ description: 'Search in summary and description', example: 'login bug' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date for filtering (ISO 8601)', example: '2024-01-01T00:00:00Z' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering (ISO 8601)', example: '2024-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  toDate?: string;
}
