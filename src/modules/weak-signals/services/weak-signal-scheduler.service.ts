import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { WeakSignalDetectionService } from './weak-signal-detection.service';
import { HypothesisGenerationService } from './hypothesis-generation.service';
import { DetectionRun } from '../entities/detection-run.entity';
import { WeakSignal } from '../entities/weak-signal.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Injectable()
export class WeakSignalSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WeakSignalSchedulerService.name);
  private readonly isEnabled: boolean;
  private readonly cronSchedule: string;
  private readonly daysBack: number;
  private readonly deduplicationHours: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly detectionService: WeakSignalDetectionService,
    private readonly hypothesisService: HypothesisGenerationService,
    @InjectRepository(DetectionRun)
    private readonly detectionRunRepository: Repository<DetectionRun>,
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {
    this.isEnabled = this.configService.get<string>('WEAK_SIGNAL_DETECTION_ENABLED') === 'true';
    this.cronSchedule = this.configService.get<string>('WEAK_SIGNAL_DETECTION_CRON_SCHEDULE') || '0 0 */6 * * *';
    this.daysBack = parseInt(this.configService.get<string>('WEAK_SIGNAL_DETECTION_DAYS_BACK') || '90', 10);
    this.deduplicationHours = parseInt(this.configService.get<string>('WEAK_SIGNAL_DETECTION_DEDUPLICATION_HOURS') || '6', 10);

    this.logger.log(`Weak Signal Detection Scheduler initialized:`);
    this.logger.log(`- Enabled: ${this.isEnabled}`);
    this.logger.log(`- Schedule: ${this.cronSchedule}`);
    this.logger.log(`- Days Back: ${this.daysBack}`);
    this.logger.log(`- Deduplication Hours: ${this.deduplicationHours}`);
  }

  /**
   * Initialize the dynamic cron job when the module loads
   */
  onModuleInit() {
    if (!this.isEnabled) {
      this.logger.log('Weak signal detection cron job is disabled');
      return;
    }

    try {
      const job = new CronJob(this.cronSchedule, () => {
        this.runScheduledDetection();
      });

      this.schedulerRegistry.addCronJob('weak-signal-detection', job);
      job.start();

      this.logger.log(`Weak signal detection cron job started with schedule: ${this.cronSchedule}`);
    } catch (error) {
      this.logger.error(`Failed to start weak signal detection cron job: ${error.message}`, error.stack);
    }
  }

  /**
   * Run weak signal detection on a schedule
   * Uses dynamic cron expression from environment variable
   */
  async runScheduledDetection() {
    this.logger.log('Starting scheduled weak signal detection for all tenants');

    try {
      // Get all active tenants
      const tenants = await this.tenantRepository.find({
        where: { isActive: true },
      });

      this.logger.log(`Found ${tenants.length} active tenants to process`);

      // Process each tenant
      for (const tenant of tenants) {
        try {
          await this.runDetectionForTenant(tenant.id);
        } catch (error) {
          this.logger.error(`Failed to run detection for tenant ${tenant.id}: ${error.message}`, error.stack);
        }
      }

      this.logger.log('Scheduled weak signal detection completed for all tenants');
    } catch (error) {
      this.logger.error(`Failed to run scheduled detection: ${error.message}`, error.stack);
    }
  }

  /**
   * Run detection for a specific tenant with deduplication
   */
  async runDetectionForTenant(tenantId: number): Promise<DetectionRun | null> {
    this.logger.log(`Starting weak signal detection for tenant ${tenantId}`);

    // Check for recent runs to prevent duplicate analysis
    const shouldRun = await this.shouldRunDetection(tenantId);
    if (!shouldRun) {
      this.logger.log(`Skipping detection for tenant ${tenantId} - recent run found within deduplication window`);

      // Return the most recent run
      const recentRun = await this.detectionRunRepository.findOne({
        where: {
          tenantId,
          status: 'completed',
        },
        order: { completedAt: 'DESC' },
      });

      return recentRun || null;
    }

    const startTime = Date.now();
    const startedAt = new Date();

    // Create detection run record
    const detectionRun = this.detectionRunRepository.create({
      tenantId,
      status: 'running',
      startedAt,
      daysAnalyzed: this.daysBack,
      detectionSummary: {
        byType: {},
        bySeverity: {},
        bySource: {},
      },
    });

    await this.detectionRunRepository.save(detectionRun);

    try {
      // Run weak signal detection
      this.logger.log(`Running weak signal detection for tenant ${tenantId} (${this.daysBack} days back)`);
      const signals = await this.detectionService.detectWeakSignals(tenantId, this.daysBack);

      this.logger.log(`Detected ${signals.length} weak signals for tenant ${tenantId}`);

      // Generate hypotheses for new critical and high severity signals
      let hypothesesCount = 0;
      const criticalAndHighSignals = signals.filter(s => ['critical', 'high'].includes(s.severity));

      this.logger.log(`Generating hypotheses for ${criticalAndHighSignals.length} critical/high severity signals`);

      for (const signal of criticalAndHighSignals) {
        try {
          const hypotheses = await this.hypothesisService.generateHypothesesForSignal(tenantId, signal.id);
          hypothesesCount += hypotheses.length;
        } catch (error) {
          this.logger.error(`Failed to generate hypotheses for signal ${signal.id}: ${error.message}`);
        }
      }

      // Calculate summary statistics
      const detectionSummary = this.calculateDetectionSummary(signals);

      // Mark run as completed
      detectionRun.status = 'completed';
      detectionRun.completedAt = new Date();
      detectionRun.signalsDetected = signals.length;
      detectionRun.hypothesesGenerated = hypothesesCount;
      detectionRun.detectionSummary = detectionSummary;
      detectionRun.durationMs = Date.now() - startTime;

      await this.detectionRunRepository.save(detectionRun);

      this.logger.log(
        `Weak signal detection completed for tenant ${tenantId}: ` +
        `${signals.length} signals, ${hypothesesCount} hypotheses, ` +
        `duration: ${detectionRun.durationMs}ms`
      );

      return detectionRun;
    } catch (error) {
      // Mark run as failed
      detectionRun.status = 'failed';
      detectionRun.completedAt = new Date();
      detectionRun.errorMessage = error.message;
      detectionRun.durationMs = Date.now() - startTime;

      await this.detectionRunRepository.save(detectionRun);

      this.logger.error(`Weak signal detection failed for tenant ${tenantId}: ${error.message}`, error.stack);

      throw error;
    }
  }

  /**
   * Check if detection should run based on deduplication window
   */
  private async shouldRunDetection(tenantId: number): Promise<boolean> {
    const deduplicationThreshold = new Date();
    deduplicationThreshold.setHours(deduplicationThreshold.getHours() - this.deduplicationHours);

    // Check for any completed runs within the deduplication window
    const recentRun = await this.detectionRunRepository.findOne({
      where: {
        tenantId,
        status: 'completed',
        completedAt: MoreThan(deduplicationThreshold),
      },
      order: { completedAt: 'DESC' },
    });

    // If there's a recent run, skip
    if (recentRun) {
      this.logger.debug(
        `Found recent detection run for tenant ${tenantId} completed at ${recentRun.completedAt}`
      );
      return false;
    }

    // Check for any running jobs
    const runningJob = await this.detectionRunRepository.findOne({
      where: {
        tenantId,
        status: 'running',
      },
      order: { startedAt: 'DESC' },
    });

    if (runningJob) {
      // Check if the running job is stale (more than 1 hour old)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      if (runningJob.startedAt < oneHourAgo) {
        this.logger.warn(
          `Found stale running detection job for tenant ${tenantId}, will mark as failed and start new run`
        );

        runningJob.status = 'failed';
        runningJob.completedAt = new Date();
        runningJob.errorMessage = 'Job marked as stale and failed';
        await this.detectionRunRepository.save(runningJob);

        return true;
      }

      this.logger.debug(`Found active running detection job for tenant ${tenantId}`);
      return false;
    }

    return true;
  }

  /**
   * Calculate summary statistics from detected signals
   */
  private calculateDetectionSummary(signals: WeakSignal[]): {
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
  } {
    const summary = {
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };

    for (const signal of signals) {
      // Count by type
      summary.byType[signal.signalType] = (summary.byType[signal.signalType] || 0) + 1;

      // Count by severity
      summary.bySeverity[signal.severity] = (summary.bySeverity[signal.severity] || 0) + 1;

      // Count by source (from sourceSignals)
      for (const sourceSignal of signal.sourceSignals) {
        summary.bySource[sourceSignal.source] = (summary.bySource[sourceSignal.source] || 0) + 1;
      }
    }

    return summary;
  }

  /**
   * Get recent detection runs for a tenant
   */
  async getRecentRuns(tenantId: number, limit: number = 10): Promise<DetectionRun[]> {
    return this.detectionRunRepository.find({
      where: { tenantId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get detection run statistics for a tenant
   */
  async getDetectionStats(tenantId: number): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalSignalsDetected: number;
    totalHypothesesGenerated: number;
    lastRunAt: Date | null;
    averageDurationMs: number;
  }> {
    const runs = await this.detectionRunRepository.find({
      where: { tenantId },
    });

    const stats = {
      totalRuns: runs.length,
      successfulRuns: runs.filter(r => r.status === 'completed').length,
      failedRuns: runs.filter(r => r.status === 'failed').length,
      totalSignalsDetected: runs.reduce((sum, r) => sum + r.signalsDetected, 0),
      totalHypothesesGenerated: runs.reduce((sum, r) => sum + r.hypothesesGenerated, 0),
      lastRunAt: runs.length > 0 ? runs[0].startedAt : null,
      averageDurationMs: runs.length > 0
        ? runs.filter(r => r.durationMs !== null).reduce((sum, r) => sum + (r.durationMs || 0), 0) / runs.filter(r => r.durationMs !== null).length
        : 0,
    };

    return stats;
  }
}
