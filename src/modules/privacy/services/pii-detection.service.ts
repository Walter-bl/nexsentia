import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PiiDetectionLog } from '../entities/pii-detection-log.entity';
import { PiiPattern, PiiDetectionResult, ScanResult } from '../interfaces/pii-pattern.interface';

@Injectable()
export class PiiDetectionService {
  private readonly logger = new Logger(PiiDetectionService.name);
  private readonly patterns: PiiPattern[];

  constructor(
    @InjectRepository(PiiDetectionLog)
    private readonly detectionLogRepository: Repository<PiiDetectionLog>,
  ) {
    this.patterns = this.initializePatterns();
  }

  /**
   * Initialize PII detection patterns
   */
  private initializePatterns(): PiiPattern[] {
    return [
      {
        type: 'email',
        name: 'Email Address',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        confidenceScore: 0.95,
        description: 'Detects email addresses',
      },
      {
        type: 'phone_us',
        name: 'US Phone Number',
        pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        confidenceScore: 0.85,
        description: 'Detects US phone numbers',
      },
      {
        type: 'phone_intl',
        name: 'International Phone',
        pattern: /\b\+?[1-9]\d{1,14}\b/g,
        confidenceScore: 0.7,
        description: 'Detects international phone numbers (E.164 format)',
      },
      {
        type: 'ssn',
        name: 'Social Security Number',
        pattern: /\b(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}\b/g,
        confidenceScore: 0.98,
        description: 'Detects US Social Security Numbers',
      },
      {
        type: 'credit_card',
        name: 'Credit Card Number',
        pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
        confidenceScore: 0.9,
        description: 'Detects major credit card numbers',
      },
      {
        type: 'ip_address',
        name: 'IP Address',
        pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        confidenceScore: 0.8,
        description: 'Detects IPv4 addresses',
      },
      {
        type: 'url',
        name: 'URL',
        pattern: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
        confidenceScore: 0.75,
        description: 'Detects URLs',
      },
      {
        type: 'api_key',
        name: 'API Key',
        pattern: /\b(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)[:\s]*['\"]?([a-zA-Z0-9_\-]{20,})['\"]?/gi,
        confidenceScore: 0.85,
        description: 'Detects API keys and tokens',
      },
      {
        type: 'aws_key',
        name: 'AWS Access Key',
        pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
        confidenceScore: 0.95,
        description: 'Detects AWS Access Key IDs',
      },
      {
        type: 'passport',
        name: 'Passport Number',
        pattern: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
        confidenceScore: 0.6,
        description: 'Detects potential passport numbers',
      },
      {
        type: 'date_of_birth',
        name: 'Date of Birth',
        pattern: /\b(?:dob|date[_\s]of[_\s]birth|birth[_\s]date)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/gi,
        confidenceScore: 0.8,
        description: 'Detects dates of birth',
      },
      {
        type: 'driver_license',
        name: 'Driver License',
        pattern: /\b(?:driver[_\s]license|dl|license[_\s]number)[:\s]*([A-Z0-9]{5,20})\b/gi,
        confidenceScore: 0.7,
        description: 'Detects driver license numbers',
      },
    ];
  }

  /**
   * Scan data for PII
   */
  async scanForPii(
    tenantId: number,
    sourceType: string,
    sourceId: string,
    data: Record<string, any>,
    fieldsToScan?: string[],
    piiTypesToDetect?: string[],
  ): Promise<ScanResult> {
    const detections: PiiDetectionResult[] = [];
    const scannedFields: string[] = [];

    // Determine which fields to scan
    const fields = fieldsToScan || Object.keys(data);

    // Filter patterns if specific types requested
    const patternsToUse = piiTypesToDetect
      ? this.patterns.filter(p => piiTypesToDetect.includes(p.type))
      : this.patterns;

    for (const fieldName of fields) {
      const value = data[fieldName];

      if (!value || typeof value !== 'string') {
        continue;
      }

      scannedFields.push(fieldName);

      for (const pattern of patternsToUse) {
        const matches = this.findMatches(value, pattern);

        if (matches.length > 0) {
          detections.push({
            fieldName,
            piiType: pattern.type,
            matches,
            detectedPattern: pattern.pattern.toString(),
          });

          // Log each detection
          for (const match of matches) {
            await this.logDetection(
              tenantId,
              sourceType,
              sourceId,
              fieldName,
              pattern.type,
              match.value,
              pattern.pattern.toString(),
              match.confidenceScore,
              match.position,
              match.length,
            );
          }
        }
      }
    }

    return {
      sourceType,
      sourceId,
      detections,
      scannedFields,
      totalPiiFound: detections.reduce((sum, d) => sum + d.matches.length, 0),
    };
  }

  /**
   * Find matches for a pattern in text
   */
  private findMatches(
    text: string,
    pattern: PiiPattern,
  ): Array<{ value: string; position: number; length: number; confidenceScore: number }> {
    const matches: Array<{ value: string; position: number; length: number; confidenceScore: number }> = [];
    let match: RegExpExecArray | null;

    // Reset regex lastIndex
    pattern.pattern.lastIndex = 0;

    while ((match = pattern.pattern.exec(text)) !== null) {
      matches.push({
        value: match[0],
        position: match.index,
        length: match[0].length,
        confidenceScore: pattern.confidenceScore,
      });
    }

    return matches;
  }

  /**
   * Log a PII detection
   */
  private async logDetection(
    tenantId: number,
    sourceType: string,
    sourceId: string,
    fieldName: string,
    piiType: string,
    originalValue: string,
    detectedPattern: string,
    confidenceScore: number,
    position: number,
    length: number,
  ): Promise<void> {
    try {
      const log = this.detectionLogRepository.create({
        tenantId,
        sourceType,
        sourceId,
        fieldName,
        piiType,
        originalValue: '[REDACTED]', // Don't store actual PII in logs
        detectedPattern,
        confidenceScore,
        metadata: {
          position,
          length,
        },
        isAnonymized: false,
      });

      await this.detectionLogRepository.save(log);
    } catch (error) {
      this.logger.error(`Failed to log PII detection: ${error.message}`, error.stack);
    }
  }

  /**
   * Get detection logs for a source
   */
  async getDetectionLogs(
    tenantId: number,
    sourceType?: string,
    sourceId?: string,
  ): Promise<PiiDetectionLog[]> {
    const where: any = { tenantId };

    if (sourceType) {
      where.sourceType = sourceType;
    }

    if (sourceId) {
      where.sourceId = sourceId;
    }

    return await this.detectionLogRepository.find({
      where,
      order: { detectedAt: 'DESC' },
    });
  }

  /**
   * Mark detections as anonymized
   */
  async markAsAnonymized(
    tenantId: number,
    sourceType: string,
    sourceId: string,
    fieldName: string,
    method: string,
  ): Promise<void> {
    await this.detectionLogRepository.update(
      {
        tenantId,
        sourceType,
        sourceId,
        fieldName,
      },
      {
        isAnonymized: true,
        anonymizationMethod: method,
      },
    );
  }

  /**
   * Get PII statistics for a tenant
   */
  async getStatistics(
    tenantId: number,
    sourceType?: string,
  ): Promise<{
    totalDetections: number;
    anonymized: number;
    pending: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const where: any = { tenantId };
    if (sourceType) {
      where.sourceType = sourceType;
    }

    const logs = await this.detectionLogRepository.find({ where });

    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let anonymized = 0;

    for (const log of logs) {
      byType[log.piiType] = (byType[log.piiType] || 0) + 1;
      bySource[log.sourceType] = (bySource[log.sourceType] || 0) + 1;
      if (log.isAnonymized) {
        anonymized++;
      }
    }

    return {
      totalDetections: logs.length,
      anonymized,
      pending: logs.length - anonymized,
      byType,
      bySource,
    };
  }
}
