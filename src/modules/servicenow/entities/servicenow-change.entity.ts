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

@Entity('servicenow_changes')
@Index(['tenantId', 'connectionId', 'sysId'], { unique: true })
@Index(['tenantId', 'number'])
@Index(['tenantId', 'assignedTo'])
@Index(['tenantId', 'state'])
export class ServiceNowChange {
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

  // ServiceNow change request details
  @Column({ length: 255, unique: true })
  sysId: string;

  @Column({ length: 100 })
  number: string; // CHG0001234

  @Column({ type: 'text', nullable: true })
  shortDescription?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 50, nullable: true })
  state?: string;

  @Column({ type: 'int', nullable: true })
  stateValue?: number;

  @Column({ length: 50, nullable: true })
  type?: string; // Standard, Normal, Emergency

  @Column({ length: 50, nullable: true })
  risk?: string; // High, Medium, Low

  @Column({ type: 'int', nullable: true })
  riskValue?: number;

  @Column({ length: 50, nullable: true })
  impact?: string;

  @Column({ type: 'int', nullable: true })
  impactValue?: number;

  @Column({ length: 255, nullable: true })
  assignedTo?: string;

  @Column({ length: 255, nullable: true })
  assignedToName?: string;

  @Column({ length: 255, nullable: true })
  assignmentGroup?: string;

  @Column({ length: 255, nullable: true })
  assignmentGroupName?: string;

  @Column({ length: 255, nullable: true })
  requestedBy?: string;

  @Column({ length: 255, nullable: true })
  requestedByName?: string;

  @Column({ length: 255, nullable: true })
  category?: string;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  plannedStartDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  plannedEndDate?: Date;

  @Column({ type: 'text', nullable: true })
  implementationPlan?: string;

  @Column({ type: 'text', nullable: true })
  backoutPlan?: string;

  @Column({ type: 'text', nullable: true })
  testPlan?: string;

  @Column({ type: 'text', nullable: true })
  justification?: string;

  @Column({ type: 'text', nullable: true })
  workNotes?: string;

  @Column({ type: 'text', nullable: true })
  closeNotes?: string;

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
    approvalStatus?: string;
    conflictStatus?: string;
    cabRequired?: boolean;
    onHold?: boolean;
    customFields?: Record<string, any>;
  };
}
