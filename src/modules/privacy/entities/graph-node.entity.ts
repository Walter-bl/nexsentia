import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('graph_nodes')
@Index(['tenantId', 'nodeType', 'externalId'], { unique: true })
@Index(['tenantId', 'nodeType'])
export class GraphNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({ length: 50 })
  nodeType: string; // 'user', 'issue', 'message', 'channel', 'team', 'project', etc.

  @Column({ length: 255 })
  externalId: string; // ID from the source system

  @Column({ length: 100 })
  sourceSystem: string; // 'jira', 'slack', 'teams', 'servicenow'

  @Column({ length: 255, nullable: true })
  displayName?: string;

  @Column({ type: 'json', nullable: true })
  properties?: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    createdAt?: Date;
    updatedAt?: Date;
    metadata?: Record<string, any>;
  };

  @Column({ type: 'json', nullable: true })
  labels?: string[]; // Tags/labels for categorization

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
