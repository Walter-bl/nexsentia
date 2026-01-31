import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JiraConnection } from './entities/jira-connection.entity';
import { JiraProject } from './entities/jira-project.entity';
import { JiraIssue } from './entities/jira-issue.entity';
import { JiraSyncHistory } from './entities/jira-sync-history.entity';
import { JiraConnectionService } from './services/jira-connection.service';
import { JiraIssueService } from './services/jira-issue.service';
import { JiraApiClientService } from './services/jira-api-client.service';
import { JiraIngestionService } from './services/jira-ingestion.service';
import { JiraWebhookService } from './services/jira-webhook.service';
import { JiraOAuthService } from './services/jira-oauth.service';
import { JiraConnectionController } from './controllers/jira-connection.controller';
import { JiraIssueController } from './controllers/jira-issue.controller';
import { JiraWebhookController } from './controllers/jira-webhook.controller';
import { JiraOAuthController } from './controllers/jira-oauth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JiraConnection,
      JiraProject,
      JiraIssue,
      JiraSyncHistory,
    ]),
  ],
  controllers: [
    JiraConnectionController,
    JiraIssueController,
    JiraWebhookController,
    JiraOAuthController,
  ],
  providers: [
    JiraConnectionService,
    JiraIssueService,
    JiraApiClientService,
    JiraIngestionService,
    JiraWebhookService,
    JiraOAuthService,
  ],
  exports: [
    JiraConnectionService,
    JiraIssueService,
    JiraIngestionService,
    JiraOAuthService,
  ],
})
export class JiraModule {}
