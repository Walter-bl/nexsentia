import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column({ nullable: true })
  domain?: string;

  @Column({ type: 'json', nullable: true })
  settings?: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: ['free', 'starter', 'professional', 'enterprise'],
    default: 'free',
  })
  subscriptionTier: string;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt?: Date;

  @Column({ nullable: true })
  contactEmail?: string;

  @Column({ nullable: true })
  contactPhone?: string;

  // Relations
  @OneToMany(() => User, (user) => user.tenant)
  users: User[];
}
