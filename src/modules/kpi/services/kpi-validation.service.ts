import { Injectable, Logger } from '@nestjs/common';
import { MetricDefinition } from '../entities/metric-definition.entity';
import { MetricValue } from '../entities/metric-value.entity';
import { BusinessImpact } from '../entities/business-impact.entity';

export interface ValidationResult {
  isValid: boolean;
  field: string;
  issues: Array<{
    type: 'out_of_range' | 'missing_data' | 'low_confidence' | 'stale_data' | 'anomaly';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
  }>;
}

export interface KpiHealthReport {
  overallHealthy: boolean;
  totalMetrics: number;
  healthyMetrics: number;
  warningMetrics: number;
  criticalMetrics: number;
  results: ValidationResult[];
  recommendations: string[];
}

@Injectable()
export class KpiValidationService {
  private readonly logger = new Logger(KpiValidationService.name);

  /**
   * Validate metric definition
   */
  validateMetricDefinition(metric: MetricDefinition): ValidationResult {
    const issues: ValidationResult['issues'] = [];

    // Check required fields
    if (!metric.calculation || !metric.calculation.sourceFields) {
      issues.push({
        type: 'missing_data',
        severity: 'critical',
        message: 'Metric calculation is missing required source fields',
      });
    }

    if (!metric.calculation.sourceTypes || metric.calculation.sourceTypes.length === 0) {
      issues.push({
        type: 'missing_data',
        severity: 'critical',
        message: 'Metric calculation is missing source types',
      });
    }

    // Check thresholds
    if (!metric.thresholds) {
      issues.push({
        type: 'missing_data',
        severity: 'medium',
        message: 'Metric is missing threshold definitions',
      });
    }

    // Validate aggregation type
    const validAggregations = ['sum', 'avg', 'min', 'max', 'count', 'median', 'percentile'];
    if (!validAggregations.includes(metric.aggregationType)) {
      issues.push({
        type: 'out_of_range',
        severity: 'high',
        message: `Invalid aggregation type: ${metric.aggregationType}`,
      });
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      field: metric.metricKey,
      issues,
    };
  }

  /**
   * Validate metric value
   */
  validateMetricValue(
    value: MetricValue,
    definition: MetricDefinition,
  ): ValidationResult {
    const issues: ValidationResult['issues'] = [];

    // Check data freshness
    const now = new Date();
    const valueAge = now.getTime() - value.createdAt.getTime();
    const maxAgeHours = 48; // 48 hours

    if (valueAge > maxAgeHours * 60 * 60 * 1000) {
      issues.push({
        type: 'stale_data',
        severity: 'medium',
        message: `Metric value is ${Math.floor(valueAge / (60 * 60 * 1000))} hours old`,
      });
    }

    // Check confidence level
    if (value.metadata?.confidence && value.metadata.confidence < 0.5) {
      issues.push({
        type: 'low_confidence',
        severity: 'high',
        message: `Low confidence score: ${value.metadata.confidence.toFixed(2)}`,
      });
    }

    // Check data points
    if (value.metadata?.dataPoints && value.metadata.dataPoints < 5) {
      issues.push({
        type: 'low_confidence',
        severity: 'medium',
        message: `Insufficient data points: ${value.metadata.dataPoints}`,
      });
    }

    // Check against thresholds
    if (definition.thresholds) {
      const thresholdIssue = this.checkThresholds(value.value, definition.thresholds);
      if (thresholdIssue) {
        issues.push(thresholdIssue);
      }
    }

    // Check for anomalies (value changed > 50% from previous)
    if (value.comparisonData?.changePercent) {
      const changePercent = Math.abs(value.comparisonData.changePercent);
      if (changePercent > 50) {
        issues.push({
          type: 'anomaly',
          severity: 'medium',
          message: `Anomaly detected: ${changePercent.toFixed(0)}% change from previous period`,
        });
      }
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      field: definition.metricKey,
      issues,
    };
  }

  /**
   * Check value against thresholds
   */
  private checkThresholds(
    value: number,
    thresholds: MetricDefinition['thresholds'],
  ): ValidationResult['issues'][0] | null {
    if (!thresholds) return null;

    // Check critical threshold
    if (thresholds.critical) {
      if (thresholds.critical.min !== undefined && value < thresholds.critical.min) {
        return {
          type: 'out_of_range',
          severity: 'critical',
          message: `Value ${value} is below critical minimum ${thresholds.critical.min}`,
        };
      }
      if (thresholds.critical.max !== undefined && value > thresholds.critical.max) {
        return {
          type: 'out_of_range',
          severity: 'critical',
          message: `Value ${value} is above critical maximum ${thresholds.critical.max}`,
        };
      }
    }

    // Check warning threshold
    if (thresholds.warning) {
      if (thresholds.warning.min !== undefined && value < thresholds.warning.min) {
        return {
          type: 'out_of_range',
          severity: 'high',
          message: `Value ${value} is below warning minimum ${thresholds.warning.min}`,
        };
      }
      if (thresholds.warning.max !== undefined && value > thresholds.warning.max) {
        return {
          type: 'out_of_range',
          severity: 'high',
          message: `Value ${value} is above warning maximum ${thresholds.warning.max}`,
        };
      }
    }

    return null;
  }

