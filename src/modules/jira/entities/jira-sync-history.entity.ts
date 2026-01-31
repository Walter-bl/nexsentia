import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { JiraConnection } from './jira-connection.entity';

@Entity('jira_sync_history')
@Index(['tenantId', 'connectionId'])
@Index(['status'])
@Index(['syncType'])
@Index(['createdAt'])
export class JiraSyncHistory extends TenantBaseEntity {
  @Column({ type: 'int' })
  connectionId: number;

  @Column({
    type: 'enum',
    enum: ['full', 'incremental', 'webhook'],
    default: 'incremental',
  })
  syncType: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', default: 0 })
  projectsProcessed: number;

  @Column({ type: 'int', default: 0 })
  issuesCreated: number;

  @Column({ type: 'int', default: 0 })
  issuesUpdated: number;

  @Column({ type: 'int', default: 0 })
  issuesFailed: number;

  @Column({ type: 'int', default: 0 })
  totalIssuesProcessed: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'json', nullable: true })
  errorDetails?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  syncStats?: {
    duration?: number; // in seconds
    apiCallsCount?: number;
    dataVolume?: number; // in bytes
    projectKeys?: string[];
    issueTypes?: Record<string, number>;
    statuses?: Record<string, number>;
  };

  // Relations
  @ManyToOne(() => JiraConnection, (connection) => connection.syncHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'connectionId' })
  connection: JiraConnection;
}
