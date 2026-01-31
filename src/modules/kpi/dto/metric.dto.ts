import { IsString, IsNumber, IsOptional, IsObject, IsBoolean, IsEnum, IsDateString } from 'class-validator';

export class CreateMetricDefinitionDto {
  @IsString()
  metricKey: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category: string;

  @IsString()
  dataType: string;

  @IsString()
  aggregationType: string;

  @IsObject()
  calculation: any;

  @IsOptional()
  @IsObject()
  thresholds?: any;

  @IsOptional()
  @IsObject()
  displayConfig?: any;
}

export class CalculateMetricDto {
  @IsString()
  metricKey: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsEnum(['hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  granularity: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}

export class CreateBusinessImpactDto {
  @IsString()
  sourceType: string;

  @IsString()
  sourceId: string;

  @IsString()
  impactType: string;

  @IsOptional()
  @IsNumber()
  estimatedRevenueLoss?: number;

  @IsOptional()
  @IsNumber()
  customersAffected?: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsDateString()
  impactDate: string;

  @IsString()
  severity: string;

  @IsOptional()
  @IsObject()
  revenueMapping?: any;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class ValidateImpactDto {
  @IsNumber()
  impactId: number;

  @IsBoolean()
  isValid: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  actualRevenueLoss?: number;
}
