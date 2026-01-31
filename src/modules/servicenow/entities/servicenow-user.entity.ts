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
import { ServiceNowConnection } from './servicenow-connection.entity';

@Entity('servicenow_users')
@Index(['tenantId', 'connectionId', 'sysId'], { unique: true })
@Index(['tenantId', 'userName'])
@Index(['tenantId', 'email'])
export class ServiceNowUser {
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

  @ManyToOne(() => ServiceNowConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection: ServiceNowConnection;

  // ServiceNow user details
  @Column({ length: 255, unique: true })
  sysId: string;

  @Column({ length: 255 })
  userName: string;

  @Column({ length: 255, nullable: true })
  firstName?: string;

  @Column({ length: 255, nullable: true })
  lastName?: string;

  @Column({ length: 255, nullable: true })
  email?: string;

  @Column({ length: 255, nullable: true })
  title?: string;

  @Column({ length: 255, nullable: true })
  department?: string;

  @Column({ length: 255, nullable: true })
  manager?: string; // Manager sys_id

  @Column({ length: 255, nullable: true })
  managerName?: string;

  @Column({ length: 50, nullable: true })
  phone?: string;

  @Column({ length: 50, nullable: true })
  mobilePhone?: string;

  @Column({ length: 255, nullable: true })
  location?: string;

  @Column({ length: 255, nullable: true })
  company?: string;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  isAdmin: boolean;

  // Timestamps from ServiceNow
  @Column({ type: 'timestamp', nullable: true })
  sysCreatedOn?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sysUpdatedOn?: Date;

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    roles?: string[];
    groups?: string[];
    timeZone?: string;
    dateFormat?: string;
    customFields?: Record<string, any>;
  };
}
