import { Entity, Column, ManyToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('permissions')
export class Permission extends BaseEntity {
  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ unique: true })
  @Index()
  code: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ default: true })
  isActive: boolean;

  // Relations
  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
