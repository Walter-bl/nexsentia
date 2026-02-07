import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SignalType = 'pattern_recurring' | 'trend_acceleration' | 'anomaly_detection' | 'correlation_cluster';
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SignalStatus = 'new' | 'investigating' | 'validated' | 'dismissed' | 'escalated';

@Entity('weak_signals')
@Index(['tenantId', 'status', 'detectedAt'])
@Index(['tenantId', 'signalType', 'severity'])
export class WeakSignal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  signalType: SignalType;

  @Column({
    type: 'varchar',
    length: 255,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  severity: SignalSeverity;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    comment: 'Confidence score 0-100',
  })
  confidenceScore: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'new',
  })
  status: SignalStatus;

  @Column({
    type: 'json',
    comment: 'Source signals that contributed to this weak signal',
  })
  sourceSignals: {
    source: string; // jira, servicenow, slack, teams, kpi
    sourceId: string;
    timestamp: string;
    relevanceScore: number;
  }[];

  @Column({
    type: 'json',
    comment: 'Pattern data for recurring signals',
    nullable: true,
  })
  patternData: {
    occurrences: number;
    frequency: string; // daily, weekly, monthly
    lastOccurrence: string;
    predictedNext: string | null;
    similarities: string[];
  } | null;

  @Column({
    type: 'json',
    comment: 'Trend data for acceleration detection',
    nullable: true,
  })
  trendData: {
    metric: string;
    baseline: number;
    current: number;
    changeRate: number; // percentage
    accelerationFactor: number;
    timeWindow: string;
  } | null;

  @Column({
    type: 'json',
    comment: 'Explainability metadata - why this signal was detected',
  })
  explainability: {
    primaryReason: string;
    contributingFactors: string[];
    evidencePoints: {
      description: string;
      weight: number;
      source: string;
    }[];
    riskIndicators: string[];
    contextualFactors: string[];
  };

  @Column({
    type: 'json',
    comment: 'Affected systems and entities',
  })
  affectedEntities: {
    type: string; // project, team, service, infrastructure
    id: string;
    name: string;
    impactLevel: string;
  }[];

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  category: string | null;

  @Column({
    type: 'json',
    comment: 'Additional metadata',
    nullable: true,
  })
  metadata: Record<string, any> | null;

  @Column({
    type: 'timestamp',
    comment: 'When the signal was first detected',
  })
  @Index()
  detectedAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When the signal was validated by a user or system',
  })
  validatedAt: Date | null;

  @Column({
    type: 'integer',
    nullable: true,
    comment: 'User who validated this signal',
  })
  validatedBy: number | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When the signal was escalated',
  })
  escalatedAt: Date | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Notes from investigation',
  })
  investigationNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
