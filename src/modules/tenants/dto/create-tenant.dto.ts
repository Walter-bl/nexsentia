import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  IsObject,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty({ message: 'Tenant name is required' })
  @MinLength(2, { message: 'Tenant name must be at least 2 characters long' })
  @MaxLength(255, { message: 'Tenant name must not exceed 255 characters' })
  name: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @ApiProperty({ example: 'contact@acmecorp.com' })
  @IsEmail({}, { message: 'Please provide a valid contact email' })
  @IsNotEmpty({ message: 'Contact email is required' })
  contactEmail: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({
    example: 'free',
    enum: ['free', 'starter', 'professional', 'enterprise'],
    required: false,
    default: 'free',
  })
  @IsOptional()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'], {
    message: 'Subscription tier must be one of: free, starter, professional, enterprise',
  })
  subscriptionTier?: string;

  @ApiProperty({
    example: '2025-12-31T23:59:59.000Z',
    required: false,
    description: 'Subscription expiration date',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  subscriptionExpiresAt?: Date;

  @ApiProperty({
    example: { theme: 'light', notifications: true },
    required: false,
    description: 'Tenant-specific settings (JSON object)',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
