import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { OutlookMailbox } from './outlook-mailbox.entity';

@Entity('outlook_messages')
@Index(['tenantId', 'mailboxId'])
@Index(['outlookMessageId'])
@Index(['conversationId'])
@Index(['fromEmail'])
@Index(['subject'])
@Index(['outlookCreatedAt'])
export class OutlookMessage extends TenantBaseEntity {
  @Column()
  mailboxId: number;

  @Column({ unique: true })
  outlookMessageId: string; // Microsoft Graph message ID

  @Column()
  conversationId: string; // Conversation/thread ID

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'longtext', nullable: true })
  bodyText?: string;

  @Column({ type: 'longtext', nullable: true })
  bodyHtml?: string;

  @Column({ type: 'text', nullable: true })
  bodyPreview?: string; // Short preview of message

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

  @Column({ type: 'json', nullable: true })
  replyTo?: Array<{ email: string; name?: string }>;

  @Column({ type: 'json', nullable: true })
  categories?: string[]; // Outlook categories

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isFlagged: boolean;

  @Column({ default: false })
  isImportant: boolean; // High importance

  @Column({ default: false })
  isDraft: boolean;

  @Column({ type: 'varchar', default: 'normal' })
  importance: string; // low, normal, high

  @Column({ default: false })
  hasAttachment: boolean;

  @Column({ type: 'json', nullable: true })
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    isInline: boolean;
    contentId?: string;
  }>;

  @Column({ nullable: true })
  internetMessageId?: string; // Standard email message ID

  @Column({ nullable: true })
  webLink?: string; // Link to view in Outlook Web

  @Column({ type: 'int', nullable: true })
  sizeBytes?: number;

  @Column({ nullable: true })
  parentFolderId?: string;

  @Column({ type: 'timestamp' })
  outlookCreatedAt: Date; // Created timestamp

  @Column({ type: 'timestamp' })
  outlookReceivedAt: Date; // Received timestamp

  @Column({ type: 'timestamp', nullable: true })
  outlookSentAt?: Date; // Sent timestamp

  @Column({ type: 'timestamp', nullable: true })
  lastModifiedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    changeKey?: string;
    conversationIndex?: string;
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
  @ManyToOne(() => OutlookMailbox, (mailbox) => mailbox.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mailboxId' })
  mailbox: OutlookMailbox;
}
