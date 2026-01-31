import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryJiraConnectionDto {
  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by Jira type', enum: ['cloud', 'server', 'datacenter'] })
  @IsOptional()
  @IsEnum(['cloud', 'server', 'datacenter'])
  jiraType?: string;
}
