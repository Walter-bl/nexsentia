import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { OutlookConnection } from './outlook-connection.entity';
import { OutlookMessage } from './outlook-message.entity';

@Entity('outlook_mailboxes')
@Index(['tenantId', 'connectionId'])
@Index(['folderId'])
export class OutlookMailbox extends TenantBaseEntity {
  @Column()
  connectionId: number;

  @Column()
  folderId: string; // Outlook folder ID

  @Column()
  folderName: string; // Inbox, Sent Items, Deleted Items, etc.

  @Column({ nullable: true })
  parentFolderId?: string;

  @Column({ default: 'mail' })
  folderType: string; // mail, contacts, calendar, etc.

  @Column({ type: 'int', default: 0 })
  totalMessages: number;

  @Column({ type: 'int', default: 0 })
  unreadMessages: number;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    displayName?: string;
    childFolderCount?: number;
  };

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Relations
  @ManyToOne(() => OutlookConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection: OutlookConnection;

  @OneToMany(() => OutlookMessage, (message) => message.mailbox)
  messages: OutlookMessage[];
}
