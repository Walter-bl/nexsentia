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

@Entity('teams_channels')
@Index(['tenantId'])
@Index(['tenantId', 'connectionId', 'channelId'], { unique: true })
@Index(['channelId'])
export class TeamsChannel {
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

  // Microsoft Teams Channel ID
  @Column({ length: 255 })
  channelId: string;

  // Teams Team ID
  @Column({ length: 255 })
  teamId: string;

  // Channel name
  @Column({ length: 500 })
  displayName: string;

  // Channel description
  @Column({ type: 'text', nullable: true })
  description?: string;

  // Channel email (if available)
  @Column({ length: 500, nullable: true })
  email?: string;

  // Channel web URL
  @Column({ type: 'text', nullable: true })
  webUrl?: string;

  // Membership type: standard, private, shared
  @Column({ length: 50, nullable: true })
  membershipType?: string;

  // Channel metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    isFavoriteByDefault?: boolean;
    createdDateTime?: string;
    tenantId?: string;
  };

  // Is this channel archived?
  @Column({ default: false })
  isArchived: boolean;

  // Last message timestamp in this channel
  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt?: Date;

  // Message count (if available)
  @Column({ type: 'int', nullable: true })
  messageCount?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
