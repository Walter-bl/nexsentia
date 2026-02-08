import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import emailConfig from '../../config/email/email.config';

// Entities
import { AlertRule } from './entities/alert-rule.entity';
import { AlertSubscription } from './entities/alert-subscription.entity';
import { AlertHistory } from './entities/alert-history.entity';

// External entities
import { User } from '../users/entities/user.entity';
import { WeakSignal } from '../weak-signals/entities/weak-signal.entity';
import { ServiceNowIncident } from '../servicenow/entities/servicenow-incident.entity';
import { MetricValue } from '../kpi/entities/metric-value.entity';

// Services
import { EmailService } from './email.service';
import { AlertRuleEngineService } from './services/alert-rule-engine.service';
import { AlertDeliveryService } from './services/alert-delivery.service';
import { AlertRateLimiterService } from './services/alert-rate-limiter.service';
import { AlertOrchestratorService } from './services/alert-orchestrator.service';

// Controllers
import { AlertsController } from './controllers/alerts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertRule,
      AlertSubscription,
      AlertHistory,
      User,
      WeakSignal,
      ServiceNowIncident,
      MetricValue,
    ]),
    ConfigModule.forFeature(emailConfig),
    ScheduleModule.forRoot(),
  ],
  controllers: [AlertsController],
  providers: [
    EmailService,
    AlertRuleEngineService,
    AlertDeliveryService,
    AlertRateLimiterService,
    AlertOrchestratorService,
  ],
  exports: [
    EmailService,
    AlertRuleEngineService,
    AlertDeliveryService,
    AlertRateLimiterService,
    AlertOrchestratorService,
  ],
})
export class EmailModule {}
