import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimelineEvent } from './entities/timeline-event.entity';
import { JiraIssue } from '../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../slack/entities/slack-message.entity';
import { TeamsMessage } from '../teams/entities/teams-message.entity';
import { MetricValue } from '../kpi/entities/metric-value.entity';
import { TimelineService } from './services/timeline.service';
import { TimelineGeneratorService } from './services/timeline-generator.service';
import { TimelineController } from './controllers/timeline.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimelineEvent,
      JiraIssue,
      ServiceNowIncident,
      SlackMessage,
      TeamsMessage,
      MetricValue,
    ]),
  ],
  controllers: [TimelineController],
  providers: [TimelineService, TimelineGeneratorService],
  exports: [TimelineService, TimelineGeneratorService],
})
export class TimelineModule {}
