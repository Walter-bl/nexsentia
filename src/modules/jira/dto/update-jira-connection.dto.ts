import { IsString, IsBoolean, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class SyncSettingsDto {
  @ApiPropertyOptional({ description: 'Sync interval in minutes', example: 15 })
  @IsOptional()
  @IsNumber()
  syncInterval?: number;

  @ApiPropertyOptional({ description: 'Enable automatic synchronization', example: true })
  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @ApiPropertyOptional({ description: 'Filter by project keys', example: ['PROJ1', 'PROJ2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectFilter?: string[];

  @ApiPropertyOptional({ description: 'Filter by issue types', example: ['Story', 'Bug'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  issueTypeFilter?: string[];

  @ApiPropertyOptional({ description: 'Filter by status', example: ['To Do', 'In Progress'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statusFilter?: string[];

  @ApiPropertyOptional({ description: 'Sync issue comments', example: true })
  @IsOptional()
  @IsBoolean()
  syncComments?: boolean;

  @ApiPropertyOptional({ description: 'Sync issue attachments', example: false })
  @IsOptional()
  @IsBoolean()
  syncAttachments?: boolean;

  @ApiPropertyOptional({ description: 'Sync work logs', example: false })
  @IsOptional()
  @IsBoolean()
  syncWorkLogs?: boolean;
}

export class UpdateJiraConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name', example: 'Main Jira Instance' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sync settings', type: SyncSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SyncSettingsDto)
  syncSettings?: SyncSettingsDto;
}
