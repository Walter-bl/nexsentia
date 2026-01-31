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

@Entity('teams_users')
@Index(['tenantId'])
@Index(['tenantId', 'connectionId', 'userId'], { unique: true })
@Index(['userId'])
export class TeamsUser {
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

  // Microsoft User ID (Azure AD Object ID)
  @Column({ length: 255 })
  userId: string;

  // User Principal Name (email)
  @Column({ length: 500, nullable: true })
  userPrincipalName?: string;

  // Display name
  @Column({ length: 500 })
  displayName: string;

  // Email
  @Column({ length: 500, nullable: true })
  email?: string;

  // Job title
  @Column({ length: 500, nullable: true })
  jobTitle?: string;

  // Department
  @Column({ length: 500, nullable: true })
  department?: string;

  // Office location
  @Column({ length: 500, nullable: true })
  officeLocation?: string;

  // Mobile phone
  @Column({ length: 100, nullable: true })
  mobilePhone?: string;

  // Business phones
  @Column({ type: 'json', nullable: true })
  businessPhones?: string[];

  // Profile metadata
  @Column({ type: 'json', nullable: true })
  profile?: {
    givenName?: string;
    surname?: string;
    preferredLanguage?: string;
    country?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    accountEnabled?: boolean;
  };

  // User roles
  @Column({ type: 'json', nullable: true })
  roles?: string[];

  // Is the user a guest?
  @Column({ default: false })
  isGuest: boolean;

  // Is the user deleted/deactivated?
  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
