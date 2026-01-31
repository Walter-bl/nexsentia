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
import { SlackChannel } from './slack-channel.entity';

@Entity('slack_messages')
@Index(['tenantId', 'channelId'])
@Index(['slackMessageTs'])
@Index(['slackUserId'])
@Index(['slackThreadTs'])
export class SlackMessage {
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

  // Channel reference
  @Column()
  channelId: number;

  @ManyToOne(() => SlackChannel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: SlackChannel;

  // Message details from Slack
  @Column({ length: 255, unique: true })
  slackMessageTs: string; // Slack's unique message timestamp

  @Column({ length: 255 })
  slackChannelId: string;

  @Column({ length: 255 })
  slackUserId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ length: 50, default: 'message' })
  type: string; // message, app_mention, channel_join, etc.

  @Column({ length: 50, nullable: true })
  subtype?: string; // bot_message, file_share, thread_broadcast, etc.

  // Thread information
  @Column({ length: 255, nullable: true })
  slackThreadTs?: string;

  @Column({ default: false })
  isThreadReply: boolean;

  @Column({ type: 'int', default: 0 })
  replyCount: number;

  @Column({ type: 'json', nullable: true })
  replyUsers?: string[];

  @Column({ type: 'timestamp', nullable: true })
  latestReplyAt?: Date;

  // Reactions
  @Column({ type: 'json', nullable: true })
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;

  // Attachments and files
  @Column({ type: 'json', nullable: true })
  attachments?: Array<{
    id?: number;
    fallback?: string;
    text?: string;
    title?: string;
    titleLink?: string;
    imageUrl?: string;
    thumbUrl?: string;
    color?: string;
    fields?: Array<{
      title: string;
      value: string;
      short?: boolean;
    }>;
  }>;

  @Column({ type: 'json', nullable: true })
  files?: Array<{
    id: string;
    name: string;
    title?: string;
    mimetype?: string;
    filetype?: string;
    size?: number;
    url?: string;
    urlPrivate?: string;
    urlPrivateDownload?: string;
    permalink?: string;
    permalinkPublic?: string;
    thumb?: string;
  }>;

  // Message metadata
  @Column({ default: false })
  isEdited: boolean;

  @Column({ type: 'timestamp', nullable: true })
  editedAt?: Date;

  @Column({ default: false })
  isPinned: boolean;

  @Column({ default: false })
  isStarred: boolean;

  // Bot information
  @Column({ length: 255, nullable: true })
  botId?: string;

  @Column({ length: 255, nullable: true })
  botUsername?: string;

  // Timestamps from Slack
  @Column({ type: 'timestamp' })
  slackCreatedAt: Date;

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Metadata for analysis
  @Column({ type: 'json', nullable: true })
  metadata?: {
    blocks?: any[];
    clientMsgId?: string;
    team?: string;
    sentiment?: {
      score?: number;
      magnitude?: number;
      label?: string;
    };
    entities?: Array<{
      type: string;
      value: string;
    }>;
  };
}
