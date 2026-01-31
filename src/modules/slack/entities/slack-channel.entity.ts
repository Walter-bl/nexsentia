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

@Entity('slack_channels')
@Index(['tenantId', 'connectionId', 'slackChannelId'], { unique: true })
export class SlackChannel {
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

  // Channel details from Slack
  @Column({ length: 255 })
  slackChannelId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  topic?: string;

  @Column({ type: 'text', nullable: true })
  purpose?: string;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ default: false })
  isGeneral: boolean;

  @Column({ default: 0 })
  memberCount: number;

  // Channel creator
  @Column({ length: 255, nullable: true })
  creatorId?: string;

  // Timestamps from Slack
  @Column({ type: 'timestamp', nullable: true })
  slackCreatedAt?: Date;

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ default: 0 })
  totalMessages: number;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    isDirectMessage?: boolean;
    isMultiPartyDM?: boolean;
    dmUserId?: string;
    locale?: string;
    sharedTeamIds?: string[];
    pendingShared?: string[];
    previousNames?: string[];
    properties?: Record<string, any>;
  };

  @Column({ default: true })
  isActive: boolean;
}
