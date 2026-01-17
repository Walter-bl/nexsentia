import { IsEnum, IsString, IsOptional, IsInt, IsObject, IsNumber } from 'class-validator';
import { AuditAction } from '../../../common/enums';

export class CreateAuditLogDto {
  @IsInt()
  tenantId: number;

  @IsInt()
  @IsOptional()
  userId?: number;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  resource: string;

  @IsInt()
  @IsOptional()
  resourceId?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsObject()
  @IsOptional()
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  httpMethod?: string;

  @IsString()
  @IsOptional()
  requestPath?: string;

  @IsNumber()
  @IsOptional()
  statusCode?: number;

  @IsString()
  @IsOptional()
  errorMessage?: string;
}
