import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('slack_connections')
export class SlackConnection {
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

  // Connection details
  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  teamId: string;

  @Column({ length: 255 })
  teamName: string;

  @Column({ length: 500, nullable: true })
  teamDomain?: string;

  @Column({ length: 500, nullable: true })
  teamIcon?: string;

  // OAuth tokens
  @Column({ type: 'text' })
  accessToken: string;

  @Column({ length: 50 })
  tokenType: string; // 'bot' or 'user'

  @Column({ type: 'text' })
  scope: string;

  @Column({ length: 255 })
  botUserId: string;

  @Column({ length: 255, nullable: true })
  installingUserId?: string;

  // OAuth metadata
  @Column({ type: 'json', nullable: true })
  oauthMetadata?: {
    appId?: string;
    authedUser?: {
      id: string;
      scope?: string;
      accessToken?: string;
      tokenType?: string;
    };
    enterpriseId?: string;
    enterpriseName?: string;
    isEnterpriseInstall?: boolean;
    incomingWebhook?: {
      channel?: string;
      channelId?: string;
      configurationUrl?: string;
      url?: string;
    };
  };

  // Connection status
  @Column({ default: true })
  isActive: boolean;

  // Sync settings
  @Column({ type: 'json', nullable: true })
  syncSettings?: {
    syncInterval?: number; // in minutes
    channelFilter?: string[]; // specific channel IDs to sync
    excludeChannels?: string[]; // channels to exclude
    syncDirectMessages?: boolean;
    syncThreads?: boolean;
    syncReactions?: boolean;
    syncFiles?: boolean;
    userFilter?: string[]; // specific user IDs
    messageRetentionDays?: number;
  };

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessfulSyncAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastSyncError?: string;

  @Column({ default: 0 })
  totalMessagesSynced: number;

  @Column({ default: 0 })
  failedSyncAttempts: number;
}
