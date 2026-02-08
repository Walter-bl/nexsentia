import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

@Entity('alert_rules')
@Index(['tenantId', 'isActive'])
export class AlertRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Rule identification
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Rule type: threshold, topic, pattern, anomaly
  @Column()
  ruleType: 'threshold' | 'topic' | 'pattern' | 'anomaly';

  // What to monitor: weak_signal, metric, incident, action_item
  @Column()
  sourceType: 'weak_signal' | 'metric' | 'incident' | 'action_item' | 'timeline_event';

  // Threshold-based rules
  @Column({ type: 'json', nullable: true })
  thresholdConfig?: {
    metric?: string; // e.g., 'incident_count', 'resolution_time', 'signal_severity'
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    timeWindow?: number; // in minutes
    aggregation?: 'count' | 'avg' | 'sum' | 'min' | 'max';
  };

  // Topic-based rules
  @Column({ type: 'json', nullable: true })
  topicConfig?: {
    topics: string[]; // e.g., ['security', 'performance', 'deployment']
    matchType: 'any' | 'all'; // match any topic or all topics
    severityLevels?: ('critical' | 'high' | 'medium' | 'low')[]; // filter by severity
  };

  // Pattern-based rules
  @Column({ type: 'json', nullable: true })
  patternConfig?: {
    keywords: string[]; // keywords to match in content
    matchType: 'any' | 'all';
    caseSensitive?: boolean;
    includeDescription?: boolean;
  };

  // Anomaly detection rules
  @Column({ type: 'json', nullable: true })
  anomalyConfig?: {
    metric: string;
    deviationThreshold: number; // standard deviations from mean
    baselinePeriod: number; // days to calculate baseline
    minDataPoints?: number;
  };

  // Severity mapping
  @Column({ default: 'medium' })
  alertSeverity: 'critical' | 'high' | 'medium' | 'low';

  // Delivery preferences
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json' })
  deliveryChannels: ('email' | 'slack')[]; // Future: 'teams', 'webhook'

  // Rate limiting per rule
  @Column({ type: 'int', default: 60 })
  cooldownMinutes: number; // Min time between alerts for this rule

  // Created by
  @Column({ nullable: true })
  createdBy?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  creator?: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Additional metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    tags?: string[];
    team?: string;
    priority?: number;
    customData?: Record<string, any>;
  };
}
