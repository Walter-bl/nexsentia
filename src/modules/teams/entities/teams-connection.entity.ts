import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../../modules/tenants/entities/tenant.entity';

@Entity('teams_connections')
@Index(['tenantId'])
@Index(['tenantId', 'teamId'], { unique: true })
export class TeamsConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ length: 255, nullable: true })
  name?: string;

  // Microsoft 365 Tenant/Organization ID
  @Column({ length: 255, unique: true })
  tenantIdMs: string;

  // Microsoft Graph API Access Token (encrypted)
  @Column({ type: 'text' })
  accessToken: string;

  // Refresh token for token renewal
  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  // Token expiration timestamp
  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date;

  // Microsoft Teams Team ID (if specific team)
  @Column({ length: 255, nullable: true })
  teamId?: string;

  // Team name
  @Column({ length: 500, nullable: true })
  teamName?: string;

  // OAuth metadata
  @Column({ type: 'json', nullable: true })
  oauthMetadata?: {
    scope?: string;
    grantedScopes?: string[];
    userId?: string;
    userDisplayName?: string;
    userEmail?: string;
  };

  // Sync settings
  @Column({ type: 'json', nullable: true })
  syncSettings?: {
    autoSync?: boolean;
    syncInterval?: number; // in minutes
    syncChannels?: boolean;
    syncMessages?: boolean;
    syncFiles?: boolean;
    channelFilter?: string[]; // specific channel IDs to sync
  };

  // Connection status
  @Column({ default: true })
  isActive: boolean;

  // Last sync metadata
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessfulSyncAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastSyncError?: string;

  // Sync statistics
  @Column({ type: 'json', nullable: true })
  syncStats?: {
    totalChannels?: number;
    totalMessages?: number;
    totalUsers?: number;
    lastSyncDuration?: number; // in seconds
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
