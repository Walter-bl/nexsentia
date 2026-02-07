import { IsOptional, IsNumber, IsEnum, Min, Max, IsString } from 'class-validator';
import { HypothesisStatus, HypothesisType } from '../entities/hypothesis.entity';

export class GenerateHypothesesDto {
  @IsNumber()
  weakSignalId: number;
}

export class GetHypothesesQueryDto {
  @IsOptional()
  @IsNumber()
  weakSignalId?: number;

  @IsOptional()
  @IsEnum(['generated', 'investigating', 'validated', 'refuted', 'inconclusive'])
  status?: HypothesisStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minConfidence?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class UpdateHypothesisStatusDto {
  @IsEnum(['generated', 'investigating', 'validated', 'refuted', 'inconclusive'])
  status: HypothesisStatus;

  @IsOptional()
  @IsString()
  validationNotes?: string;

  @IsOptional()
  validationResults?: {
    outcome: 'confirmed' | 'partial' | 'refuted';
    evidence: string[];
    updatedConfidence: number;
    notes: string;
  };
}

export class HypothesisResponseDto {
  id: number;
  hypothesisType: HypothesisType;
  hypothesis: string;
  confidence: number;
  status: HypothesisStatus;
  generatedAt: Date;
  weakSignalId: number | null;
  context: any;
  reasoning: any;
  supportingEvidence: any[];
  contradictingEvidence: any[] | null;
  guardrails: any;
  validationSteps: any[];
  predictedImpact: any;
}
