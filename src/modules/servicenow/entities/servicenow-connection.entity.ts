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

@Entity('servicenow_connections')
@Index(['tenantId', 'instanceUrl'], { unique: true })
export class ServiceNowConnection {
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

  @Column({ length: 500 })
  instanceUrl: string; // e.g., https://dev12345.service-now.com

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date;

  @Column({ length: 255, nullable: true })
  instanceId?: string;

  // OAuth metadata
  @Column({ type: 'json', nullable: true })
  oauthMetadata?: {
    scope?: string;
    grantedScopes?: string[];
    userId?: string;
    userName?: string;
    userEmail?: string;
  };

  // Sync settings
  @Column({ type: 'json', nullable: true })
  syncSettings?: {
    syncInterval?: number; // minutes
    syncTables?: string[]; // incident, change_request, problem, etc.
    filters?: Record<string, any>;
    lastSyncCursor?: Record<string, string>;
  };

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessfulSyncAt?: Date;

  @Column({ default: 0 })
  totalIncidentsSynced: number;

  @Column({ default: 0 })
  totalChangesSynced: number;

  @Column({ type: 'text', nullable: true })
  lastSyncError?: string;

  @Column({ default: 0 })
  failedSyncAttempts: number;

  @Column({ default: true })
  isActive: boolean;
}
