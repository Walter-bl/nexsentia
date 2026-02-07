import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WeakSignal } from './weak-signal.entity';

export type HypothesisStatus = 'generated' | 'investigating' | 'validated' | 'refuted' | 'inconclusive';
export type HypothesisType = 'correlation' | 'causation_candidate' | 'pattern_explanation' | 'prediction';

@Entity('hypotheses')
@Index(['tenantId', 'status', 'generatedAt'])
@Index(['tenantId', 'weakSignalId'])
export class Hypothesis {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({ nullable: true })
  weakSignalId: number | null;

  @ManyToOne(() => WeakSignal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'weakSignalId' })
  weakSignal: WeakSignal | null;

  @Column({
    type: 'varchar',
    length: 50,
  })
  hypothesisType: HypothesisType;

  @Column({
    type: 'text',
  })
  hypothesis: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    comment: 'Confidence score 0-100',
  })
  confidence: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'generated',
  })
  status: HypothesisStatus;

  @Column({
    type: 'json',
    comment: 'Context used to generate this hypothesis',
  })
  context: {
    signals: {
      id: string;
      type: string;
      description: string;
      timestamp: string;
    }[];
    metrics: {
      key: string;
      value: number;
      trend: string;
    }[];
    timeline: {
      eventId: string;
      title: string;
      timestamp: string;
      impact: string;
    }[];
    graphContext: {
      nodes: string[];
      relationships: string[];
      clusters: string[];
    };
  };

  @Column({
    type: 'json',
    comment: 'LLM reasoning chain',
  })
  reasoning: {
    modelUsed: string;
    promptTemplate: string;
    reasoningSteps: {
      step: number;
      thought: string;
      evidence: string[];
      conclusion: string;
    }[];
    alternatives: string[];
    limitations: string[];
  };

  @Column({
    type: 'json',
    comment: 'Supporting evidence for the hypothesis',
  })
  supportingEvidence: {
    type: string;
    description: string;
    strength: number; // 0-100
    source: string;
    timestamp: string;
  }[];

  @Column({
    type: 'json',
    comment: 'Contradicting evidence',
    nullable: true,
  })
  contradictingEvidence: {
    type: string;
    description: string;
    strength: number;
    source: string;
    timestamp: string;
  }[] | null;

  @Column({
    type: 'json',
    comment: 'Guardrails - what this hypothesis is NOT claiming',
  })
  guardrails: {
    notClaimingRootCause: boolean;
    disclaimers: string[];
    requiresValidation: string[];
    assumptions: string[];
    limitations: string[];
  };

  @Column({
    type: 'json',
    comment: 'Suggested validation steps',
  })
  validationSteps: {
    step: number;
    action: string;
    expectedOutcome: string;
    difficulty: string; // easy, medium, hard
  }[];

  @Column({
    type: 'json',
    comment: 'Impact if hypothesis is true',
  })
  predictedImpact: {
    severity: string;
    affectedAreas: string[];
    estimatedTimeToEscalation: string | null;
    potentialConsequences: string[];
    mitigationSuggestions: string[];
  };

  @Column({
    type: 'timestamp',
  })
  @Index()
  generatedAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  validatedAt: Date | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  validatedBy: number | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  validationNotes: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Validation results',
  })
  validationResults: {
    outcome: 'confirmed' | 'partial' | 'refuted';
    evidence: string[];
    updatedConfidence: number;
    notes: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
