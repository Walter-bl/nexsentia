import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { GmailMailbox } from './gmail-mailbox.entity';

@Entity('gmail_messages')
@Index(['tenantId', 'mailboxId'])
@Index(['gmailMessageId'])
@Index(['gmailThreadId'])
@Index(['fromEmail'])
@Index(['subject'])
@Index(['gmailCreatedAt'])
export class GmailMessage extends TenantBaseEntity {
  @Column()
  mailboxId: number;

  @Column({ unique: true })
  gmailMessageId: string; // Gmail's unique message ID

  @Column()
  gmailThreadId: string; // Gmail thread ID

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'longtext', nullable: true })
  bodyText?: string;

  @Column({ type: 'longtext', nullable: true })
  bodyHtml?: string;

  @Column({ type: 'text', nullable: true })
  snippet?: string; // Short preview of message

  @Column()
  fromEmail: string;

  @Column({ nullable: true })
  fromName?: string;

  @Column({ type: 'json', nullable: true })
  toRecipients?: Array<{ email: string; name?: string }>;

  @Column({ type: 'json', nullable: true })
  ccRecipients?: Array<{ email: string; name?: string }>;

  @Column({ type: 'json', nullable: true })
  bccRecipients?: Array<{ email: string; name?: string }>;

  @Column({ type: 'json' })
  labels: string[]; // Gmail labels applied to this message

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isStarred: boolean;

  @Column({ default: false })
  isImportant: boolean;

  @Column({ default: false })
  isDraft: boolean;

  @Column({ default: false })
  isSent: boolean;

  @Column({ default: false })
  isTrash: boolean;

  @Column({ default: false })
  isSpam: boolean;

  @Column({ default: false })
  hasAttachment: boolean;

  @Column({ type: 'json', nullable: true })
  attachments?: Array<{
    partId: string;
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;

  @Column({ type: 'int', nullable: true })
  sizeBytes?: number;

  @Column({ type: 'json', nullable: true })
  headers?: Record<string, string>;

  @Column({ type: 'json', nullable: true })
  references?: string[]; // Message-ID references for threading

  @Column({ nullable: true })
  inReplyTo?: string; // Message-ID this is replying to

  @Column({ type: 'timestamp' })
  gmailCreatedAt: Date; // Internal date from Gmail

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    historyId?: string;
    internalDate?: string;
    sentiment?: {
      score?: number;
      magnitude?: number;
      label?: string;
    };
    entities?: Array<{
      type: string;
      value: string;
    }>;
    priority?: 'urgent' | 'high' | 'normal' | 'low';
    category?: string;
  };

  // Relations
  @ManyToOne(() => GmailMailbox, (mailbox) => mailbox.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mailboxId' })
  mailbox: GmailMailbox;
}
