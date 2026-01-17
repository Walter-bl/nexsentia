import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'SecureP@ssw0rd123' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Tenant ID for multi-tenant login',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Please provide a valid tenant ID' })
  tenantId?: number;
}
