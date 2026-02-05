import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';

@Entity('timeline_events')
@Index(['tenantId', 'eventDate'])
@Index(['tenantId', 'impactLevel'])
@Index(['tenantId', 'category'])
export class TimelineEvent extends TenantBaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'timestamp' })
  eventDate: Date;

  @Column({
    type: 'enum',
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  })
  impactLevel: string;

  @Column({ length: 100 })
  category: string; // 'communication', 'operations', 'incidents', 'productivity', etc.

  @Column({ length: 50, nullable: true })
  sourceType?: string; // 'jira', 'slack', 'teams', 'servicenow', 'ai_detected'

  @Column({ length: 255, nullable: true })
  sourceId?: string; // External ID from source system

  @Column({ type: 'json', nullable: true })
  metadata?: {
    affectedTeams?: string[];
    affectedProjects?: string[];
    confidence?: number; // AI confidence score (0-1)
    signals?: string[]; // Related weak signals
    recommendations?: string[];
    metrics?: Record<string, any>;
  };

  @Column({ type: 'json', nullable: true })
  aiAnalysis?: {
    detectedPattern?: string;
    severity?: string;
    rootCause?: string;
    predictedImpact?: string;
    suggestedActions?: string[];
  };

  @Column({ default: false })
  isResolved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ nullable: true })
  resolvedBy?: number; // User ID

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
