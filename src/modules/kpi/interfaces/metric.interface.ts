export interface MetricCalculationContext {
  tenantId: number;
  periodStart: Date;
  periodEnd: Date;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  filters?: Record<string, any>;
}

export interface MetricResult {
  value: number;
  breakdown?: Record<string, any>;
  metadata?: {
    dataPoints?: number;
    confidence?: number;
    sources?: string[];
    warnings?: string[];
  };
}

export interface KpiDashboard {
  category: string;
  metrics: Array<{
    key: string;
    name: string;
    value: number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
    changePercent?: number;
    status?: 'excellent' | 'good' | 'warning' | 'critical';
    chartData?: any[];
  }>;
  summary: {
    overallHealth: number;
    excellentCount: number;
    goodCount: number;
    warningCount: number;
    criticalCount: number;
  };
}
