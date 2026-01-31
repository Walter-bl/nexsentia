import { IsString, IsOptional, IsNumber, IsObject, Min, Max } from 'class-validator';

export class CreateNodeDto {
  @IsString()
  nodeType: string;

  @IsString()
  externalId: string;

  @IsString()
  sourceSystem: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsObject()
  properties?: any;

  @IsOptional()
  labels?: string[];
}

export class CreateEdgeDto {
  @IsNumber()
  fromNodeId: number;

  @IsNumber()
  toNodeId: number;

  @IsString()
  relationshipType: string;

  @IsOptional()
  @IsObject()
  properties?: any;
}

export class GraphQueryDto {
  @IsOptional()
  @IsString()
  nodeType?: string;

  @IsOptional()
  @IsString()
  relationshipType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  depth?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}
