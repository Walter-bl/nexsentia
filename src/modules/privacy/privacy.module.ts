import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { PiiDetectionLog } from './entities/pii-detection-log.entity';
import { AnonymizationMapping } from './entities/anonymization-mapping.entity';
import { GraphNode } from './entities/graph-node.entity';
import { GraphEdge } from './entities/graph-edge.entity';

// Integration entities
import { JiraConnection } from '../jira/entities/jira-connection.entity';
import { JiraIssue } from '../jira/entities/jira-issue.entity';
import { SlackConnection } from '../slack/entities/slack-connection.entity';
import { SlackMessage } from '../slack/entities/slack-message.entity';
import { TeamsConnection } from '../teams/entities/teams-connection.entity';
import { TeamsMessage } from '../teams/entities/teams-message.entity';
import { ServiceNowConnection } from '../servicenow/entities/servicenow-connection.entity';
import { ServiceNowIncident } from '../servicenow/entities/servicenow-incident.entity';

// Services
import { PiiDetectionService } from './services/pii-detection.service';
import { PiiAnonymizationService } from './services/pii-anonymization.service';
import { PiiValidationService } from './services/pii-validation.service';
import { GraphBuilderService } from './services/graph-builder.service';
import { GraphQueryService } from './services/graph-query.service';
import { PrivacyDashboardService } from './services/privacy-dashboard.service';

// Controllers
import { PiiController } from './controllers/pii.controller';
import { GraphController } from './controllers/graph.controller';
import { PrivacyDashboardController } from './controllers/privacy-dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PiiDetectionLog,
      AnonymizationMapping,
      GraphNode,
      GraphEdge,
      JiraConnection,
      JiraIssue,
      SlackConnection,
      SlackMessage,
      TeamsConnection,
      TeamsMessage,
      ServiceNowConnection,
      ServiceNowIncident,
    ]),
    ConfigModule,
  ],
  controllers: [PiiController, GraphController, PrivacyDashboardController],
  providers: [
    PiiDetectionService,
    PiiAnonymizationService,
    PiiValidationService,
    GraphBuilderService,
    GraphQueryService,
    PrivacyDashboardService,
  ],
  exports: [
    PiiDetectionService,
    PiiAnonymizationService,
    PiiValidationService,
    GraphBuilderService,
    GraphQueryService,
    PrivacyDashboardService,
  ],
})
export class PrivacyModule {}
