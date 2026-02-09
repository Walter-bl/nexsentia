import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeakSignal, SignalType, SignalSeverity } from '../entities/weak-signal.entity';
import { PatternExtractionService, RecurringPattern } from './pattern-extraction.service';
import { TrendAccelerationService, TrendAcceleration } from './trend-acceleration.service';

@Injectable()
export class WeakSignalDetectionService {
  private readonly logger = new Logger(WeakSignalDetectionService.name);

  constructor(
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
    private readonly patternExtractionService: PatternExtractionService,
    private readonly trendAccelerationService: TrendAccelerationService,
  ) {}

  /**
   * Detect all weak signals for a tenant
   */
  async detectWeakSignals(tenantId: number, daysBack: number = 90): Promise<WeakSignal[]> {
    this.logger.log(`Starting weak signal detection for tenant ${tenantId}`);

    // Run pattern extraction and trend detection in parallel
    const [patterns, accelerations] = await Promise.all([
      this.patternExtractionService.extractRecurringPatterns(tenantId, daysBack),
      this.trendAccelerationService.detectTrendAccelerations(tenantId, Math.min(daysBack, 30)),
    ]);

    this.logger.log(`Found ${patterns.length} patterns and ${accelerations.length} accelerations`);

    const signals: WeakSignal[] = [];

    // Convert patterns to weak signals
    for (const pattern of patterns) {
      const signal = await this.createWeakSignalFromPattern(tenantId, pattern);
      signals.push(signal);
    }

    // Convert accelerations to weak signals
    for (const acceleration of accelerations) {
      const signal = await this.createWeakSignalFromAcceleration(tenantId, acceleration);
      signals.push(signal);
    }

    // Save all signals
    const savedSignals = await this.weakSignalRepository.save(signals);

    this.logger.log(`Detected and saved ${savedSignals.length} weak signals`);

    return savedSignals;
  }

