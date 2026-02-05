import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionItem } from './entities/action-item.entity';
import { JiraIssue } from '../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../servicenow/entities/servicenow-incident.entity';
import { TimelineEvent } from '../timeline/entities/timeline-event.entity';
import { MetricValue } from '../kpi/entities/metric-value.entity';
import { ActionGeneratorService } from './services/action-generator.service';
import { ActionCenterController } from './controllers/action-center.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionItem,
      JiraIssue,
      ServiceNowIncident,
      TimelineEvent,
      MetricValue,
    ]),
  ],
  controllers: [ActionCenterController],
  providers: [ActionGeneratorService],
  exports: [ActionGeneratorService],
})
export class ActionCenterModule {}
