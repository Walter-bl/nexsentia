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

@Entity('slack_users')
@Index(['tenantId', 'connectionId', 'slackUserId'], { unique: true })
export class SlackUser {
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

  // User details from Slack
  @Column({ length: 255 })
  slackUserId: string;

  @Column({ length: 255, nullable: true })
  teamId?: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, nullable: true })
  realName?: string;

  @Column({ length: 255, nullable: true })
  displayName?: string;

  @Column({ length: 500, nullable: true })
  email?: string;

  @Column({ length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ length: 100, nullable: true })
  statusText?: string;

  @Column({ length: 100, nullable: true })
  statusEmoji?: string;

  @Column({ length: 100, nullable: true })
  title?: string;

  @Column({ length: 100, nullable: true })
  timezone?: string;

  @Column({ type: 'int', nullable: true })
  timezoneOffset?: number;

  // User status
  @Column({ default: false })
  isBot: boolean;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ default: false })
  isOwner: boolean;

  @Column({ default: false })
  isPrimaryOwner: boolean;

  @Column({ default: false })
  isRestricted: boolean;

  @Column({ default: false })
  isUltraRestricted: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  // Timestamps from Slack
  @Column({ type: 'timestamp', nullable: true })
  slackUpdatedAt?: Date;

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    phone?: string;
    skype?: string;
    fields?: Record<string, any>;
    locale?: string;
  };
}
