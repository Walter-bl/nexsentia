import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { MetricDefinition } from './entities/metric-definition.entity';
import { MetricValue } from './entities/metric-value.entity';
import { BusinessImpact } from './entities/business-impact.entity';
import { KpiSnapshot } from './entities/kpi-snapshot.entity';

// External entities for calculations
import { JiraIssue } from '../jira/entities/jira-issue.entity';
import { SlackMessage } from '../slack/entities/slack-message.entity';
import { TeamsMessage } from '../teams/entities/teams-message.entity';
import { ServiceNowIncident } from '../servicenow/entities/servicenow-incident.entity';

// Services
import { MetricDefinitionService } from './services/metric-definition.service';
import { MetricAggregationService } from './services/metric-aggregation.service';
import { BusinessImpactService } from './services/business-impact.service';
import { KpiValidationService } from './services/kpi-validation.service';

// Controllers
import { MetricsController } from './controllers/metrics.controller';
import { BusinessImpactController } from './controllers/business-impact.controller';
import { DashboardController } from './controllers/dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetricDefinition,
      MetricValue,
      BusinessImpact,
      KpiSnapshot,
      JiraIssue,
      SlackMessage,
      TeamsMessage,
      ServiceNowIncident,
    ]),
    ConfigModule,
  ],
  controllers: [
    MetricsController,
    BusinessImpactController,
    DashboardController,
  ],
  providers: [
    MetricDefinitionService,
    MetricAggregationService,
    BusinessImpactService,
    KpiValidationService,
  ],
  exports: [
    MetricDefinitionService,
    MetricAggregationService,
    BusinessImpactService,
    KpiValidationService,
  ],
})
export class KpiModule {}
