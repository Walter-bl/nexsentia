import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Tenant ID (optional for multi-tenant setup)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Please provide a valid tenant ID' })
  tenantId?: number;
}
