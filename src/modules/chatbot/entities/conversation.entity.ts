import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';

@Entity('chatbot_conversations')
@Index(['tenantId', 'sessionId'])
@Index(['tenantId', 'userId'])
export class Conversation extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  sessionId: string;

  @Column({ nullable: true })
  userId?: number;

  @Column({ type: 'json' })
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    queriedSignals?: number[];
    queriedIncidents?: number[];
    queriedIssues?: number[];
    totalTokens?: number;
  };

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt?: Date;
}
