export interface PiiPattern {
  type: string;
  name: string;
  pattern: RegExp;
  confidenceScore: number;
  description?: string;
}

export interface PiiDetectionResult {
  fieldName: string;
  piiType: string;
  matches: Array<{
    value: string;
    position: number;
    length: number;
    confidenceScore: number;
  }>;
  detectedPattern: string;
}

export interface ScanResult {
  sourceType: string;
  sourceId: string;
  detections: PiiDetectionResult[];
  scannedFields: string[];
  totalPiiFound: number;
}
