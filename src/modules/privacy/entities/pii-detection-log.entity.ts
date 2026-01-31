import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('pii_detection_logs')
@Index(['tenantId', 'sourceType', 'sourceId'])
@Index(['tenantId', 'detectedAt'])
export class PiiDetectionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({ length: 50 })
  sourceType: string; // 'jira', 'slack', 'teams', 'servicenow', etc.

  @Column({ length: 255 })
  sourceId: string; // ID of the source entity

  @Column({ length: 100 })
  fieldName: string; // Name of the field where PII was detected

  @Column({ length: 50 })
  piiType: string; // 'email', 'phone', 'ssn', 'credit_card', 'ip_address', etc.

  @Column({ type: 'text', nullable: true })
  originalValue?: string; // Original value (for debugging, should be redacted in production)

  @Column({ type: 'text', nullable: true })
  detectedPattern?: string; // Regex pattern that matched

  @Column({ type: 'float', default: 1.0 })
  confidenceScore: number; // 0.0 to 1.0

  @Column({ type: 'json', nullable: true })
  metadata?: {
    position?: number;
    length?: number;
    context?: string;
    additionalInfo?: Record<string, any>;
  };

  @Column({ default: false })
  isAnonymized: boolean;

  @Column({ length: 255, nullable: true })
  anonymizationMethod?: string; // 'hash', 'tokenize', 'mask', 'encrypt'

  @CreateDateColumn()
  detectedAt: Date;
}
