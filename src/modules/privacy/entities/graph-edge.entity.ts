import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GraphNode } from './graph-node.entity';

@Entity('graph_edges')
@Index(['tenantId', 'fromNodeId', 'toNodeId', 'relationshipType'])
@Index(['tenantId', 'relationshipType'])
export class GraphEdge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column()
  fromNodeId: number;

  @ManyToOne(() => GraphNode)
  @JoinColumn({ name: 'fromNodeId' })
  fromNode: GraphNode;

  @Column()
  toNodeId: number;

  @ManyToOne(() => GraphNode)
  @JoinColumn({ name: 'toNodeId' })
  toNode: GraphNode;

  @Column({ length: 100 })
  relationshipType: string; // 'created_by', 'assigned_to', 'mentions', 'replied_to', 'member_of', 'works_on', etc.

  @Column({ type: 'json', nullable: true })
  properties?: {
    weight?: number;
    strength?: number;
    createdAt?: Date;
    metadata?: Record<string, any>;
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
