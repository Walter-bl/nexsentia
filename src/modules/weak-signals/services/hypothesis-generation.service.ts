import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hypothesis, HypothesisType } from '../entities/hypothesis.entity';
import { WeakSignal } from '../entities/weak-signal.entity';
import { MetricValue } from '../../kpi/entities/metric-value.entity';
import { TimelineEvent } from '../../timeline/entities/timeline-event.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HypothesisGenerationService {
  private readonly logger = new Logger(HypothesisGenerationService.name);

  constructor(
    @InjectRepository(Hypothesis)
    private readonly hypothesisRepository: Repository<Hypothesis>,
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
    @InjectRepository(MetricValue)
    private readonly metricValueRepository: Repository<MetricValue>,
    @InjectRepository(TimelineEvent)
    private readonly timelineEventRepository: Repository<TimelineEvent>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate hypotheses for a weak signal
   */
  async generateHypothesesForSignal(tenantId: number, signalId: number): Promise<Hypothesis[]> {
    this.logger.log(`Generating hypotheses for weak signal ${signalId}`);

    const signal = await this.weakSignalRepository.findOne({
      where: { id: signalId, tenantId },
    });

    if (!signal) {
      throw new Error('Weak signal not found');
    }

    // Assemble context for the signal
    const context = await this.assembleContext(tenantId, signal);

    // Generate multiple hypothesis types
    const hypotheses: Hypothesis[] = [];

    // Generate correlation hypothesis
    const correlationHypothesis = await this.generateCorrelationHypothesis(tenantId, signal, context);
    if (correlationHypothesis) hypotheses.push(correlationHypothesis);

    // Generate pattern explanation hypothesis
    const explanationHypothesis = await this.generatePatternExplanationHypothesis(tenantId, signal, context);
    if (explanationHypothesis) hypotheses.push(explanationHypothesis);

    // Generate prediction hypothesis
    const predictionHypothesis = await this.generatePredictionHypothesis(tenantId, signal, context);
    if (predictionHypothesis) hypotheses.push(predictionHypothesis);

    // Save all hypotheses - save them one by one to isolate errors
    const savedHypotheses: Hypothesis[] = [];
    for (const hypothesis of hypotheses) {
      try {
        // Remove any circular references or undefined values
        delete (hypothesis as any).weakSignal;

        const saved = await this.hypothesisRepository.save(hypothesis);
        savedHypotheses.push(saved);
      } catch (error) {
        this.logger.error(`Failed to save hypothesis of type ${hypothesis.hypothesisType}: ${error.message}`);
        // Continue with other hypotheses even if one fails
      }
    }

    this.logger.log(`Generated ${savedHypotheses.length} hypotheses for signal ${signalId}`);
    return savedHypotheses;
  }

  /**
   * Get hypotheses for a tenant
   */
  async getHypotheses(
    tenantId: number,
    options?: {
      weakSignalId?: number;
      status?: string;
      minConfidence?: number;
      limit?: number;
    }
  ): Promise<Hypothesis[]> {
    const queryBuilder = this.hypothesisRepository
      .createQueryBuilder('hypothesis')
      .leftJoinAndSelect('hypothesis.weakSignal', 'weakSignal')
      .where('hypothesis.tenantId = :tenantId', { tenantId })
      .orderBy('hypothesis.generatedAt', 'DESC');

    if (options?.weakSignalId) {
      queryBuilder.andWhere('hypothesis.weakSignalId = :weakSignalId', { weakSignalId: options.weakSignalId });
    }

    if (options?.status) {
      queryBuilder.andWhere('hypothesis.status = :status', { status: options.status });
    }

    if (options?.minConfidence) {
      queryBuilder.andWhere('hypothesis.confidence >= :minConfidence', { minConfidence: options.minConfidence });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    return await queryBuilder.getMany();
  }

  /**
   * Get hypotheses for a specific weak signal
   */
  async getHypothesesBySignal(tenantId: number, weakSignalId: number): Promise<Hypothesis[]> {
    return this.getHypotheses(tenantId, { weakSignalId });
  }

  /**
   * Assemble context for hypothesis generation
   */
  private async assembleContext(tenantId: number, signal: WeakSignal): Promise<Hypothesis['context']> {
    const context: Hypothesis['context'] = {
      signals: [],
      metrics: [],
      timeline: [],
      graphContext: {
        nodes: [],
        relationships: [],
        clusters: [],
      },
    };

    // Add the current signal
    context.signals.push({
      id: signal.id.toString(),
      type: signal.signalType,
      description: signal.description || signal.title,
      timestamp: signal.detectedAt.toISOString(),
    });

    // Get related signals (same category or type)
    const whereClause: any = { tenantId };
    if (signal.category) {
      whereClause.category = signal.category;
    }

    const relatedSignals = await this.weakSignalRepository.find({
      where: whereClause,
      take: 5,
      order: { detectedAt: 'DESC' },
    });

    for (const related of relatedSignals) {
      if (related.id !== signal.id) {
        context.signals.push({
          id: related.id.toString(),
          type: related.signalType,
          description: related.description || related.title,
          timestamp: related.detectedAt.toISOString(),
        });
      }
    }

    // Get recent metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const recentMetrics = await this.metricValueRepository.find({
        where: {
          tenantId,
        },
        order: { periodStart: 'DESC' },
        take: 20,
      });

      for (const metricValue of recentMetrics) {
        if (metricValue && metricValue.value != null) {
          context.metrics.push({
            key: `metric_${metricValue.metricDefinitionId || 'unknown'}`,
            value: metricValue.value,
            trend: 'stable', // Would calculate actual trend
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to load metrics for context: ${error.message}`);
      // Continue without metrics
    }

    // Get recent timeline events
    const recentEvents = await this.timelineEventRepository.find({
      where: {
        tenantId,
        isActive: true,
      },
      take: 10,
      order: { eventDate: 'DESC' },
    });

    for (const event of recentEvents) {
      context.timeline.push({
        eventId: event.id.toString(),
        title: event.title,
        timestamp: event.eventDate.toISOString(),
        impact: event.impactLevel,
      });
    }

    // Build graph context (simplified)
    context.graphContext.nodes = [
      ...context.signals.map(s => `signal:${s.id}`),
      ...context.metrics.map(m => `metric:${m.key}`),
      ...context.timeline.map(t => `event:${t.eventId}`),
    ];

    context.graphContext.relationships = [
      `signal:${signal.id} -> category:${signal.category}`,
    ];

    context.graphContext.clusters = [signal.category || 'Unknown'];

    return context;
  }

  /**
   * Generate correlation hypothesis using LLM reasoning
   */
  private async generateCorrelationHypothesis(
    tenantId: number,
    signal: WeakSignal,
    context: Hypothesis['context']
  ): Promise<Hypothesis | null> {
    const hypothesis = new Hypothesis();

    hypothesis.tenantId = tenantId;
    hypothesis.weakSignalId = signal.id;
    hypothesis.weakSignal = null; // Don't set the relation, only the ID
    hypothesis.hypothesisType = 'correlation';

    // Build hypothesis using LLM-style reasoning (simulated)
    const correlations = this.findCorrelations(signal, context);

    if (correlations.length === 0) {
      return null;
    }

    const hypothesisText = this.buildCorrelationHypothesisText(signal, correlations);

    hypothesis.hypothesis = hypothesisText;
    hypothesis.confidence = this.calculateCorrelationConfidence(correlations);
    hypothesis.status = 'generated';
    hypothesis.context = context;

    // Build reasoning chain
    hypothesis.reasoning = {
      modelUsed: 'correlation-analyzer-v1',
      promptTemplate: 'Analyze temporal and categorical correlations between signals',
      reasoningSteps: [
        {
          step: 1,
          thought: 'Analyzing temporal proximity of signals',
          evidence: [`Found ${correlations.length} temporally correlated signals`],
          conclusion: 'Signals show temporal correlation',
        },
        {
          step: 2,
          thought: 'Examining categorical relationships',
          evidence: [`Signals share category: ${signal.category}`],
          conclusion: 'Category-based correlation detected',
        },
        {
          step: 3,
          thought: 'Evaluating correlation strength',
          evidence: correlations.map(c => c.description),
          conclusion: `${correlations.length} strong correlations identified`,
        },
      ],
      alternatives: [
        'Signals may be coincidental rather than causally related',
        'Correlation may be due to common underlying factor not yet identified',
      ],
      limitations: [
        'Correlation does not imply causation',
        'Limited historical data may affect accuracy',
        'External factors not captured in current data',
      ],
    };

    // Supporting evidence
    hypothesis.supportingEvidence = correlations.map(c => ({
      type: 'temporal_correlation',
      description: c.description,
      strength: c.strength,
      source: c.source,
      timestamp: c.timestamp,
    }));

    hypothesis.contradictingEvidence = null;

    // Guardrails - prevent root cause claims
    hypothesis.guardrails = {
      notClaimingRootCause: true,
      disclaimers: [
        'This hypothesis identifies CORRELATION, not causation',
        'Further investigation required to establish causal relationships',
        'Multiple factors may contribute to observed patterns',
      ],
      requiresValidation: [
        'Manual review of correlated events',
        'Analysis of intervening variables',
        'Controlled testing if possible',
      ],
      assumptions: [
        'Data quality is sufficient for correlation analysis',
        'Time windows are appropriate for the signals analyzed',
        'No significant data gaps in the analyzed period',
      ],
      limitations: [
        'Cannot determine causality from correlation alone',
        'May miss correlations outside analyzed time window',
        'Spurious correlations possible with limited data',
      ],
    };

    // Validation steps
    hypothesis.validationSteps = [
      {
        step: 1,
        action: 'Review temporal sequence of correlated events',
        expectedOutcome: 'Confirm time-based relationship',
        difficulty: 'easy',
      },
      {
        step: 2,
        action: 'Investigate common factors between correlated signals',
        expectedOutcome: 'Identify potential linking mechanisms',
        difficulty: 'medium',
      },
      {
        step: 3,
        action: 'Check for historical precedent of similar correlations',
        expectedOutcome: 'Determine if pattern is recurring',
        difficulty: 'medium',
      },
    ];

    // Predicted impact
    hypothesis.predictedImpact = {
      severity: signal.severity,
      affectedAreas: (signal.affectedEntities || []).map(e => e?.name || 'Unknown'),
      estimatedTimeToEscalation: null, // Could be calculated based on trend acceleration
      potentialConsequences: [
        'Continued occurrence of correlated events',
        'Possible escalation if pattern persists',
        'Resource allocation may need adjustment',
      ],
      mitigationSuggestions: [
        'Monitor correlated signals for changes',
        'Investigate common factors',
        'Consider preventive measures for recurring patterns',
      ],
    };

    hypothesis.generatedAt = new Date();

    return hypothesis;
  }

  /**
   * Generate pattern explanation hypothesis
   */
  private async generatePatternExplanationHypothesis(
    tenantId: number,
    signal: WeakSignal,
    context: Hypothesis['context']
  ): Promise<Hypothesis | null> {
    if (signal.signalType !== 'pattern_recurring') {
      return null;
    }

    const hypothesis = new Hypothesis();

    hypothesis.tenantId = tenantId;
    hypothesis.weakSignalId = signal.id;
    hypothesis.weakSignal = null; // Don't set the relation, only the ID
    hypothesis.hypothesisType = 'pattern_explanation';

    const explanations = this.generatePatternExplanations(signal, context);

    hypothesis.hypothesis = `The recurring pattern "${signal.title}" may be explained by: ${explanations.join(', ')}`;
    hypothesis.confidence = 65; // Lower confidence for explanations
    hypothesis.status = 'generated';
    hypothesis.context = context;

    hypothesis.reasoning = {
      modelUsed: 'pattern-explainer-v1',
      promptTemplate: 'Generate potential explanations for recurring patterns',
      reasoningSteps: [
        {
          step: 1,
          thought: 'Analyzing pattern characteristics',
          evidence: [
            `Frequency: ${signal.patternData?.frequency}`,
            `Occurrences: ${signal.patternData?.occurrences}`,
          ],
          conclusion: 'Pattern shows regular recurrence',
        },
        {
          step: 2,
          thought: 'Considering potential root causes',
          evidence: explanations,
          conclusion: 'Multiple potential explanations identified',
        },
      ],
      alternatives: explanations,
      limitations: [
        'Explanations are speculative and require validation',
        'Multiple factors may contribute simultaneously',
      ],
    };

    hypothesis.supportingEvidence = signal.sourceSignals.map(s => ({
      type: 'pattern_occurrence',
      description: `Occurrence from ${s.source}`,
      strength: s.relevanceScore,
      source: s.source,
      timestamp: s.timestamp,
    }));

    hypothesis.contradictingEvidence = null;

    hypothesis.guardrails = {
      notClaimingRootCause: true,
      disclaimers: [
        'These are POSSIBLE explanations, not confirmed root causes',
        'Multiple explanations may be valid simultaneously',
        'Requires empirical validation',
      ],
      requiresValidation: [
        'Test each explanation independently',
        'Gather additional evidence',
        'Consult domain experts',
      ],
      assumptions: [
        'Pattern is genuine and not data artifact',
        'Historical data is representative',
      ],
      limitations: [
        'Cannot prove causation without controlled testing',
        'May miss non-obvious explanations',
      ],
    };

    hypothesis.validationSteps = [
      {
        step: 1,
        action: 'Review each explanation for plausibility',
        expectedOutcome: 'Narrow down candidate explanations',
        difficulty: 'easy',
      },
      {
        step: 2,
        action: 'Investigate the most likely explanation first',
        expectedOutcome: 'Gather supporting or contradicting evidence',
        difficulty: 'medium',
      },
      {
        step: 3,
        action: 'Implement monitoring to test explanation validity',
        expectedOutcome: 'Confirm or refute explanation over time',
        difficulty: 'hard',
      },
    ];

    hypothesis.predictedImpact = {
      severity: signal.severity,
      affectedAreas: (signal.affectedEntities || []).map(e => e?.name || 'Unknown'),
      estimatedTimeToEscalation: null,
      potentialConsequences: [
        'Pattern likely to continue if root cause not addressed',
        'Impact may compound over time',
      ],
      mitigationSuggestions: [
        'Address most likely explanations first',
        'Implement preventive measures',
        'Monitor pattern for changes',
      ],
    };

    hypothesis.generatedAt = new Date();

    return hypothesis;
  }

  /**
   * Generate prediction hypothesis
   */
  private async generatePredictionHypothesis(
    tenantId: number,
    signal: WeakSignal,
    context: Hypothesis['context']
  ): Promise<Hypothesis | null> {
    if (!signal.trendData && !signal.patternData) {
      return null;
    }

    const hypothesis = new Hypothesis();

    hypothesis.tenantId = tenantId;
    hypothesis.weakSignalId = signal.id;
    hypothesis.weakSignal = null; // Don't set the relation, only the ID
    hypothesis.hypothesisType = 'prediction';

    const prediction = this.generatePrediction(signal);

    hypothesis.hypothesis = prediction.text;
    hypothesis.confidence = prediction.confidence;
    hypothesis.status = 'generated';
    hypothesis.context = context;

    hypothesis.reasoning = {
      modelUsed: 'trend-predictor-v1',
      promptTemplate: 'Predict future trajectory based on historical patterns and trends',
      reasoningSteps: prediction.steps,
      alternatives: prediction.alternatives,
      limitations: [
        'Predictions assume current trends continue',
        'Unexpected events may invalidate predictions',
        'Confidence decreases with prediction horizon',
      ],
    };

    hypothesis.supportingEvidence = [
      {
        type: 'historical_trend',
        description: 'Historical trend data supports prediction',
        strength: 75,
        source: 'trend_analysis',
        timestamp: new Date().toISOString(),
      },
    ];

    hypothesis.contradictingEvidence = null;

    hypothesis.guardrails = {
      notClaimingRootCause: true,
      disclaimers: [
        'This is a PREDICTION based on current trends, not a certainty',
        'Actual outcomes may differ significantly',
        'Predictions are probabilistic, not deterministic',
      ],
      requiresValidation: [
        'Monitor actual vs predicted outcomes',
        'Update predictions as new data arrives',
        'Validate underlying assumptions',
      ],
      assumptions: prediction.assumptions,
      limitations: [
        'Cannot account for unknown future events',
        'Accuracy decreases over longer time horizons',
        'May not capture non-linear dynamics',
      ],
    };

    hypothesis.validationSteps = [
      {
        step: 1,
        action: 'Set up monitoring for predicted outcome',
        expectedOutcome: 'Track prediction accuracy',
        difficulty: 'easy',
      },
      {
        step: 2,
        action: 'Review prediction monthly and adjust as needed',
        expectedOutcome: 'Improved prediction accuracy',
        difficulty: 'medium',
      },
      {
        step: 3,
        action: 'Implement early warning system',
        expectedOutcome: 'Early detection if trend diverges',
        difficulty: 'medium',
      },
    ];

    hypothesis.predictedImpact = {
      severity: this.predictFutureSeverity(signal),
      affectedAreas: (signal.affectedEntities || []).map(e => e?.name || 'Unknown'),
      estimatedTimeToEscalation: prediction.timeframe,
      potentialConsequences: prediction.consequences,
      mitigationSuggestions: prediction.mitigations,
    };

    hypothesis.generatedAt = new Date();

    return hypothesis;
  }

  /**
   * Find correlations between signals
   */
  private findCorrelations(signal: WeakSignal, context: Hypothesis['context']): Array<{
    description: string;
    strength: number;
    source: string;
    timestamp: string;
  }> {
    const correlations: Array<{ description: string; strength: number; source: string; timestamp: string }> = [];

    // Temporal correlations
    const signalTime = signal.detectedAt.getTime();
    for (const contextSignal of context.signals) {
      if (contextSignal.id === signal.id.toString()) continue;

      const contextTime = new Date(contextSignal.timestamp).getTime();
      const timeDiff = Math.abs(signalTime - contextTime);
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 48) {
        correlations.push({
          description: `Signal "${contextSignal.description.substring(0, 50)}" occurred within 48 hours`,
          strength: Math.max(50, 100 - hoursDiff),
          source: contextSignal.type,
          timestamp: contextSignal.timestamp,
        });
      }
    }

    return correlations;
  }

  /**
   * Build correlation hypothesis text
   */
  private buildCorrelationHypothesisText(signal: WeakSignal, correlations: any[]): string {
    return `The signal "${signal.title}" shows correlation with ${correlations.length} other signals. ` +
      `This suggests a potential relationship between these events, though the nature of the relationship ` +
      `(causal, coincidental, or due to common factors) requires further investigation.`;
  }

  /**
   * Calculate correlation confidence
   */
  private calculateCorrelationConfidence(correlations: any[]): number {
    const baseConfidence = 50;
    const correlationBonus = Math.min(30, correlations.length * 10);
    const avgStrength = correlations.reduce((sum, c) => sum + c.strength, 0) / correlations.length;
    const strengthBonus = (avgStrength - 50) / 5;

    return Math.min(95, baseConfidence + correlationBonus + strengthBonus);
  }

  /**
   * Generate pattern explanations
   */
  private generatePatternExplanations(signal: WeakSignal, context: Hypothesis['context']): string[] {
    const explanations: string[] = [];

    if (signal.patternData?.frequency === 'daily') {
      explanations.push('Scheduled processes or jobs running daily');
      explanations.push('Daily workload patterns');
    } else if (signal.patternData?.frequency === 'weekly') {
      explanations.push('Weekly maintenance windows');
      explanations.push('Weekly deployment cycles');
    } else if (signal.patternData?.frequency === 'monthly') {
      explanations.push('Monthly reporting processes');
      explanations.push('End-of-month activities');
    }

    if (signal.category === 'Engineering') {
      explanations.push('Technical debt or architectural issues');
      explanations.push('Inadequate error handling or monitoring');
    } else if (signal.category === 'Operations') {
      explanations.push('Infrastructure capacity constraints');
      explanations.push('Configuration drift');
    }

    return explanations.slice(0, 3);
  }

  /**
   * Generate prediction
   */
  private generatePrediction(signal: WeakSignal): {
    text: string;
    confidence: number;
    steps: any[];
    alternatives: string[];
    assumptions: string[];
    timeframe: string | null;
    consequences: string[];
    mitigations: string[];
  } {
    let text = '';
    let confidence = 60;
    const steps: any[] = [];
    const alternatives: string[] = [];
    const assumptions: string[] = [];
    let timeframe: string | null = null;
    const consequences: string[] = [];
    const mitigations: string[] = [];

    if (signal.trendData) {
      const direction = signal.trendData.changeRate > 0 ? 'increase' : 'decrease';
      text = `Based on current acceleration (${signal.trendData.accelerationFactor.toFixed(1)}x), ` +
        `the metric "${signal.trendData.metric}" is predicted to ${direction} by approximately ` +
        `${Math.abs(signal.trendData.changeRate * 2).toFixed(1)}% over the next 30 days if trends continue.`;

      confidence = 70;

      steps.push({
        step: 1,
        thought: 'Analyzing current trend acceleration',
        evidence: [`Acceleration factor: ${signal.trendData.accelerationFactor.toFixed(1)}x`],
        conclusion: 'Trend is accelerating significantly',
      });

      assumptions.push('Current trend will continue without intervention');
      assumptions.push('No major external changes will occur');

      timeframe = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      consequences.push('Continued degradation of the metric');
      consequences.push('Potential system impact if unchecked');

      mitigations.push('Implement early intervention measures');
      mitigations.push('Monitor closely for trend changes');
    } else if (signal.patternData?.predictedNext) {
      text = `Based on the ${signal.patternData.frequency} recurrence pattern, the next occurrence is ` +
        `predicted around ${new Date(signal.patternData.predictedNext).toLocaleDateString()}.`;

      confidence = 65;

      steps.push({
        step: 1,
        thought: 'Analyzing recurrence pattern',
        evidence: [`${signal.patternData.occurrences} occurrences with ${signal.patternData.frequency} frequency`],
        conclusion: 'Pattern shows regular recurrence',
      });

      assumptions.push('Pattern will continue as observed');
      assumptions.push('No changes to underlying causes');

      timeframe = signal.patternData.predictedNext;

      consequences.push('Similar impact as previous occurrences');
      consequences.push('Potential for escalation if not addressed');

      mitigations.push('Proactive monitoring before predicted date');
      mitigations.push('Prepare response procedures');
    }

    alternatives.push('Trend may stabilize before predicted outcome');
    alternatives.push('External interventions may alter trajectory');

    return {
      text,
      confidence,
      steps,
      alternatives,
      assumptions,
      timeframe,
      consequences,
      mitigations,
    };
  }

  /**
   * Predict future severity
   */
  private predictFutureSeverity(signal: WeakSignal): string {
    if (signal.severity === 'critical') return 'critical';
    if (signal.severity === 'high') return 'critical';
    if (signal.severity === 'medium') return 'high';
    return 'medium';
  }
}
