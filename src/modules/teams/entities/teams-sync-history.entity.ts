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
import { TeamsConnection } from './teams-connection.entity';

@Entity('teams_sync_history')
@Index(['tenantId'])
@Index(['connectionId'])
@Index(['status'])
@Index(['startedAt'])
export class TeamsSyncHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  connectionId: number;

  @ManyToOne(() => TeamsConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection: TeamsConnection;

  // Sync type: full, incremental
  @Column({ length: 50 })
  syncType: string;

  // Sync status: in_progress, completed, failed, partial
  @Column({ length: 50 })
  status: string;

  // Sync statistics
  @Column({ type: 'json', nullable: true })
  stats?: {
    teamsProcessed?: number;
    channelsProcessed?: number;
    messagesCreated?: number;
    messagesUpdated?: number;
    usersCreated?: number;
    usersUpdated?: number;
    apiCallsCount?: number;
  };

  // Team IDs processed
  @Column({ type: 'json', nullable: true })
  teamIds?: string[];

  // Error details (if failed)
  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'json', nullable: true })
  errorDetails?: any;

  // Sync duration in seconds
  @Column({ type: 'float', nullable: true })
  duration?: number;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
