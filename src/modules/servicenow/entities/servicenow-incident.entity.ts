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

@Entity('servicenow_incidents')
@Index(['tenantId', 'connectionId', 'sysId'], { unique: true })
@Index(['tenantId', 'number'])
@Index(['tenantId', 'assignedTo'])
@Index(['tenantId', 'state'])
@Index(['tenantId', 'priority'])
export class ServiceNowIncident {
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

  // ServiceNow incident details
  @Column({ length: 255, unique: true })
  sysId: string; // ServiceNow sys_id

  @Column({ length: 100 })
  number: string; // INC0001234

  @Column({ type: 'text', nullable: true })
  shortDescription?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 50, nullable: true })
  state?: string; // New, In Progress, Resolved, Closed

  @Column({ type: 'int', nullable: true })
  stateValue?: number;

  @Column({ length: 50, nullable: true })
  priority?: string; // 1-Critical, 2-High, 3-Moderate, 4-Low, 5-Planning

  @Column({ type: 'int', nullable: true })
  priorityValue?: number;

  @Column({ length: 50, nullable: true })
  impact?: string; // 1-High, 2-Medium, 3-Low

  @Column({ type: 'int', nullable: true })
  impactValue?: number;

  @Column({ length: 50, nullable: true })
  urgency?: string; // 1-High, 2-Medium, 3-Low

  @Column({ type: 'int', nullable: true })
  urgencyValue?: number;

  @Column({ length: 255, nullable: true })
  assignedTo?: string; // User sys_id

  @Column({ length: 255, nullable: true })
  assignedToName?: string;

  @Column({ length: 255, nullable: true })
  assignmentGroup?: string; // Group sys_id

  @Column({ length: 255, nullable: true })
  assignmentGroupName?: string;

  @Column({ length: 255, nullable: true })
  caller?: string; // User sys_id

  @Column({ length: 255, nullable: true })
  callerName?: string;

  @Column({ length: 255, nullable: true })
  category?: string;

  @Column({ length: 255, nullable: true })
  subcategory?: string;

  @Column({ length: 255, nullable: true })
  configurationItem?: string; // CI sys_id

  @Column({ length: 255, nullable: true })
  configurationItemName?: string;

  @Column({ type: 'timestamp', nullable: true })
  openedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @Column({ type: 'text', nullable: true })
  resolutionCode?: string;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ type: 'text', nullable: true })
  closeNotes?: string;

  @Column({ type: 'text', nullable: true })
  workNotes?: string;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  // Timestamps from ServiceNow
  @Column({ type: 'timestamp', nullable: true })
  sysCreatedOn?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sysUpdatedOn?: Date;

  @Column({ length: 255, nullable: true })
  sysCreatedBy?: string;

  @Column({ length: 255, nullable: true })
  sysUpdatedBy?: string;

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    location?: string;
    businessService?: string;
    company?: string;
    contactType?: string;
    reopenCount?: number;
    holdReason?: string;
    customFields?: Record<string, any>;
  };
}
