import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('anonymization_mappings')
@Index(['tenantId', 'tokenId'], { unique: true })
@Index(['tenantId', 'originalValueHash'])
export class AnonymizationMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tenantId: number;

  @Column({ length: 255, unique: true })
  tokenId: string; // Unique token identifier (e.g., 'EMAIL_TOKEN_abc123')

  @Column({ length: 64 })
  originalValueHash: string; // SHA-256 hash of the original value

  @Column({ type: 'text' })
  encryptedValue: string; // Encrypted original value (AES-256)

  @Column({ length: 50 })
  piiType: string; // 'email', 'phone', 'ssn', etc.

  @Column({ length: 50 })
  method: string; // 'tokenization', 'encryption', 'hashing'

  @Column({ type: 'json', nullable: true })
  metadata?: {
    createdBy?: number;
    sourceType?: string;
    sourceId?: string;
    expiresAt?: Date;
    accessCount?: number;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastAccessedAt?: Date;
}
