import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';

@Entity('outlook_connections')
@Index(['tenantId'])
@Index(['email'])
export class OutlookConnection extends TenantBaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  accessToken?: string;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date;

  @Column({ nullable: true })
  userId?: string; // Microsoft Graph user ID

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  scopes?: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ type: 'json', nullable: true })
  syncState?: {
    deltaToken?: string;
    skipToken?: string;
    lastMessageId?: string;
  };

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;
}
