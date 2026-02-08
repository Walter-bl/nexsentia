import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { AlertRule } from '../entities/alert-rule.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { WeakSignal } from '../../weak-signals/entities/weak-signal.entity';
import { MetricValue } from '../../kpi/entities/metric-value.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';

interface EvaluationContext {
  tenantId: number;
  sourceType: string;
  sourceId: string;
  sourceData: any;
  timestamp: Date;
}

interface EvaluationResult {
  matched: boolean;
  rule: AlertRule;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

@Injectable()
export class AlertRuleEngineService {
  private readonly logger = new Logger(AlertRuleEngineService.name);

  constructor(
    @InjectRepository(AlertRule)
    private readonly ruleRepository: Repository<AlertRule>,
    @InjectRepository(AlertHistory)
    private readonly historyRepository: Repository<AlertHistory>,
    @InjectRepository(WeakSignal)
    private readonly weakSignalRepository: Repository<WeakSignal>,
    @InjectRepository(MetricValue)
    private readonly metricValueRepository: Repository<MetricValue>,
    @InjectRepository(ServiceNowIncident)
    private readonly incidentRepository: Repository<ServiceNowIncident>,
  ) {}

  /**
   * Evaluate all active rules against a given context
   */
  async evaluateRules(context: EvaluationContext): Promise<EvaluationResult[]> {
    const rules = await this.ruleRepository.find({
      where: {
        tenantId: context.tenantId,
        isActive: true,
        sourceType: context.sourceType as any,
      },
    });

    const results: EvaluationResult[] = [];

    for (const rule of rules) {
      try {
        const result = await this.evaluateRule(rule, context);
        if (result.matched) {
          results.push(result);
        }
      } catch (error) {
        this.logger.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Evaluate a single rule against context
   */
  private async evaluateRule(
    rule: AlertRule,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    let matched = false;
    let matchedConditions: string[] = [];

    switch (rule.ruleType) {
      case 'threshold':
        matched = await this.evaluateThresholdRule(rule, context, matchedConditions);
        break;
      case 'topic':
        matched = this.evaluateTopicRule(rule, context, matchedConditions);
        break;
      case 'pattern':
        matched = this.evaluatePatternRule(rule, context, matchedConditions);
        break;
      case 'anomaly':
        matched = await this.evaluateAnomalyRule(rule, context, matchedConditions);
        break;
    }

    if (matched) {
      const { title, message } = this.generateAlertContent(rule, context, matchedConditions);

      return {
        matched: true,
        rule,
        title,
        message,
        severity: rule.alertSeverity,
        metadata: {
          matchedConditions,
          ruleType: rule.ruleType,
          sourceData: context.sourceData,
        },
      };
    }

    return {
      matched: false,
      rule,
      title: '',
      message: '',
      severity: rule.alertSeverity,
    };
  }

  /**
   * Evaluate threshold-based rules
   */
  private async evaluateThresholdRule(
    rule: AlertRule,
    context: EvaluationContext,
    matchedConditions: string[],
  ): Promise<boolean> {
    if (!rule.thresholdConfig) return false;

    const { metric, operator, value, timeWindow, aggregation } = rule.thresholdConfig;

    // Get metric value based on aggregation
    let actualValue: number;

    if (timeWindow && aggregation) {
      // Aggregate over time window
      const windowStart = new Date(context.timestamp.getTime() - timeWindow * 60 * 1000);
      actualValue = await this.getAggregatedMetricValue(
        context.tenantId,
        metric || '',
        aggregation,
        windowStart,
        context.timestamp,
      );
    } else {
      // Use current value from context
      actualValue = this.extractMetricValue(context.sourceData, metric || '');
    }

    const matched = this.compareValues(actualValue, operator, value);

    if (matched) {
      matchedConditions.push(
        `${metric} ${operator} ${value} (actual: ${actualValue})`,
      );
    }

    return matched;
  }

  /**
   * Evaluate topic-based rules
   */
  private evaluateTopicRule(
    rule: AlertRule,
    context: EvaluationContext,
    matchedConditions: string[],
  ): boolean {
    if (!rule.topicConfig) return false;

    const { topics, matchType, severityLevels } = rule.topicConfig;

    // Extract topics from source data
    const sourceTopic = this.extractTopic(context.sourceData);
    const sourceSeverity = this.extractSeverity(context.sourceData);

    // Check severity filter
    if (severityLevels && severityLevels.length > 0) {
      if (!severityLevels.includes(sourceSeverity as any)) {
        return false;
      }
    }

    // Check topic matching
    const topicMatch =
      matchType === 'any'
        ? topics.some(topic => sourceTopic.includes(topic))
        : topics.every(topic => sourceTopic.includes(topic));

    if (topicMatch) {
      matchedConditions.push(`Topic matched: ${sourceTopic}`);
    }

    return topicMatch;
  }

  /**
   * Evaluate pattern-based rules
   */
  private evaluatePatternRule(
    rule: AlertRule,
    context: EvaluationContext,
    matchedConditions: string[],
  ): boolean {
    if (!rule.patternConfig) return false;

    const { keywords, matchType, caseSensitive, includeDescription } = rule.patternConfig;

    const content = this.extractContentForPatternMatch(context.sourceData, includeDescription);

    const matchedKeywords: string[] = [];

    for (const keyword of keywords) {
      const regex = new RegExp(
        caseSensitive ? keyword : keyword,
        caseSensitive ? 'g' : 'gi',
      );

      if (regex.test(content)) {
        matchedKeywords.push(keyword);
      }
    }

    const matched =
      matchType === 'any'
        ? matchedKeywords.length > 0
        : matchedKeywords.length === keywords.length;

    if (matched) {
      matchedConditions.push(`Keywords matched: ${matchedKeywords.join(', ')}`);
    }

    return matched;
  }

  /**
   * Evaluate anomaly detection rules
   */
  private async evaluateAnomalyRule(
    rule: AlertRule,
    context: EvaluationContext,
    matchedConditions: string[],
  ): Promise<boolean> {
    if (!rule.anomalyConfig) return false;

    const { metric, deviationThreshold, baselinePeriod, minDataPoints } = rule.anomalyConfig;

    // Get baseline data
    const baselineEnd = new Date(context.timestamp.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const baselineStart = new Date(baselineEnd.getTime() - baselinePeriod * 24 * 60 * 60 * 1000);

    const baselineValues = await this.getMetricValuesInRange(
      context.tenantId,
      metric,
      baselineStart,
      baselineEnd,
    );

    if (baselineValues.length < (minDataPoints || 5)) {
      this.logger.warn(`Insufficient data points for anomaly detection (rule ${rule.id})`);
      return false;
    }

    // Calculate mean and standard deviation
    const mean = baselineValues.reduce((sum, val) => sum + val, 0) / baselineValues.length;
    const variance =
      baselineValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      baselineValues.length;
    const stdDev = Math.sqrt(variance);

    // Get current value
    const currentValue = this.extractMetricValue(context.sourceData, metric);

    // Check if current value is anomalous
    const zScore = Math.abs((currentValue - mean) / stdDev);
    const matched = zScore > deviationThreshold;

    if (matched) {
      matchedConditions.push(
        `Anomaly detected: ${metric} = ${currentValue} (${zScore.toFixed(2)}σ from mean ${mean.toFixed(2)})`,
      );
    }

    return matched;
  }

  /**
   * Helper: Compare values based on operator
   */
  private compareValues(
    actual: number,
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=',
    expected: number,
  ): boolean {
    switch (operator) {
      case '>':
        return actual > expected;
      case '<':
        return actual < expected;
      case '>=':
        return actual >= expected;
      case '<=':
        return actual <= expected;
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      default:
        return false;
    }
  }

  /**
   * Helper: Get aggregated metric value over time window
   */
  private async getAggregatedMetricValue(
    tenantId: number,
    metric: string,
    aggregation: 'count' | 'avg' | 'sum' | 'min' | 'max',
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // For weak signals
    if (metric === 'signal_count') {
      const count = await this.weakSignalRepository.count({
        where: {
          tenantId,
          detectedAt: MoreThan(startDate),
        },
      });
      return count;
    }

    // For metrics
    const metricValues = await this.getMetricValuesInRange(
      tenantId,
      metric,
      startDate,
      endDate,
    );

    if (metricValues.length === 0) return 0;

    switch (aggregation) {
      case 'count':
        return metricValues.length;
      case 'avg':
        return metricValues.reduce((sum, val) => sum + val, 0) / metricValues.length;
      case 'sum':
        return metricValues.reduce((sum, val) => sum + val, 0);
      case 'min':
        return Math.min(...metricValues);
      case 'max':
        return Math.max(...metricValues);
      default:
        return 0;
    }
  }

  /**
   * Helper: Get metric values in a date range
   */
  private async getMetricValuesInRange(
    tenantId: number,
    metric: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number[]> {
    // This would query the MetricValue table
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Helper: Extract metric value from source data
   */
  private extractMetricValue(sourceData: any, metric: string): number {
    // Handle nested properties
    const keys = metric.split('.');
    let value = sourceData;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return 0;
      }
    }

    return typeof value === 'number' ? value : 0;
  }

  /**
   * Helper: Extract topic from source data
   */
  private extractTopic(sourceData: any): string {
    return sourceData.topic || sourceData.category || sourceData.theme || '';
  }

  /**
   * Helper: Extract severity from source data
   */
  private extractSeverity(sourceData: any): string {
    return sourceData.severity || sourceData.priority || 'medium';
  }

  /**
   * Helper: Extract content for pattern matching
   */
  private extractContentForPatternMatch(sourceData: any, includeDescription?: boolean): string {
    const parts: string[] = [];

    if (sourceData.title) parts.push(sourceData.title);
    if (sourceData.summary) parts.push(sourceData.summary);
    if (includeDescription && sourceData.description) parts.push(sourceData.description);
    if (sourceData.message) parts.push(sourceData.message);
    if (sourceData.content) parts.push(sourceData.content);

    return parts.join(' ');
  }

  /**
   * Helper: Generate alert title and message
   */
  private generateAlertContent(
    rule: AlertRule,
    context: EvaluationContext,
    matchedConditions: string[],
  ): { title: string; message: string } {
    const sourceName = context.sourceData.title || context.sourceData.summary || context.sourceType;

    const title = `[${rule.alertSeverity.toUpperCase()}] ${rule.name}`;

    const message = `
Alert Rule: ${rule.name}
Severity: ${rule.alertSeverity}
Source: ${context.sourceType}
Time: ${context.timestamp.toISOString()}

${rule.description || ''}

Matched Conditions:
${matchedConditions.map(c => `• ${c}`).join('\n')}

Details:
${JSON.stringify(context.sourceData, null, 2)}
    `.trim();

    return { title, message };
  }
}
