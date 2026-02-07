import { IsOptional, IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { SignalType, SignalSeverity, SignalStatus } from '../entities/weak-signal.entity';

export class DetectWeakSignalsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  daysBack?: number = 90;
}

export class GetWeakSignalsQueryDto {
  @IsOptional()
  @IsEnum(['pattern_recurring', 'trend_acceleration', 'anomaly_detection', 'correlation_cluster'])
  signalType?: SignalType;

  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low'])
  severity?: SignalSeverity;

  @IsOptional()
  @IsEnum(['new', 'investigating', 'validated', 'dismissed', 'escalated'])
  status?: SignalStatus;

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

export class UpdateWeakSignalStatusDto {
  @IsEnum(['new', 'investigating', 'validated', 'dismissed', 'escalated'])
  status: SignalStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WeakSignalResponseDto {
  id: number;
  signalType: SignalType;
  title: string;
  description: string;
  severity: SignalSeverity;
  confidenceScore: number;
  status: SignalStatus;
  detectedAt: Date;
  category: string | null;
  affectedEntities: any[];
  explainability: any;
  patternData: any;
  trendData: any;
  sourceSignals: any[];
  metadata: any;
}

export class WeakSignalStatisticsDto {
  total: number;
  byType: Record<SignalType, number>;
  bySeverity: Record<SignalSeverity, number>;
  byStatus: Record<string, number>;
  avgConfidence: number;
  recentSignals: number;
}
