import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { AuditAction } from '../../../common/enums';

@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog extends TenantBaseEntity {
  @Column({ type: 'int', nullable: true })
  userId?: number;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column()
  resource: string;

  @Column({ type: 'int', nullable: true })
  resourceId?: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  httpMethod?: string;

  @Column({ nullable: true })
  requestPath?: string;

  @Column({ nullable: true })
  statusCode?: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  // Relations
  @ManyToOne(() => User, (user) => user.auditLogs, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user?: User;
}