  /**
   * Validate business impact
   */
  validateBusinessImpact(impact: BusinessImpact): ValidationResult {
    const issues: ValidationResult['issues'] = [];

    // Check required fields
    if (!impact.estimatedRevenueLoss && !impact.actualRevenueLoss) {
      issues.push({
        type: 'missing_data',
        severity: 'high',
        message: 'Business impact is missing revenue loss estimates',
      });
    }

    // Check if validation is needed
    if (!impact.isValidated && impact.estimatedRevenueLoss && impact.estimatedRevenueLoss > 10000) {
      issues.push({
        type: 'missing_data',
        severity: 'high',
        message: 'High-value impact requires validation',
      });
    }

    // Check confidence in loss estimation
    if (impact.lossEstimation?.confidence && impact.lossEstimation.confidence < 0.5) {
      issues.push({
        type: 'low_confidence',
        severity: 'medium',
        message: `Low confidence in loss estimation: ${impact.lossEstimation.confidence.toFixed(2)}`,
      });
    }

    // Check for missing duration
    if (!impact.durationMinutes) {
      issues.push({
        type: 'missing_data',
        severity: 'medium',
        message: 'Impact duration is not recorded',
      });
    }

    // Check for missing customer impact
    if (!impact.customersAffected && impact.severity !== 'low') {
      issues.push({
        type: 'missing_data',
        severity: 'medium',
        message: 'Number of affected customers is not recorded',
      });
    }

    // Validate actual vs estimated when both exist
    if (impact.actualRevenueLoss && impact.estimatedRevenueLoss) {
      const variance = Math.abs(impact.actualRevenueLoss - impact.estimatedRevenueLoss);
      const variancePercent = (variance / impact.estimatedRevenueLoss) * 100;

      if (variancePercent > 50) {
        issues.push({
          type: 'anomaly',
          severity: 'medium',
          message: `Large variance between estimated ($${impact.estimatedRevenueLoss}) and actual ($${impact.actualRevenueLoss}) revenue loss`,
        });
      }
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      field: `impact_${impact.id}`,
      issues,
    };
  }

  /**
   * Generate health report for all KPIs
   */
  generateHealthReport(
    metricValues: MetricValue[],
    metricDefinitions: Map<number, MetricDefinition>,
  ): KpiHealthReport {
    const results: ValidationResult[] = [];
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    for (const value of metricValues) {
      const definition = metricDefinitions.get(value.metricDefinitionId);
      if (!definition) continue;

      const validation = this.validateMetricValue(value, definition);
      results.push(validation);

      const criticalIssues = validation.issues.filter(i => i.severity === 'critical').length;
      const highIssues = validation.issues.filter(i => i.severity === 'high').length;

      if (criticalIssues > 0) {
        criticalCount++;
      } else if (highIssues > 0) {
        warningCount++;
      } else {
        healthyCount++;
      }
    }

    const recommendations = this.generateRecommendations(results);

    return {
      overallHealthy: criticalCount === 0 && warningCount < metricValues.length * 0.2,
      totalMetrics: metricValues.length,
      healthyMetrics: healthyCount,
      warningMetrics: warningCount,
      criticalMetrics: criticalCount,
      results,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(results: ValidationResult[]): string[] {
    const recommendations: string[] = [];

    const criticalCount = results.filter(r =>
      r.issues.some(i => i.severity === 'critical')
    ).length;

    const staleDataCount = results.filter(r =>
      r.issues.some(i => i.type === 'stale_data')
    ).length;

    const lowConfidenceCount = results.filter(r =>
      r.issues.some(i => i.type === 'low_confidence')
    ).length;

    const anomalyCount = results.filter(r =>
      r.issues.some(i => i.type === 'anomaly')
    ).length;

    if (criticalCount > 0) {
      recommendations.push(
        `URGENT: ${criticalCount} metric(s) have critical issues requiring immediate attention`,
      );
    }

    if (staleDataCount > results.length * 0.3) {
      recommendations.push(
        `${staleDataCount} metric(s) have stale data. Consider increasing calculation frequency`,
      );
    }

    if (lowConfidenceCount > results.length * 0.2) {
      recommendations.push(
        `${lowConfidenceCount} metric(s) have low confidence scores. Investigate data quality`,
      );
    }

    if (anomalyCount > 0) {
      recommendations.push(
        `${anomalyCount} anomaly(ies) detected. Review for potential data issues or significant changes`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All KPIs are healthy and within expected ranges');
    }

    return recommendations;
  }

  /**
   * Log validation issues
   */
  logValidationIssues(report: KpiHealthReport): void {
    if (report.criticalCount > 0) {
      this.logger.error(
        `CRITICAL: ${report.criticalCount} KPIs have critical issues`,
      );
    }

    if (report.warningCount > 0) {
      this.logger.warn(
        `WARNING: ${report.warningCount} KPIs have warning-level issues`,
      );
    }

    for (const result of report.results) {
      for (const issue of result.issues) {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          this.logger.warn(`[${issue.severity.toUpperCase()}] ${result.field}: ${issue.message}`);
        }
      }
    }

    this.logger.log(
      `KPI Health: ${report.healthyMetrics}/${report.totalMetrics} healthy`,
    );
  }
}
