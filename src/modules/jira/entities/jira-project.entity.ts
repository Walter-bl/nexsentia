import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { JiraConnection } from './jira-connection.entity';
import { JiraIssue } from './jira-issue.entity';

@Entity('jira_projects')
@Index(['tenantId', 'connectionId'])
@Index(['jiraProjectId'])
export class JiraProject extends TenantBaseEntity {
  @Column({ type: 'int' })
  connectionId: number;

  @Column()
  jiraProjectId: string;

  @Column()
  jiraProjectKey: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  projectTypeKey?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ nullable: true })
  leadAccountId?: string;

  @Column({ nullable: true })
  leadDisplayName?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ default: 0 })
  totalIssues: number;

  // Relations
  @ManyToOne(() => JiraConnection, (connection) => connection.projects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'connectionId' })
  connection: JiraConnection;

  @OneToMany(() => JiraIssue, (issue) => issue.project)
  issues: JiraIssue[];
}
