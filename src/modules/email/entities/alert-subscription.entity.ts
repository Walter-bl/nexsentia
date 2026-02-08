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
import { AlertRule } from './alert-rule.entity';

@Entity('alert_subscriptions')
@Index(['tenantId', 'userId', 'isActive'])
@Index(['ruleId', 'isActive'])
export class AlertSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  ruleId?: number;

  @ManyToOne(() => AlertRule, { nullable: true })
  @JoinColumn({ name: 'ruleId' })
  rule?: AlertRule;

  // Delivery preferences for this subscription
  @Column({ type: 'json' })
  channels: {
    email?: {
      enabled: boolean;
      address?: string; // Override user's default email
    };
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      channel?: string;
    };
  };

  // Notification preferences
  @Column({ type: 'json', nullable: true })
  preferences?: {
    quietHours?: {
      enabled: boolean;
      startHour: number; // 0-23
      endHour: number; // 0-23
      timezone?: string;
    };
    digestMode?: {
      enabled: boolean;
      frequency: 'hourly' | 'daily' | 'weekly';
      preferredTime?: string; // HH:mm format
    };
    severityFilter?: ('critical' | 'high' | 'medium' | 'low')[];
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Subscription metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    subscribedVia?: 'manual' | 'auto' | 'admin';
    tags?: string[];
  };
}
