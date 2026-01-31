import { Entity, Column, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { JiraProject } from './jira-project.entity';
import { JiraSyncHistory } from './jira-sync-history.entity';

@Entity('jira_connections')
@Index(['tenantId', 'isActive'])
export class JiraConnection extends TenantBaseEntity {
  @Column()
  name: string;

  @Column()
  jiraInstanceUrl: string;

  @Column({ nullable: true })
  jiraCloudId?: string;

  @Column({
    type: 'enum',
    enum: ['cloud', 'server', 'datacenter'],
    default: 'cloud',
  })
  jiraType: string;

  // OAuth authentication fields
  @Column({ type: 'text' })
  oauthAccessToken: string;

  @Column({ type: 'text' })
  oauthRefreshToken: string;

  @Column({ type: 'timestamp' })
  oauthTokenExpiresAt: Date;

  @Column()
  oauthScope: string;

  @Column({ type: 'json' })
  oauthMetadata: {
    cloudId: string;
    accountId: string;
    displayName: string;
    email: string;
    workspaceName?: string; // Original Jira workspace name
    workspaceUrl?: string; // Original Jira workspace URL
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  syncSettings?: {
    syncInterval?: number; // in minutes
    autoSync?: boolean;
    projectFilter?: string[]; // array of project keys to sync
    issueTypeFilter?: string[]; // array of issue types to sync
    statusFilter?: string[]; // array of statuses to sync
    syncComments?: boolean;
    syncAttachments?: boolean;
    syncWorkLogs?: boolean;
  };

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessfulSyncAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastSyncError?: string;

  @Column({ default: 0 })
  totalIssuesSynced: number;

  @Column({ default: 0 })
  failedSyncAttempts: number;

  // Relations
  @OneToMany(() => JiraProject, (project) => project.connection)
  projects: JiraProject[];

  @OneToMany(() => JiraSyncHistory, (history) => history.connection)
  syncHistory: JiraSyncHistory[];
}
