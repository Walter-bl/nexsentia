import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MetricDefinition } from './metric-definition.entity';

@Entity('metric_values')
@Index(['tenantId', 'metricDefinitionId', 'periodStart', 'periodEnd'])
@Index(['tenantId', 'periodStart'])
export class MetricValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column()
  metricDefinitionId: number;

  @ManyToOne(() => MetricDefinition)
  @JoinColumn({ name: 'metricDefinitionId' })
  metricDefinition: MetricDefinition;

  @Column({ type: 'decimal', precision: 20, scale: 4 })
  value: number;

  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @Column({ length: 50 })
  granularity: string; // 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'

  @Column({ type: 'json', nullable: true })
  breakdown?: {
    byTeam?: Record<string, number>;
    byProject?: Record<string, number>;
    byUser?: Record<string, number>;
    byPriority?: Record<string, number>;
    bySource?: Record<string, number>;
  };

  @Column({ type: 'json', nullable: true })
  metadata?: {
    dataPoints?: number; // Number of records used in calculation
    confidence?: number; // Confidence score (0-1)
    sources?: string[]; // Source systems used
    calculatedAt?: Date;
    calculationDuration?: number; // ms
    warnings?: string[];
  };

  @Column({ type: 'json', nullable: true })
  comparisonData?: {
    previousPeriod?: number;
    changePercent?: number;
    trend?: 'up' | 'down' | 'stable';
    movingAverage?: number;
  };

  @CreateDateColumn()
  createdAt: Date;
}
