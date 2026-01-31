import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('business_impacts')
@Index(['tenantId', 'sourceType', 'sourceId'])
@Index(['tenantId', 'impactDate'])
export class BusinessImpact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({ length: 50 })
  sourceType: string; // 'jira', 'slack', 'servicenow', 'teams'

  @Column({ length: 255 })
  sourceId: string; // External ID from source system

  @Column({ length: 100 })
  impactType: string; // 'incident', 'outage', 'bug', 'feature_delay', 'customer_churn'

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  estimatedRevenueLoss?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  actualRevenueLoss?: number;

  @Column({ type: 'int', nullable: true })
  customersAffected?: number;

  @Column({ type: 'int', nullable: true })
  usersAffected?: number;

  @Column({ type: 'int', nullable: true })
  durationMinutes?: number;

  @Column({ type: 'timestamp' })
  impactDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedDate?: Date;

  @Column({ length: 50 })
  severity: string; // 'low', 'medium', 'high', 'critical'

  @Column({ type: 'json', nullable: true })
  revenueMapping?: {
    affectedServices?: string[];
    revenuePerHour?: number;
    recurringRevenueImpact?: number;
    oneTimeRevenueLoss?: number;
    methodology?: string; // How loss was calculated
  };

  @Column({ type: 'json', nullable: true })
  lossEstimation?: {
    directCosts?: number;
    indirectCosts?: number;
    opportunityCost?: number;
    reputationImpact?: number; // Estimated value
    calculationMethod?: string;
    confidence?: number; // 0-1
  };

  @Column({ type: 'json', nullable: true })
  metadata?: {
    priority?: string;
    assignee?: string;
    team?: string;
    tags?: string[];
    relatedIncidents?: string[];
    rootCause?: string;
  };

  @Column({ default: false })
  isValidated: boolean;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt?: Date;

  @Column({ nullable: true })
  validatedBy?: number; // User ID

  @Column({ type: 'text', nullable: true })
  validationNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
