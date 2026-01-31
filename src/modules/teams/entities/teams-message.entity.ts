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
import { TeamsChannel } from './teams-channel.entity';
import { TeamsUser } from './teams-user.entity';

@Entity('teams_messages')
@Index(['tenantId'])
@Index(['tenantId', 'channelId'])
@Index(['messageId'], { unique: true })
@Index(['userId'])
@Index(['replyToId'])
@Index(['createdDateTime'])
export class TeamsMessage {
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

  @Column({ nullable: true })
  channelId?: number;

  @ManyToOne(() => TeamsChannel, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel?: TeamsChannel;

  @Column({ nullable: true })
  userId?: number;

  @ManyToOne(() => TeamsUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: TeamsUser;

  // Microsoft Teams Message ID
  @Column({ length: 255, unique: true })
  messageId: string;

  // Teams Team ID
  @Column({ length: 255 })
  teamId: string;

  // Teams Channel ID (Microsoft ID, not our FK)
  @Column({ length: 255 })
  teamsChannelId: string;

  // Teams User ID (Microsoft ID, not our FK)
  @Column({ length: 255, nullable: true })
  teamsUserId?: string;

  // Message content (HTML or plain text)
  @Column({ type: 'text', nullable: true })
  content?: string;

  // Message content type
  @Column({ length: 50, nullable: true })
  contentType?: string; // 'html', 'text'

  // Message subject (if any)
  @Column({ type: 'text', nullable: true })
  subject?: string;

  // Message type: message, chatMessage, systemEventMessage
  @Column({ length: 100, nullable: true })
  messageType?: string;

  // Reply to message ID (for threads)
  @Column({ length: 255, nullable: true })
  replyToId?: string;

  // Message importance: normal, high, urgent
  @Column({ length: 50, nullable: true })
  importance?: string;

  // Message web URL
  @Column({ type: 'text', nullable: true })
  webUrl?: string;

  // Reactions on the message
  @Column({ type: 'json', nullable: true })
  reactions?: Array<{
    reactionType: string;
    createdDateTime: string;
    user: {
      id: string;
      displayName?: string;
    };
  }>;

  // Mentions in the message
  @Column({ type: 'json', nullable: true })
  mentions?: Array<{
    id: number;
    mentionText: string;
    mentioned: {
      id: string;
      displayName?: string;
      userIdentityType?: string;
    };
  }>;

  // Attachments (files, images, etc.)
  @Column({ type: 'json', nullable: true })
  attachments?: Array<{
    id: string;
    contentType: string;
    contentUrl?: string;
    content?: string;
    name?: string;
    thumbnailUrl?: string;
  }>;

  // Message metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    etag?: string;
    locale?: string;
    lastEditedDateTime?: string;
    deletedDateTime?: string;
    eventDetail?: any;
  };

  // Is the message deleted?
  @Column({ default: false })
  isDeleted: boolean;

  // Message created timestamp (from Teams)
  @Column({ type: 'timestamp' })
  createdDateTime: Date;

  // Message last modified timestamp (from Teams)
  @Column({ type: 'timestamp', nullable: true })
  lastModifiedDateTime?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
