import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { JiraProject } from './jira-project.entity';

@Entity('jira_issues')
@Index(['tenantId', 'projectId'])
@Index(['jiraIssueKey'])
@Index(['status'])
@Index(['priority'])
@Index(['issueType'])
@Index(['createdAt'])
@Index(['updatedAt'])
export class JiraIssue extends TenantBaseEntity {
  @Column({ type: 'int' })
  projectId: number;

  @Column({ unique: true })
  jiraIssueId: string;

  @Column()
  jiraIssueKey: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  issueType: string;

  @Column()
  status: string;

  @Column({ nullable: true })
  priority?: string;

  @Column({ nullable: true })
  resolution?: string;

  @Column({ nullable: true })
  reporterAccountId?: string;

  @Column({ nullable: true })
  reporterDisplayName?: string;

  @Column({ nullable: true })
  reporterEmail?: string;

  @Column({ nullable: true })
  assigneeAccountId?: string;

  @Column({ nullable: true })
  assigneeDisplayName?: string;

  @Column({ nullable: true })
  assigneeEmail?: string;

  @Column({ type: 'json', nullable: true })
  labels?: string[];

  @Column({ type: 'json', nullable: true })
  components?: Array<{ id: string; name: string }>;

  @Column({ nullable: true })
  parentIssueKey?: string;

  @Column({ type: 'float', nullable: true })
  storyPoints?: number;

  @Column({ type: 'int', nullable: true })
  timeEstimate?: number;

  @Column({ type: 'int', nullable: true })
  timeSpent?: number;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  jiraCreatedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  jiraUpdatedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'json', nullable: true })
  customFields?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  comments?: Array<{
    id: string;
    author: string;
    body: string;
    created: string;
    updated: string;
  }>;

  @Column({ type: 'json', nullable: true })
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    created: string;
    author: string;
  }>;

  @Column({ type: 'json', nullable: true })
  changelog?: Array<{
    id: string;
    author: string;
    created: string;
    items: Array<{
      field: string;
      fieldtype: string;
      from: string;
      fromString: string;
      to: string;
      toString: string;
    }>;
  }>;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Relations
  @ManyToOne(() => JiraProject, (project) => project.issues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: JiraProject;
}
