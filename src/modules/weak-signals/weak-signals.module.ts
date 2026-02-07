import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeakSignal } from './entities/weak-signal.entity';
import { Hypothesis } from './entities/hypothesis.entity';
import { DetectionRun } from './entities/detection-run.entity';
import { PatternExtractionService } from './services/pattern-extraction.service';
import { TrendAccelerationService } from './services/trend-acceleration.service';
import { WeakSignalDetectionService } from './services/weak-signal-detection.service';
import { HypothesisGenerationService } from './services/hypothesis-generation.service';
import { WeakSignalSchedulerService } from './services/weak-signal-scheduler.service';
import { WeakSignalsController } from './controllers/weak-signals.controller';
import { HypothesesController } from './controllers/hypotheses.controller';

// Import entities from other modules
import { JiraIssue } from '../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../slack/entities/slack-message.entity';
import { TeamsMessage } from '../teams/entities/teams-message.entity';
import { TimelineEvent } from '../timeline/entities/timeline-event.entity';
import { MetricValue } from '../kpi/entities/metric-value.entity';
import { MetricDefinition } from '../kpi/entities/metric-definition.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeakSignal,
      Hypothesis,
      DetectionRun,
      JiraIssue,
      ServiceNowIncident,
      SlackMessage,
      TeamsMessage,
      TimelineEvent,
      MetricValue,
      MetricDefinition,
      Tenant,
    ]),
  ],
  controllers: [WeakSignalsController, HypothesesController],
  providers: [
    PatternExtractionService,
    TrendAccelerationService,
    WeakSignalDetectionService,
    HypothesisGenerationService,
    WeakSignalSchedulerService,
  ],
  exports: [WeakSignalDetectionService, HypothesisGenerationService, WeakSignalSchedulerService],
})
export class WeakSignalsModule {}
