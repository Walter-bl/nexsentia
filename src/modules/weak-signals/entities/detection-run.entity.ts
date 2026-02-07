import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type DetectionRunStatus = 'running' | 'completed' | 'failed';

@Entity('weak_signal_detection_runs')
@Index(['tenantId', 'status', 'startedAt'])
@Index(['tenantId', 'completedAt'])
export class DetectionRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'running',
  })
  status: DetectionRunStatus;

  @Column({
    type: 'timestamp',
  })
  @Index()
  startedAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  completedAt: Date | null;

  @Column({
    type: 'integer',
    default: 0,
  })
  signalsDetected: number;

  @Column({
    type: 'integer',
    default: 0,
  })
  hypothesesGenerated: number;

  @Column({
    type: 'integer',
    comment: 'Number of days analyzed backwards from startedAt',
  })
  daysAnalyzed: number;

  @Column({
    type: 'json',
    comment: 'Breakdown of signals by type and severity',
  })
  detectionSummary: {
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
  };

  @Column({
    type: 'text',
    nullable: true,
  })
  errorMessage: string | null;

  @Column({
    type: 'integer',
    comment: 'Duration in milliseconds',
    nullable: true,
  })
  durationMs: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
