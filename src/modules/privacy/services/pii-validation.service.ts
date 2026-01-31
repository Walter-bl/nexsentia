import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  field: string;
  issues: Array<{
    type: 'missing_anonymization' | 'incomplete_redaction' | 'exposed_pii' | 'invalid_format';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    location?: string;
  }>;
}

export interface ComplianceReport {
  overallCompliant: boolean;
  totalFieldsChecked: number;
  fieldsWithIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  results: ValidationResult[];
}

@Injectable()
export class PiiValidationService {
  private readonly logger = new Logger(PiiValidationService.name);

  // Patterns that should be anonymized
  private readonly sensitivePatterns = [
    {
      name: 'email',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      severity: 'high' as const,
    },
    {
      name: 'phone',
      pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      severity: 'high' as const,
    },
    {
      name: 'ssn',
      pattern: /\b(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}\b/g,
      severity: 'critical' as const,
    },
    {
      name: 'credit_card',
      pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
      severity: 'critical' as const,
    },
    {
      name: 'api_key',
      pattern: /\b(?:api[_-]?key|apikey|access[_-]?token|secret)[:\s]*['\"]?([a-zA-Z0-9_\-]{20,})['\"]?/gi,
      severity: 'critical' as const,
    },
  ];

  /**
   * Validate that a value is properly anonymized
   */
  validateAnonymization(field: string, value: any): ValidationResult {
    const issues: ValidationResult['issues'] = [];

    if (!value) {
      return {
        isValid: true,
        field,
        issues: [],
      };
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    // Check for exposed PII
    for (const pattern of this.sensitivePatterns) {
      const matches = stringValue.match(pattern.pattern);
      if (matches) {
        issues.push({
          type: 'exposed_pii',
          severity: pattern.severity,
          message: `Found exposed ${pattern.name} in field '${field}': ${matches.length} occurrence(s)`,
          location: field,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      field,
      issues,
    };
  }

  /**
   * Validate an entire object for PII compliance
   */
  validateObject(
    data: Record<string, any>,
    fieldsToCheck?: string[],
  ): ComplianceReport {
    const results: ValidationResult[] = [];
    const fields = fieldsToCheck || Object.keys(data);

    for (const field of fields) {
      const value = data[field];
      const result = this.validateAnonymization(field, value);
      results.push(result);
    }

    const criticalIssues = results.reduce(
      (count, r) => count + r.issues.filter(i => i.severity === 'critical').length,
      0,
    );
    const highIssues = results.reduce(
      (count, r) => count + r.issues.filter(i => i.severity === 'high').length,
      0,
    );
    const mediumIssues = results.reduce(
      (count, r) => count + r.issues.filter(i => i.severity === 'medium').length,
      0,
    );
    const lowIssues = results.reduce(
      (count, r) => count + r.issues.filter(i => i.severity === 'low').length,
      0,
    );

    return {
      overallCompliant: criticalIssues === 0 && highIssues === 0,
      totalFieldsChecked: results.length,
      fieldsWithIssues: results.filter(r => !r.isValid).length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      results,
    };
  }

  /**
   * Check if a token format is valid
   */
  validateTokenFormat(tokenId: string): { isValid: boolean; message?: string } {
    // Token should match pattern: PREFIX_TOKEN_hexstring
    const tokenPattern = /^[A-Z]+_TOKEN_[a-f0-9]{32}$/;

    if (!tokenPattern.test(tokenId)) {
      return {
        isValid: false,
        message: 'Token format is invalid. Expected format: PREFIX_TOKEN_hexstring',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate hash format
   */
  validateHashFormat(hash: string): { isValid: boolean; message?: string } {
    // SHA-256 hash should be 64 hex characters
    const hashPattern = /^[a-f0-9]{64}$/;

    if (!hashPattern.test(hash)) {
      return {
        isValid: false,
        message: 'Hash format is invalid. Expected SHA-256 hash (64 hex characters)',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate that required fields are anonymized
   */
  validateRequiredAnonymization(
    data: Record<string, any>,
    requiredAnonymizedFields: string[],
  ): ComplianceReport {
    const results: ValidationResult[] = [];

    for (const field of requiredAnonymizedFields) {
      const value = data[field];
      const issues: ValidationResult['issues'] = [];

      if (!value) {
        issues.push({
          type: 'missing_anonymization',
          severity: 'high',
          message: `Required field '${field}' is missing or empty`,
          location: field,
        });
      } else {
        // Check if value looks like it might be anonymized
        const stringValue = String(value);
        const looksAnonymized =
          stringValue.includes('TOKEN') ||
          /^[a-f0-9]{64}$/.test(stringValue) || // Hash
          stringValue.includes('***'); // Masked

        if (!looksAnonymized) {
          // Run PII detection
          const validationResult = this.validateAnonymization(field, value);
          if (!validationResult.isValid) {
            issues.push({
              type: 'missing_anonymization',
              severity: 'critical',
              message: `Required field '${field}' appears to contain unanonymized PII`,
              location: field,
            });
          }
        }
      }

      results.push({
        isValid: issues.length === 0,
        field,
        issues,
      });
    }

    const criticalIssues = results.reduce(
      (count, r) => count + r.issues.filter(i => i.severity === 'critical').length,
      0,
    );
    const highIssues = results.reduce(
      (count, r) => count + r.issues.filter(i => i.severity === 'high').length,
      0,
    );

    return {
      overallCompliant: criticalIssues === 0 && highIssues === 0,
      totalFieldsChecked: results.length,
      fieldsWithIssues: results.filter(r => !r.isValid).length,
      criticalIssues,
      highIssues,
      mediumIssues: 0,
      lowIssues: 0,
      results,
    };
  }

  /**
   * Generate a compliance summary report
   */
  generateComplianceReport(
    reports: ComplianceReport[],
  ): {
    overallCompliant: boolean;
    totalReports: number;
    compliantReports: number;
    totalIssues: number;
    issuesBySeverity: Record<string, number>;
    recommendations: string[];
  } {
    const compliantReports = reports.filter(r => r.overallCompliant).length;
    const totalIssues = reports.reduce(
      (sum, r) => sum + r.criticalIssues + r.highIssues + r.mediumIssues + r.lowIssues,
      0,
    );

    const issuesBySeverity = {
      critical: reports.reduce((sum, r) => sum + r.criticalIssues, 0),
      high: reports.reduce((sum, r) => sum + r.highIssues, 0),
      medium: reports.reduce((sum, r) => sum + r.mediumIssues, 0),
      low: reports.reduce((sum, r) => sum + r.lowIssues, 0),
    };

    const recommendations: string[] = [];

    if (issuesBySeverity.critical > 0) {
      recommendations.push(
        `URGENT: ${issuesBySeverity.critical} critical PII exposure(s) detected. Immediate anonymization required.`,
      );
    }

    if (issuesBySeverity.high > 0) {
      recommendations.push(
        `${issuesBySeverity.high} high-severity PII exposure(s) detected. Anonymize as soon as possible.`,
      );
    }

    if (compliantReports < reports.length) {
      recommendations.push(
        `${reports.length - compliantReports} out of ${reports.length} data sources are non-compliant.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All data sources are compliant with PII anonymization policies.');
    }

    return {
      overallCompliant: issuesBySeverity.critical === 0 && issuesBySeverity.high === 0,
      totalReports: reports.length,
      compliantReports,
      totalIssues,
      issuesBySeverity,
      recommendations,
    };
  }

  /**
   * Log validation results
   */
  logValidationResults(report: ComplianceReport): void {
    if (report.criticalIssues > 0) {
      this.logger.error(
        `CRITICAL: ${report.criticalIssues} critical PII issues found in ${report.fieldsWithIssues} fields`,
      );
    } else if (report.highIssues > 0) {
      this.logger.warn(
        `WARNING: ${report.highIssues} high-severity PII issues found in ${report.fieldsWithIssues} fields`,
      );
    } else {
      this.logger.log(
        `Validation passed: ${report.totalFieldsChecked} fields checked, no critical issues found`,
      );
    }

    // Log individual issues
    for (const result of report.results) {
      for (const issue of result.issues) {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          this.logger.warn(`[${issue.severity.toUpperCase()}] ${issue.message}`);
        }
      }
    }
  }
}
