import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';

@Entity('gmail_connections')
@Index(['tenantId'])
@Index(['email'])
export class GmailConnection extends TenantBaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  accessToken?: string;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date;

  @Column({ nullable: true })
  userId?: string; // Gmail user ID

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  scopes?: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ type: 'json', nullable: true })
  syncState?: {
    historyId?: string;
    pageToken?: string;
    lastMessageId?: string;
  };

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;
}
