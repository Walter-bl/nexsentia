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
import { Tenant } from '../../tenants/entities/tenant.entity';
import { ServiceNowConnection } from './servicenow-connection.entity';

@Entity('servicenow_sync_history')
@Index(['tenantId', 'connectionId'])
@Index(['tenantId', 'status'])
export class ServiceNowSyncHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Multi-tenancy
  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Connection reference
  @Column()
  connectionId: number;

  @ManyToOne(() => ServiceNowConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection: ServiceNowConnection;

  // Sync details
  @Column({ length: 50 })
  syncType: string; // 'full' | 'incremental'

  @Column({ length: 50 })
  status: string; // 'in_progress' | 'completed' | 'failed'

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ default: 0 })
  incidentsProcessed: number;

  @Column({ default: 0 })
  incidentsCreated: number;

  @Column({ default: 0 })
  incidentsUpdated: number;

  @Column({ default: 0 })
  changesProcessed: number;

  @Column({ default: 0 })
  changesCreated: number;

  @Column({ default: 0 })
  changesUpdated: number;

  @Column({ default: 0 })
  usersProcessed: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'json', nullable: true })
  errorDetails?: {
    stack?: string;
    name?: string;
    code?: string;
  };

  // Sync statistics
  @Column({ type: 'json', nullable: true })
  syncStats?: {
    duration?: number; // seconds
    apiCallsCount?: number;
    tables?: string[];
  };
}
