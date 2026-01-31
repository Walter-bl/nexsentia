import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('kpi_snapshots')
@Index(['tenantId', 'snapshotDate'])
@Index(['tenantId', 'category'])
export class KpiSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({ type: 'timestamp' })
  snapshotDate: Date;

  @Column({ length: 50 })
  category: string; // 'org_health', 'business_impact', 'productivity', 'quality'

  @Column({ type: 'json' })
  metrics: Record<string, {
    value: number;
    trend?: 'up' | 'down' | 'stable';
    changePercent?: number;
    status?: 'excellent' | 'good' | 'warning' | 'critical';
  }>;

  @Column({ type: 'json', nullable: true })
  summary?: {
    totalMetrics?: number;
    excellentCount?: number;
    goodCount?: number;
    warningCount?: number;
    criticalCount?: number;
    overallHealth?: number; // 0-100
  };

  @Column({ type: 'json', nullable: true })
  metadata?: {
    calculationDuration?: number;
    dataQuality?: number;
    missingData?: string[];
    notes?: string;
  };

  @CreateDateColumn()
  createdAt: Date;
}
