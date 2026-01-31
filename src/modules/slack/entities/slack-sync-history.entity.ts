import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { SlackConnection } from './slack-connection.entity';

@Entity('slack_sync_history')
@Index(['tenantId', 'connectionId'])
@Index(['status'])
@Index(['startedAt'])
export class SlackSyncHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // Multi-tenancy
  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Connection reference
  @Column()
  connectionId: number;

  @ManyToOne(() => SlackConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection: SlackConnection;

  // Sync details
  @Column({ length: 50 })
  syncType: string; // 'full' | 'incremental'

  @Column({ length: 50 })
  status: string; // 'in_progress' | 'completed' | 'failed'

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  // Sync statistics
  @Column({ type: 'int', default: 0 })
  channelsProcessed: number;

  @Column({ type: 'int', default: 0 })
  messagesCreated: number;

  @Column({ type: 'int', default: 0 })
  messagesUpdated: number;

  @Column({ type: 'int', default: 0 })
  messagesFailed: number;

  @Column({ type: 'int', default: 0 })
  totalMessagesProcessed: number;

  @Column({ type: 'int', default: 0 })
  usersProcessed: number;

  // Error tracking
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'json', nullable: true })
  errorDetails?: {
    stack?: string;
    name?: string;
    code?: string;
  };

  // Additional statistics
  @Column({ type: 'json', nullable: true })
  syncStats?: {
    duration?: number; // in seconds
    apiCallsCount?: number;
    channelIds?: string[];
    messageRate?: number; // messages per second
    rateLimitHits?: number;
  };
}
