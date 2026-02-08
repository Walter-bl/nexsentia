import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { AlertRuleEngineService } from './alert-rule-engine.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { AlertRateLimiterService } from './alert-rate-limiter.service';
import { WeakSignal } from '../../weak-signals/entities/weak-signal.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { AlertRule } from '../entities/alert-rule.entity';

@Injectable()
export class AlertOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(AlertOrchestratorService.name);
  private lastProcessedTime: Date = new Date();

  constructor(
    private readonly ruleEngine: AlertRuleEngineService,
    private readonly delivery: AlertDeliveryService,
    private readonly rateLimiter: AlertRateLimiterService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
    @InjectRepository(ServiceNowIncident)
    private readonly incidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(AlertRule)
    private readonly ruleRepository: Repository<AlertRule>,
  ) {}

  onModuleInit() {
    this.logger.log('Alert Orchestrator Service initialized');
    // Set initial last processed time to 5 minutes ago
    this.lastProcessedTime = new Date(Date.now() - 5 * 60 * 1000);
  }

  /**
   * Process weak signals every 5 minutes
   */
  @Cron('0 */5 * * * *', {
    name: 'process-weak-signals',
  })
  async processWeakSignals() {
    this.logger.log('Processing weak signals for alerts...');

    try {
      // Get new weak signals since last processed
      const signals = await this.weakSignalRepository.find({
        where: {
          detectedAt: MoreThan(this.lastProcessedTime),
        },
        order: { detectedAt: 'ASC' },
      });

      this.logger.log(`Found ${signals.length} new weak signals to process`);

      for (const signal of signals) {
        await this.processSignalForAlerts(signal);
      }

      // Update last processed time
      if (signals.length > 0) {
        this.lastProcessedTime = new Date();
      }
    } catch (error) {
      this.logger.error('Error processing weak signals:', error);
    }
  }

  /**
   * Process a weak signal and trigger matching alerts
   */
  private async processSignalForAlerts(signal: WeakSignal) {
    try {
      const context = {
        tenantId: signal.tenantId,
        sourceType: 'weak_signal',
        sourceId: signal.id.toString(),
        sourceData: {
          id: signal.id,
          title: signal.title,
          description: signal.description,
          topic: signal.metadata?.theme || '',
          severity: signal.severity,
          confidence: signal.confidenceScore,
          signalType: signal.signalType,
          metadata: signal.metadata,
        },
        timestamp: signal.detectedAt || new Date(),
      };

      // Evaluate all rules against this signal
      const results = await this.ruleEngine.evaluateRules(context);

      if (results.length > 0) {
        this.logger.log(
          `Signal ${signal.id} matched ${results.length} alert rules`,
        );

        // Deliver alerts for each matched rule
        for (const result of results) {
          await this.delivery.deliverAlert({
            tenantId: signal.tenantId,
            ruleId: result.rule.id,
            title: result.title,
            message: result.message,
            severity: result.severity,
            sourceType: 'weak_signal',
            sourceId: signal.id.toString(),
            sourceData: context.sourceData,
            metadata: result.metadata,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error processing signal ${signal.id}:`, error);
    }
  }

  /**
   * Process ServiceNow incidents every 10 minutes
   */
  @Cron('0 */10 * * * *', {
    name: 'process-incidents',
  })
  async processIncidents() {
    this.logger.log('Processing ServiceNow incidents for alerts...');

    try {
      const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // Last 10 minutes

      const incidents = await this.incidentRepository.find({
        where: {
          sysCreatedOn: MoreThan(cutoffTime),
        },
        order: { sysCreatedOn: 'ASC' },
      });

      this.logger.log(`Found ${incidents.length} new incidents to process`);

      for (const incident of incidents) {
        await this.processIncidentForAlerts(incident);
      }
    } catch (error) {
      this.logger.error('Error processing incidents:', error);
    }
  }

  /**
   * Process an incident and trigger matching alerts
   */
  private async processIncidentForAlerts(incident: ServiceNowIncident) {
    try {
      const context = {
        tenantId: incident.tenantId,
        sourceType: 'incident',
        sourceId: incident.sysId,
        sourceData: {
          id: incident.sysId,
          number: incident.number,
          title: incident.shortDescription,
          description: incident.description,
          priority: incident.priority,
          severity: incident.impact || 'medium',
          state: incident.state,
          assignmentGroup: incident.assignmentGroupName,
          category: incident.category,
        },
        timestamp: incident.sysCreatedOn || new Date(),
      };

      const results = await this.ruleEngine.evaluateRules(context);

      if (results.length > 0) {
        this.logger.log(
          `Incident ${incident.number} matched ${results.length} alert rules`,
        );

        for (const result of results) {
          await this.delivery.deliverAlert({
            tenantId: incident.tenantId,
            ruleId: result.rule.id,
            title: result.title,
            message: result.message,
            severity: result.severity,
            sourceType: 'incident',
            sourceId: incident.sysId,
            sourceData: context.sourceData,
            metadata: result.metadata,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error processing incident ${incident.number}:`, error);
    }
  }

  /**
   * Cleanup old alert history (runs daily at 3 AM)
   */
  @Cron('0 0 3 * * *', {
    name: 'cleanup-alert-history',
  })
  async cleanupOldAlerts() {
    this.logger.log('Starting alert history cleanup...');

    try {
      // Cleanup suppressed alerts
      const suppressedCount = await this.rateLimiter.cleanupSuppressedAlerts();
      this.logger.log(`Cleaned up ${suppressedCount} old suppressed alerts`);
    } catch (error) {
      this.logger.error('Error cleaning up alerts:', error);
    }
  }

  /**
   * Manual trigger to process all recent data
   */
  async manualProcessAll(tenantId: number, hoursBack: number = 1): Promise<{
    signalsProcessed: number;
    incidentsProcessed: number;
    alertsTriggered: number;
  }> {
    this.logger.log(`Manual processing triggered for tenant ${tenantId}`);

    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    let alertsTriggered = 0;

    // Process signals
    const signals = await this.weakSignalRepository.find({
      where: {
        tenantId,
        detectedAt: MoreThan(cutoff),
      },
    });

    for (const signal of signals) {
      const results = await this.ruleEngine.evaluateRules({
        tenantId: signal.tenantId,
        sourceType: 'weak_signal',
        sourceId: signal.id.toString(),
        sourceData: signal,
        timestamp: signal.detectedAt,
      });

      alertsTriggered += results.length;

      for (const result of results) {
        await this.delivery.deliverAlert({
          tenantId: signal.tenantId,
          ruleId: result.rule.id,
          title: result.title,
          message: result.message,
          severity: result.severity,
          sourceType: 'weak_signal',
          sourceId: signal.id.toString(),
          sourceData: signal,
        });
      }
    }

    // Process incidents
    const incidents = await this.incidentRepository.find({
      where: {
        tenantId,
        sysCreatedOn: MoreThan(cutoff),
      },
    });

    for (const incident of incidents) {
      const results = await this.ruleEngine.evaluateRules({
        tenantId: incident.tenantId,
        sourceType: 'incident',
        sourceId: incident.sysId,
        sourceData: incident,
        timestamp: incident.sysCreatedOn || new Date(),
      });

      alertsTriggered += results.length;

      for (const result of results) {
        await this.delivery.deliverAlert({
          tenantId: incident.tenantId,
          ruleId: result.rule.id,
          title: result.title,
          message: result.message,
          severity: result.severity,
          sourceType: 'incident',
          sourceId: incident.sysId,
          sourceData: incident,
        });
      }
    }

    return {
      signalsProcessed: signals.length,
      incidentsProcessed: incidents.length,
      alertsTriggered,
    };
  }
}
