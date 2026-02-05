import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('action_items')
export class ActionItem extends TenantBaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ['open', 'in_progress', 'done', 'cancelled'],
    default: 'open',
  })
  status: string;

  @Column({
    type: 'enum',
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
  })
  priority: string;

  @Column({ length: 100, nullable: true })
  category?: string;

  @Column({ length: 100, nullable: true })
  sourceType?: string; // e.g., 'ai_detection', 'manual', 'timeline_event', 'kpi_threshold'

  @Column({ length: 255, nullable: true })
  sourceId?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    detectionPattern?: string;
    affectedSystems?: string[];
    estimatedImpact?: string;
    suggestedActions?: string[];
    detectionConfidence?: number;
    [key: string]: any;
  };

  @Column({ type: 'json', nullable: true })
  aiAnalysis?: {
    detectedIssue?: string;
    rootCause?: string;
    recommendedSolution?: string;
    alternativeSolutions?: string[];
    estimatedEffort?: string;
    [key: string]: any;
  };

  @Column({ type: 'int', nullable: true })
  assignedToId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo?: User;

  @Column({ length: 100, nullable: true })
  assignedToName?: string; // Denormalized for quick access

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', nullable: true })
  completedById?: number;

  @Column({ type: 'text', nullable: true })
  completionNotes?: string;

  @Column({ default: false })
  isRecurring: boolean;

  @Column({ length: 50, nullable: true })
  recurringPattern?: string; // e.g., 'daily', 'weekly', 'monthly'

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastViewedAt?: Date;
}
