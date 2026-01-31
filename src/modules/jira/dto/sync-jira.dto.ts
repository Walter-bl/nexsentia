import { IsEnum, IsOptional, IsArray, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncJiraDto {
  @ApiProperty({ description: 'Sync type', enum: ['full', 'incremental'], example: 'incremental' })
  @IsEnum(['full', 'incremental'])
  syncType: string;

  @ApiPropertyOptional({ description: 'Specific project keys to sync', example: ['PROJ1', 'PROJ2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectKeys?: string[];

  @ApiPropertyOptional({ description: 'Force resync even if recently synced', example: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
