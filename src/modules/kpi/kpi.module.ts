import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ModuleRef } from '@nestjs/core';
import * as redisStore from 'cache-manager-redis-store';

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
import { WeakSignal } from '../weak-signals/entities/weak-signal.entity';

// Services
import { MetricDefinitionService } from './services/metric-definition.service';
import { MetricAggregationService } from './services/metric-aggregation.service';
import { BusinessImpactService } from './services/business-impact.service';
import { KpiValidationService } from './services/kpi-validation.service';
import { TeamImpactService } from './services/team-impact.service';
import { OrganizationalPulseCacheService } from './services/organizational-pulse-cache.service';
import { OrganizationalPulseService } from './services/organizational-pulse.service';
import { RedisHealthService } from './services/redis-health.service';

// Controllers
import { MetricsController } from './controllers/metrics.controller';
import { BusinessImpactController } from './controllers/business-impact.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { KpiSeedController } from './controllers/kpi-seed.controller';

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
      WeakSignal,
    ]),
    ConfigModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): any => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        // Use Redis if configured, otherwise fall back to in-memory
        if (redisHost) {
          const logger = new Logger('KpiCacheModule');
          logger.log(`🔴 Using Redis cache at ${redisHost}:${redisPort}`);
          return {
            store: redisStore,
            host: redisHost,
            port: redisPort,
            password: redisPassword || undefined,
            ttl: 1800, // 30 minutes in seconds (Redis uses seconds)
            max: 100,
          };
        }

        // Fallback to in-memory cache
        const logger = new Logger('KpiCacheModule');
        logger.log('💾 Using in-memory cache (Redis not configured)');
        return {
          ttl: 1800000, // 30 minutes in milliseconds
          max: 100,
        };
      },
    }),
  ],
  controllers: [
    MetricsController,
    BusinessImpactController,
    DashboardController,
    KpiSeedController,
  ],
  providers: [
    MetricDefinitionService,
    MetricAggregationService,
    BusinessImpactService,
    KpiValidationService,
    TeamImpactService,
    OrganizationalPulseService,
    OrganizationalPulseCacheService,
    RedisHealthService,
  ],
  exports: [
    MetricDefinitionService,
    MetricAggregationService,
    BusinessImpactService,
    KpiValidationService,
    TeamImpactService,
  ],
})
export class KpiModule implements OnModuleInit {
  private readonly logger = new Logger(KpiModule.name);

  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    this.logger.log('[KpiModule] onModuleInit - Wiring up organizational pulse services...');

    // Wire up the pulse service to the cache service after module initialization
    // This avoids circular dependency issues
    const cacheService = this.moduleRef.get(OrganizationalPulseCacheService, { strict: false });
    const pulseService = this.moduleRef.get(OrganizationalPulseService, { strict: false });

    this.logger.log(`[KpiModule] Services found: cacheService=${!!cacheService}, pulseService=${!!pulseService}`);

    if (cacheService && pulseService) {
      cacheService.setPulseService(pulseService);
      this.logger.log('[KpiModule] ✅ Pulse service successfully set on cache service');
    } else {
      this.logger.error('[KpiModule] ❌ Failed to wire services - one or both services not found');
    }
  }
}
