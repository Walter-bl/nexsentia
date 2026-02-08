import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { AlertRule } from './alert-rule.entity';

@Entity('alert_history')
@Index(['tenantId', 'createdAt'])
@Index(['ruleId', 'createdAt'])
@Index(['userId', 'status'])
export class AlertHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  ruleId: number;

  @ManyToOne(() => AlertRule)
  @JoinColumn({ name: 'ruleId' })
  rule: AlertRule;

  @Column({ nullable: true })
  userId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  // Alert details
  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column()
  severity: 'critical' | 'high' | 'medium' | 'low';

  // Source information
  @Column()
  sourceType: string; // 'weak_signal', 'metric', 'incident', etc.

  @Column({ nullable: true })
  sourceId?: string;

  @Column({ type: 'json', nullable: true })
  sourceData?: Record<string, any>;

  // Delivery tracking
  @Column({ type: 'json' })
  deliveryChannels: string[]; // ['email', 'slack']

  @Column()
  status: 'pending' | 'sent' | 'failed' | 'suppressed';

  @Column({ type: 'json', nullable: true })
  deliveryStatus?: {
    email?: {
      sent: boolean;
      sentAt?: Date;
      error?: string;
      messageId?: string;
    };
    slack?: {
      sent: boolean;
      sentAt?: Date;
      error?: string;
      messageTs?: string;
    };
  };

  // Rate limiting tracking
  @Column({ type: 'timestamp', nullable: true })
  suppressedUntil?: Date;

  @Column({ type: 'text', nullable: true })
  suppressionReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    ruleVersion?: number;
    matchedConditions?: string[];
    contextData?: Record<string, any>;
  };
}
