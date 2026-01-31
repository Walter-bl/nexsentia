import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('metric_definitions')
@Index(['tenantId', 'metricKey'], { unique: true })
@Index(['tenantId', 'category'])
export class MetricDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({ length: 100, unique: true })
  metricKey: string; // e.g., 'incident_resolution_time', 'team_velocity'

  @Column({ length: 255 })
  name: string; // Human-readable name

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 50 })
  category: string; // 'org_health', 'business_impact', 'productivity', 'quality'

  @Column({ length: 50 })
  dataType: string; // 'number', 'percentage', 'duration', 'currency', 'count'

  @Column({ length: 50 })
  aggregationType: string; // 'sum', 'avg', 'min', 'max', 'count', 'median', 'percentile'

  @Column({ type: 'json' })
  calculation: {
    formula?: string; // e.g., 'total_resolved / total_incidents'
    sourceFields: string[]; // Fields required for calculation
    sourceTypes: string[]; // 'jira', 'slack', 'teams', 'servicenow'
    filters?: Record<string, any>; // Additional filters for data
    customLogic?: string; // Reference to custom calculation method
  };

  @Column({ type: 'json', nullable: true })
  thresholds?: {
    excellent?: { min?: number; max?: number };
    good?: { min?: number; max?: number };
    warning?: { min?: number; max?: number };
    critical?: { min?: number; max?: number };
  };

  @Column({ type: 'json', nullable: true })
  displayConfig?: {
    unit?: string; // '$', '%', 'hrs', 'days'
    decimalPlaces?: number;
    chartType?: string; // 'line', 'bar', 'gauge', 'number'
    color?: string;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isCustom: boolean; // User-defined vs system-defined

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
