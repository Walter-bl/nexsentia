import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { GmailConnection } from './gmail-connection.entity';
import { GmailMessage } from './gmail-message.entity';

@Entity('gmail_mailboxes')
@Index(['tenantId', 'connectionId'])
@Index(['labelId'])
export class GmailMailbox extends TenantBaseEntity {
  @Column()
  connectionId: number;

  @Column()
  labelId: string; // Gmail label/folder ID

  @Column()
  labelName: string; // INBOX, SENT, SPAM, etc.

  @Column({ default: 'label' })
  labelType: string; // system, user

  @Column({ type: 'int', default: 0 })
  totalMessages: number;

  @Column({ type: 'int', default: 0 })
  unreadMessages: number;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    color?: string;
    messageListVisibility?: string;
    labelListVisibility?: string;
  };

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Relations
  @ManyToOne(() => GmailConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection: GmailConnection;

  @OneToMany(() => GmailMessage, (message) => message.mailbox)
  messages: GmailMessage[];
}