  /**
   * Get weak signals for a tenant with filtering
   */
  async getWeakSignals(
    tenantId: number,
    options?: {
      signalType?: SignalType;
      severity?: SignalSeverity;
      status?: string;
      minConfidence?: number;
      limit?: number;
    }
  ): Promise<WeakSignal[]> {
    const queryBuilder = this.weakSignalRepository
      .createQueryBuilder('signal')
      .where('signal.tenantId = :tenantId', { tenantId })
      .orderBy('signal.detectedAt', 'DESC');

    if (options?.signalType) {
      queryBuilder.andWhere('signal.signalType = :signalType', { signalType: options.signalType });
    }

    if (options?.severity) {
      queryBuilder.andWhere('signal.severity = :severity', { severity: options.severity });
    }

    if (options?.status) {
      queryBuilder.andWhere('signal.status = :status', { status: options.status });
    }

    if (options?.minConfidence) {
      queryBuilder.andWhere('signal.confidenceScore >= :minConfidence', { minConfidence: options.minConfidence });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    return await queryBuilder.getMany();
  }

  /**
   * Get a single weak signal by ID
   */
  async getWeakSignalById(tenantId: number, id: number): Promise<WeakSignal | null> {
    return await this.weakSignalRepository.findOne({
      where: { id, tenantId },
    });
  }

  /**
   * Update weak signal status
   */
  async updateWeakSignalStatus(
    tenantId: number,
    id: number,
    status: string,
    userId?: number,
    notes?: string
  ): Promise<WeakSignal> {
    const signal = await this.getWeakSignalById(tenantId, id);
    if (!signal) {
      throw new Error('Weak signal not found');
    }

    signal.status = status as any;

    if (status === 'validated' || status === 'escalated') {
      if (status === 'validated') {
        signal.validatedAt = new Date();
        signal.validatedBy = userId || null;
      }
      if (status === 'escalated') {
        signal.escalatedAt = new Date();
      }
    }

    if (notes) {
      signal.investigationNotes = notes;
    }

    return await this.weakSignalRepository.save(signal);
  }

  /**
   * Create weak signal from recurring pattern
   */
  private async createWeakSignalFromPattern(tenantId: number, pattern: RecurringPattern): Promise<WeakSignal> {
    const signal = new WeakSignal();

    signal.tenantId = tenantId;
    signal.signalType = 'pattern_recurring';
    signal.title = this.generatePatternTitle(pattern);
    signal.description = pattern.description;
    signal.severity = this.calculateSeverityFromPattern(pattern);
    signal.confidenceScore = Number(pattern.confidenceScore);
    signal.status = 'new';

    signal.sourceSignals = pattern.evidence.map(e => ({
      source: e.source,
      sourceId: e.sourceId,
      timestamp: e.timestamp.toISOString(),
      relevanceScore: e.relevanceScore,
    }));

    signal.patternData = {
      occurrences: Number(pattern.occurrences),
      frequency: pattern.frequency,
      lastOccurrence: pattern.lastOccurrence.toISOString(),
      predictedNext: pattern.predictedNext ? pattern.predictedNext.toISOString() : null,
      similarities: pattern.similarities,
    };

    signal.trendData = null;

    signal.explainability = this.generatePatternExplainability(pattern);

    signal.affectedEntities = this.extractAffectedEntities(pattern.evidence);

    signal.category = this.categorizePattern(pattern.type);

    signal.metadata = {
      patternId: pattern.patternId,
      patternType: pattern.type,
    };

    signal.detectedAt = new Date();

    return signal;
  }

  /**
   * Create weak signal from trend acceleration
   */
  private async createWeakSignalFromAcceleration(tenantId: number, acceleration: TrendAcceleration): Promise<WeakSignal> {
    const signal = new WeakSignal();

    signal.tenantId = tenantId;
    signal.signalType = 'trend_acceleration';
    signal.title = this.generateAccelerationTitle(acceleration);
    signal.description = acceleration.description;
    signal.severity = acceleration.severity;
    signal.confidenceScore = Number(acceleration.confidenceScore);
    signal.status = 'new';

    signal.sourceSignals = acceleration.evidence.map((e, index) => ({
      source: e.source,
      sourceId: `${e.source}_${index}`,
      timestamp: e.timestamp.toISOString(),
      relevanceScore: 85,
    }));

    signal.patternData = null;

    signal.trendData = {
      metric: acceleration.metric,
      baseline: Number(acceleration.baseline),
      current: Number(acceleration.current),
      changeRate: Number(acceleration.changeRate),
      accelerationFactor: Number(acceleration.accelerationFactor),
      timeWindow: acceleration.timeWindow,
    };

    signal.explainability = this.generateAccelerationExplainability(acceleration);

    signal.affectedEntities = this.extractAffectedEntitiesFromMetric(acceleration.metricKey);

    signal.category = this.categorizeMetric(acceleration.metricKey);

    signal.metadata = {
      accelerationId: acceleration.accelerationId,
      predictedEscalationTime: acceleration.predictedEscalationTime?.toISOString(),
    };

    signal.detectedAt = new Date();

    return signal;
  }

  /**
   * Generate explainability for pattern
   */
  private generatePatternExplainability(pattern: RecurringPattern): WeakSignal['explainability'] {
    const primaryReason = `Detected ${pattern.occurrences} similar occurrences with ${pattern.frequency} frequency`;

    const contributingFactors: string[] = [];
    contributingFactors.push(`Pattern occurs approximately ${pattern.frequency}`);
    contributingFactors.push(`${pattern.occurrences} instances found in data`);
    if (pattern.predictedNext) {
      contributingFactors.push(`Predicted next occurrence: ${pattern.predictedNext.toLocaleDateString()}`);
    }

    const evidencePoints = pattern.evidence.map(e => ({
      description: `${e.source} event at ${e.timestamp.toLocaleDateString()}`,
      weight: e.relevanceScore / 100,
      source: e.source,
    }));

    const riskIndicators: string[] = [];
    if (pattern.occurrences >= 5) {
      riskIndicators.push('High occurrence rate indicates systemic issue');
    }
    if (pattern.frequency === 'daily') {
      riskIndicators.push('Daily recurrence suggests urgent attention needed');
    }
    if (pattern.confidenceScore > 80) {
      riskIndicators.push('High confidence in pattern detection');
    }

    const contextualFactors: string[] = [];
    contextualFactors.push(`Pattern type: ${pattern.type}`);
    contextualFactors.push(`Detection confidence: ${pattern.confidenceScore.toFixed(1)}%`);

    return {
      primaryReason,
      contributingFactors,
      evidencePoints,
      riskIndicators,
      contextualFactors,
    };
  }

  /**
   * Generate explainability for acceleration
   */
  private generateAccelerationExplainability(acceleration: TrendAcceleration): WeakSignal['explainability'] {
    const primaryReason = `Metric accelerating ${Number(acceleration.accelerationFactor).toFixed(1)}x faster than baseline (${Number(acceleration.changeRate) > 0 ? '+' : ''}${Number(acceleration.changeRate).toFixed(1)}% change)`;

    const contributingFactors: string[] = [];
    contributingFactors.push(`Baseline value: ${Number(acceleration.baseline).toFixed(2)}`);
    contributingFactors.push(`Current value: ${Number(acceleration.current).toFixed(2)}`);
    contributingFactors.push(`Acceleration factor: ${Number(acceleration.accelerationFactor).toFixed(2)}x`);

    const evidencePoints = acceleration.evidence.slice(-10).map(e => ({
      description: `Value ${Number(e.value).toFixed(2)} on ${new Date(e.timestamp).toLocaleDateString()}`,
      weight: 0.8,
      source: e.source,
    }));

    const riskIndicators = [...acceleration.riskIndicators];

    const contextualFactors: string[] = [];
    contextualFactors.push(`Time window: ${acceleration.timeWindow}`);
    contextualFactors.push(`Severity: ${acceleration.severity}`);
    contextualFactors.push(`Confidence: ${Number(acceleration.confidenceScore).toFixed(1)}%`);

    return {
      primaryReason,
      contributingFactors,
      evidencePoints,
      riskIndicators,
      contextualFactors,
    };
  }

  /**
   * Calculate severity from pattern
   */
  private calculateSeverityFromPattern(pattern: RecurringPattern): SignalSeverity {
    let score = 0;

    // Occurrences weight
    if (pattern.occurrences >= 10) score += 3;
    else if (pattern.occurrences >= 5) score += 2;
    else if (pattern.occurrences >= 3) score += 1;

    // Frequency weight
    if (pattern.frequency === 'daily') score += 3;
    else if (pattern.frequency === 'weekly') score += 2;
    else if (pattern.frequency === 'monthly') score += 1;

    // Confidence weight
    if (pattern.confidenceScore > 85) score += 2;
    else if (pattern.confidenceScore > 70) score += 1;

    // Pattern type weight
    if (pattern.type === 'incident_recurrence' || pattern.type === 'issue_recurrence') score += 2;

    if (score >= 8) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  /**
   * Generate title for pattern
   */
  private generatePatternTitle(pattern: RecurringPattern): string {
    return `Recurring Pattern: ${pattern.type.replace(/_/g, ' ')} (${pattern.occurrences}x, ${pattern.frequency})`;
  }

  /**
   * Generate title for acceleration
   */
  private generateAccelerationTitle(acceleration: TrendAcceleration): string {
    return `Trend Acceleration: ${acceleration.metric} (${acceleration.accelerationFactor.toFixed(1)}x faster)`;
  }

  /**
   * Extract affected entities from evidence
   */
  private extractAffectedEntities(evidence: RecurringPattern['evidence']): WeakSignal['affectedEntities'] {
    const entities: WeakSignal['affectedEntities'] = [];
    const sources = [...new Set(evidence.map(e => e.source))];

    for (const source of sources) {
      entities.push({
        type: 'system',
        id: source,
        name: source.charAt(0).toUpperCase() + source.slice(1),
        impactLevel: 'medium',
      });
    }

    return entities;
  }

  /**
   * Extract affected entities from metric
   */
  private extractAffectedEntitiesFromMetric(metricKey: string): WeakSignal['affectedEntities'] {
    const entities: WeakSignal['affectedEntities'] = [];

    entities.push({
      type: 'metric',
      id: metricKey,
      name: metricKey.replace(/_/g, ' '),
      impactLevel: 'high',
    });

    // Add source-specific entity for proper identification in dashboard
    if (metricKey.includes('slack')) {
      entities.push({
        type: 'system',
        id: 'slack',
        name: 'Slack',
        impactLevel: 'medium',
      });
    } else if (metricKey.includes('teams')) {
      entities.push({
        type: 'system',
        id: 'teams',
        name: 'Teams',
        impactLevel: 'medium',
      });
    } else if (metricKey.includes('jira')) {
      entities.push({
        type: 'system',
        id: 'jira',
        name: 'Jira',
        impactLevel: 'medium',
      });
    } else if (metricKey.includes('servicenow')) {
      entities.push({
        type: 'system',
        id: 'servicenow',
        name: 'ServiceNow',
        impactLevel: 'medium',
      });
    }

    return entities;
  }

  /**
   * Categorize pattern type
   */
  private categorizePattern(patternType: RecurringPattern['type']): string {
    const categoryMap: Record<RecurringPattern['type'], string> = {
      issue_recurrence: 'Engineering',
      incident_recurrence: 'Operations',
      keyword_spike: 'Communication',
      temporal_pattern: 'Timeline',
    };

    return categoryMap[patternType] || 'General';
  }

  /**
   * Categorize metric
   */
  private categorizeMetric(metricKey: string): string {
    if (metricKey.includes('jira')) return 'Engineering';
    if (metricKey.includes('servicenow') || metricKey.includes('incident')) return 'Operations';
    if (metricKey.includes('slack') || metricKey.includes('teams') || metricKey.includes('communication')) return 'Communication';
    if (metricKey.includes('event')) return 'Timeline';
    return 'Metrics';
  }

  /**
   * Get statistics about weak signals
   */
  async getStatistics(tenantId: number): Promise<{
    total: number;
    byType: Record<SignalType, number>;
    bySeverity: Record<SignalSeverity, number>;
    byStatus: Record<string, number>;
    avgConfidence: number;
    recentSignals: number;
  }> {
    const signals = await this.weakSignalRepository.find({
      where: { tenantId },
    });

    const byType: Record<SignalType, number> = {
      pattern_recurring: 0,
      trend_acceleration: 0,
      anomaly_detection: 0,
      correlation_cluster: 0,
    };

    const bySeverity: Record<SignalSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byStatus: Record<string, number> = {};

    let totalConfidence = 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let recentSignals = 0;

    for (const signal of signals) {
      byType[signal.signalType]++;
      bySeverity[signal.severity]++;
      byStatus[signal.status] = (byStatus[signal.status] || 0) + 1;
      totalConfidence += Number(signal.confidenceScore);

      if (signal.detectedAt > sevenDaysAgo) {
        recentSignals++;
      }
    }

    return {
      total: signals.length,
      byType,
      bySeverity,
      byStatus,
      avgConfidence: signals.length > 0 ? totalConfidence / signals.length : 0,
      recentSignals,
    };
  }
}
