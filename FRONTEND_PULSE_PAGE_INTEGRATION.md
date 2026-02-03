# Frontend Integration Guide - Pulse Page (Organizational Health Dashboard)

## Overview
This guide provides complete API integration details for the NexSentia Pulse Page, which displays real-time organizational health metrics, strategic alignment, business escalations, and team performance indicators.

---

## Table of Contents
1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Data Models](#data-models)
4. [Component Integration Examples](#component-integration-examples)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

---

## Authentication

All KPI endpoints require JWT authentication. Include the access token in the Authorization header:

```javascript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};
```

The tenant ID is automatically extracted from the JWT token, so no need to pass it manually.

---

## API Endpoints

### Base URL
```
Production: https://your-domain.com/api/v1/kpi
Development: http://localhost:3000/api/v1/kpi
```

---

## 1. Organizational Pulse Dashboard

### GET `/dashboard/organizational-pulse`
**Primary endpoint for the main Pulse page**

#### Request Parameters
```typescript
interface OrganizationalPulseParams {
  periodStart?: string;  // ISO date string (optional)
  periodEnd?: string;    // ISO date string (optional)
  timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y';  // Default: '30d'
}
```

#### Example Request
```javascript
const fetchOrganizationalPulse = async (timeRange = '30d') => {
  const response = await fetch(
    `${API_BASE_URL}/dashboard/organizational-pulse?timeRange=${timeRange}`,
    { headers }
  );
  return await response.json();
};
```

#### Response Structure
```typescript
interface OrganizationalPulseResponse {
  healthScore: number;           // Overall health score (0-100)
  healthTrend: number;           // Percentage change
  period: {
    start: string;               // ISO date
    end: string;                 // ISO date
  };

  // Strategic Alignment Metrics
  strategicAlignment: {
    teamAlignment: {
      value: number;             // Percentage (0-100)
      change: number;            // Percentage change
      trend: 'up' | 'down' | 'stable';
    };
    communicationEfficiency: {
      value: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    };
    // ... other alignment metrics
  };

  // Business Escalations
  businessEscalations: {
    totalThisQuarter: number;
    byMonth: Array<{
      month: string;             // e.g., "Jan", "Feb"
      count: number;
    }>;
    byType: Array<{
      type: string;              // e.g., "incident", "outage"
      count: number;
    }>;
  };

  // AI-Detected Organizational Patterns
  aiPatterns: Array<{
    category: string;            // e.g., "Communication", "Stock"
    pattern: string;             // Description
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
    incidentCount: number;
    signalCount: number;
  }>;

  // Detailed Metrics
  metrics: {
    orgHealth: Array<{
      key: string;
      name: string;
      value: number;
      unit: string;
      category: string;
      changePercent: number;
    }>;
    businessImpacts: Array<{
      // Business impact data
    }>;
  };
}
```

#### Frontend Integration Example
```javascript
// React Component Example
import React, { useState, useEffect } from 'react';

const OrganizationalPulseDashboard = () => {
  const [pulseData, setPulseData] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE_URL}/dashboard/organizational-pulse?timeRange=${timeRange}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await response.json();
        setPulseData(data);
      } catch (error) {
        console.error('Failed to fetch pulse data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="pulse-dashboard">
      {/* Health Score Circle */}
      <HealthScoreCircle
        score={pulseData.healthScore}
        trend={pulseData.healthTrend}
      />

      {/* Strategic Alignment Cards */}
      <div className="strategic-alignment">
        <MetricCard
          title="Team Alignment"
          value={pulseData.strategicAlignment.teamAlignment.value}
          change={pulseData.strategicAlignment.teamAlignment.change}
        />
        <MetricCard
          title="Communication Efficiency"
          value={pulseData.strategicAlignment.communicationEfficiency.value}
          change={pulseData.strategicAlignment.communicationEfficiency.change}
        />
      </div>

      {/* Business Escalations Chart */}
      <EscalationsChart
        data={pulseData.businessEscalations.byMonth}
        total={pulseData.businessEscalations.totalThisQuarter}
      />

      {/* AI Patterns */}
      <AIPatternsList patterns={pulseData.aiPatterns} />
    </div>
  );
};
```

---

## 2. Organizational Health Metrics

### GET `/dashboard/org-health`
**Detailed organizational health metrics with historical data**

#### Request Parameters
```typescript
interface OrgHealthParams {
  periodStart?: string;
  periodEnd?: string;
  timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y';
}
```

#### Example Request
```javascript
const fetchOrgHealthMetrics = async (timeRange = '1m') => {
  const response = await fetch(
    `${API_BASE_URL}/dashboard/org-health?timeRange=${timeRange}`,
    { headers }
  );
  return await response.json();
};
```

#### Response Structure
```typescript
interface OrgHealthResponse {
  metrics: Array<{
    key: string;                 // e.g., "team_velocity"
    name: string;                // Display name
    value: number;               // Current value
    unit: string;                // e.g., "%", "count", "hours"
    category: 'org_health';
    trend: 'up' | 'down' | 'stable';
    changePercent: number;       // Percentage change
    historical: Array<{
      date: string;              // ISO date
      value: number;
    }>;
  }>;

  summary: {
    totalMetrics: number;
    healthyMetrics: number;      // Within acceptable range
    atRiskMetrics: number;       // Needs attention
    criticalMetrics: number;     // Requires immediate action
  };
}
```

#### Frontend Chart Example
```javascript
// Chart Component for Historical Data
const MetricHistoryChart = ({ metric }) => {
  const chartData = {
    labels: metric.historical.map(h =>
      new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    datasets: [{
      label: metric.name,
      data: metric.historical.map(h => h.value),
      borderColor: '#00FFA3',
      backgroundColor: 'rgba(0, 255, 163, 0.1)',
      tension: 0.4
    }]
  };

  return (
    <div className="metric-chart">
      <h3>{metric.name}</h3>
      <div className="current-value">
        {metric.value}{metric.unit}
        <span className={`change ${metric.trend}`}>
          {metric.changePercent > 0 ? '+' : ''}{metric.changePercent}%
        </span>
      </div>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};
```

---

## 3. Business Impact Dashboard

### GET `/dashboard/business-impact`
**Revenue loss and business impact analysis**

#### Request Parameters
```typescript
interface BusinessImpactParams {
  periodStart?: string;
  periodEnd?: string;
  timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y';
}
```

#### Example Request
```javascript
const fetchBusinessImpact = async (timeRange = '3m') => {
  const response = await fetch(
    `${API_BASE_URL}/dashboard/business-impact?timeRange=${timeRange}`,
    { headers }
  );
  return await response.json();
};
```

#### Response Structure
```typescript
interface BusinessImpactResponse {
  totalRevenueLoss: number;      // Total revenue loss in dollars
  impactCount: number;           // Total number of impacts
  validatedImpacts: number;      // Validated impact count

  byType: Array<{
    sourceType: 'jira_incident' | 'slack_outage' | 'teams_issue' | 'servicenow_incident';
    count: number;
    totalLoss: number;
  }>;

  bySeverity: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    count: number;
    totalLoss: number;
  }>;

  topImpacts: Array<{
    id: number;
    sourceType: string;
    sourceId: string;
    estimatedLoss: number;
    actualRevenueLoss: number | null;
    severity: string;
    affectedCustomers: number;
    durationMinutes: number;
    createdAt: string;
    validated: boolean;
  }>;

  period: {
    start: string;
    end: string;
  };
}
```

#### Frontend Component Example
```javascript
const BusinessImpactDashboard = () => {
  const [impactData, setImpactData] = useState(null);

  // Fetch data...

  return (
    <div className="business-impact-dashboard">
      <div className="impact-summary">
        <div className="metric-card">
          <h4>Total Revenue Loss</h4>
          <p className="value">${impactData.totalRevenueLoss.toLocaleString()}</p>
        </div>
        <div className="metric-card">
          <h4>Impact Events</h4>
          <p className="value">{impactData.impactCount}</p>
        </div>
        <div className="metric-card">
          <h4>Validated</h4>
          <p className="value">{impactData.validatedImpacts}</p>
        </div>
      </div>

      {/* Impact by Type Chart */}
      <PieChart
        data={impactData.byType}
        title="Impacts by Source Type"
      />

      {/* Top 10 Impacts Table */}
      <ImpactTable impacts={impactData.topImpacts} />
    </div>
  );
};
```

---

## 4. KPI Metrics API

### GET `/metrics`
**Get all available metrics**

#### Request Parameters
```typescript
interface GetMetricsParams {
  category?: 'org_health' | 'business_impact' | 'team_performance';
}
```

#### Example Request
```javascript
const fetchMetrics = async (category = null) => {
  const url = category
    ? `${API_BASE_URL}/metrics?category=${category}`
    : `${API_BASE_URL}/metrics`;

  const response = await fetch(url, { headers });
  return await response.json();
};
```

#### Response
```typescript
interface Metric {
  id: number;
  key: string;                   // Unique identifier
  name: string;                  // Display name
  description: string;
  category: string;
  dataSource: 'jira' | 'slack' | 'teams' | 'servicenow' | 'combined';
  aggregationType: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'custom';
  targetValue: number | null;
  unit: string;
  isActive: boolean;
}
```

---

### POST `/metrics/:metricKey/calculate`
**Calculate a metric value for a specific period**

#### Request Body
```typescript
interface CalculateMetricDto {
  periodStart: string;           // ISO date
  periodEnd: string;             // ISO date
  granularity?: 'day' | 'week' | 'month';
  filters?: {
    projectKeys?: string[];      // For Jira metrics
    channelIds?: string[];       // For Slack metrics
    teamIds?: string[];          // For Teams metrics
    [key: string]: any;
  };
}
```

#### Example Request
```javascript
const calculateMetric = async (metricKey, periodStart, periodEnd) => {
  const response = await fetch(
    `${API_BASE_URL}/metrics/${metricKey}/calculate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        periodStart,
        periodEnd,
        granularity: 'day'
      })
    }
  );
  return await response.json();
};

// Usage
const result = await calculateMetric(
  'team_velocity',
  '2026-01-01',
  '2026-01-31'
);
```

#### Response
```typescript
interface CalculateMetricResponse {
  metricKey: string;
  value: number;
  unit: string;
  period: {
    start: string;
    end: string;
  };
  metadata: {
    dataPoints: number;
    calculationMethod: string;
    sources: string[];
  };
  storedValueId: number;         // ID of the stored metric value
}
```

---

### GET `/metrics/:metricKey/values`
**Get historical values for a metric**

#### Request Parameters
```typescript
interface GetMetricValuesParams {
  periodStart: string;
  periodEnd: string;
  limit?: number;
}
```

#### Example Request
```javascript
const getMetricHistory = async (metricKey, periodStart, periodEnd) => {
  const params = new URLSearchParams({
    periodStart,
    periodEnd,
    limit: '100'
  });

  const response = await fetch(
    `${API_BASE_URL}/metrics/${metricKey}/values?${params}`,
    { headers }
  );
  return await response.json();
};
```

#### Response
```typescript
interface MetricValue {
  id: number;
  metricKey: string;
  value: number;
  periodStart: string;
  periodEnd: string;
  metadata: {
    dataPoints: number;
    sources: string[];
  };
  createdAt: string;
}

type MetricValuesResponse = MetricValue[];
```

---

## 5. Business Impact API

### POST `/business-impact`
**Create a new business impact record**

#### Request Body
```typescript
interface CreateBusinessImpactDto {
  sourceType: 'jira_incident' | 'slack_outage' | 'teams_issue' | 'servicenow_incident';
  sourceId: string;              // External ID from source system

  revenueMapping: {
    estimatedLoss?: number;      // Manual estimate
    affectedRevenue?: number;    // Revenue directly affected
    opportunityCost?: number;    // Lost opportunities
  };

  affectedServices?: string[];   // List of affected services
  customersAffected?: number;    // Number of customers impacted
  durationMinutes?: number;      // Duration of impact
  severity?: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
}
```

#### Example Request
```javascript
const createBusinessImpact = async (impactData) => {
  const response = await fetch(
    `${API_BASE_URL}/business-impact`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(impactData)
    }
  );
  return await response.json();
};

// Usage
const impact = await createBusinessImpact({
  sourceType: 'jira_incident',
  sourceId: 'INC-12345',
  revenueMapping: {
    estimatedLoss: 50000
  },
  affectedServices: ['payment-api', 'checkout-service'],
  customersAffected: 1200,
  durationMinutes: 45,
  severity: 'high'
});
```

---

### POST `/business-impact/:impactId/validate`
**Validate a business impact with actual data**

#### Request Body
```typescript
interface ValidateImpactDto {
  isValid: boolean;
  notes?: string;
  actualRevenueLoss?: number;    // Actual confirmed loss
}
```

#### Example Request
```javascript
const validateImpact = async (impactId, validationData) => {
  const response = await fetch(
    `${API_BASE_URL}/business-impact/${impactId}/validate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(validationData)
    }
  );
  return await response.json();
};

// Usage
await validateImpact(123, {
  isValid: true,
  actualRevenueLoss: 48500,
  notes: 'Confirmed with finance team'
});
```

---

### GET `/business-impact/total-loss`
**Get total revenue loss summary**

#### Request Parameters
```typescript
interface TotalLossParams {
  periodStart?: string;
  periodEnd?: string;
}
```

#### Example Request
```javascript
const getTotalLoss = async (periodStart, periodEnd) => {
  const params = new URLSearchParams({ periodStart, periodEnd });
  const response = await fetch(
    `${API_BASE_URL}/business-impact/total-loss?${params}`,
    { headers }
  );
  return await response.json();
};
```

#### Response
```typescript
interface TotalLossResponse {
  totalLoss: number;
  period: {
    start: string;
    end: string;
  };
  breakdown: {
    byType: Array<{
      sourceType: string;
      totalLoss: number;
      count: number;
    }>;
    bySeverity: Array<{
      severity: string;
      totalLoss: number;
      count: number;
    }>;
  };
  validatedLoss: number;         // Loss from validated impacts
  estimatedLoss: number;         // Loss from unvalidated impacts
}
```

---

## Data Models

### Time Range Options
```typescript
type TimeRange = '7d' | '14d' | '1m' | '3m' | '6m' | '1y';

const timeRangeLabels = {
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '1m': 'Last month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last year'
};
```

### Metric Categories
```typescript
enum MetricCategory {
  ORG_HEALTH = 'org_health',
  BUSINESS_IMPACT = 'business_impact',
  TEAM_PERFORMANCE = 'team_performance'
}
```

### Data Sources
```typescript
enum DataSource {
  JIRA = 'jira',
  SLACK = 'slack',
  TEAMS = 'teams',
  SERVICENOW = 'servicenow',
  COMBINED = 'combined'
}
```

---

## Component Integration Examples

### Complete Pulse Page Component
```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import {
  fetchOrganizationalPulse,
  fetchOrgHealthMetrics,
  fetchBusinessImpact
} from './services/kpiApi';

const PulsePage = () => {
  const { accessToken } = useAuth();
  const [timeRange, setTimeRange] = useState('30d');
  const [pulseData, setPulseData] = useState(null);
  const [healthMetrics, setHealthMetrics] = useState(null);
  const [businessImpact, setBusinessImpact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch all dashboard data in parallel
        const [pulse, health, impact] = await Promise.all([
          fetchOrganizationalPulse(timeRange),
          fetchOrgHealthMetrics(timeRange),
          fetchBusinessImpact(timeRange)
        ]);

        setPulseData(pulse);
        setHealthMetrics(health);
        setBusinessImpact(impact);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
        // Handle error (show toast, etc.)
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [timeRange, accessToken]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="pulse-page">
      {/* Time Range Selector */}
      <TimeRangeSelector
        value={timeRange}
        onChange={setTimeRange}
      />

      {/* Main Health Score */}
      <section className="health-overview">
        <HealthScoreCircle
          score={pulseData.healthScore}
          trend={pulseData.healthTrend}
        />
        <IndustryBenchmarks
          score={pulseData.healthScore}
          benchmarks={pulseData.industryBenchmarks}
        />
      </section>

      {/* Strategic Alignment */}
      <section className="strategic-alignment">
        <h2>Strategic Alignment</h2>
        <div className="alignment-grid">
          <AlignmentCard
            title="Team Alignment"
            metric={pulseData.strategicAlignment.teamAlignment}
          />
          <AlignmentCard
            title="Communication Efficiency"
            metric={pulseData.strategicAlignment.communicationEfficiency}
          />
        </div>
      </section>

      {/* Business Escalations */}
      <section className="business-escalations">
        <h2>Business Escalations</h2>
        <EscalationsChart
          data={pulseData.businessEscalations.byMonth}
          total={pulseData.businessEscalations.totalThisQuarter}
        />
      </section>

      {/* AI Patterns */}
      <section className="ai-patterns">
        <h2>AI-Detected Organizational Patterns</h2>
        <PatternsList patterns={pulseData.aiPatterns} />
      </section>

      {/* Team Signals */}
      <section className="team-signals">
        <h2>Team Signals</h2>
        <SignalsBreakdown signals={pulseData.teamSignals} />
      </section>

      {/* Detailed Metrics */}
      <section className="detailed-metrics">
        <h2>Organizational Health Metrics</h2>
        <MetricsGrid metrics={healthMetrics.metrics} />
      </section>

      {/* Business Impact */}
      <section className="business-impact">
        <h2>Business Impact Analysis</h2>
        <ImpactSummary data={businessImpact} />
        <ImpactChart data={businessImpact.byType} />
      </section>
    </div>
  );
};

export default PulsePage;
```

### API Service Module
```javascript
// services/kpiApi.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

class KpiApiService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async fetchOrganizationalPulse(timeRange = '30d') {
    const response = await fetch(
      `${API_BASE_URL}/kpi/dashboard/organizational-pulse?timeRange=${timeRange}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch pulse data: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchOrgHealthMetrics(timeRange = '1m') {
    const response = await fetch(
      `${API_BASE_URL}/kpi/dashboard/org-health?timeRange=${timeRange}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch health metrics: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchBusinessImpact(timeRange = '3m') {
    const response = await fetch(
      `${API_BASE_URL}/kpi/dashboard/business-impact?timeRange=${timeRange}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch business impact: ${response.statusText}`);
    }

    return await response.json();
  }

  async calculateMetric(metricKey, periodStart, periodEnd, filters = {}) {
    const response = await fetch(
      `${API_BASE_URL}/kpi/metrics/${metricKey}/calculate`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          periodStart,
          periodEnd,
          granularity: 'day',
          filters
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to calculate metric: ${response.statusText}`);
    }

    return await response.json();
  }

  async getMetricHistory(metricKey, periodStart, periodEnd) {
    const params = new URLSearchParams({
      periodStart,
      periodEnd,
      limit: '100'
    });

    const response = await fetch(
      `${API_BASE_URL}/kpi/metrics/${metricKey}/values?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch metric history: ${response.statusText}`);
    }

    return await response.json();
  }
}

export default KpiApiService;
```

---

## Error Handling

### Standard Error Response
```typescript
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
}
```

### Error Handling Example
```javascript
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;

    switch (status) {
      case 401:
        // Unauthorized - redirect to login
        redirectToLogin();
        break;
      case 403:
        // Forbidden - show permission error
        showToast('You do not have permission to access this resource', 'error');
        break;
      case 404:
        // Not found
        showToast('Requested resource not found', 'error');
        break;
      case 500:
        // Server error
        showToast('Server error. Please try again later', 'error');
        break;
      default:
        showToast(data.message || 'An error occurred', 'error');
    }
  } else if (error.request) {
    // Request made but no response
    showToast('Network error. Please check your connection', 'error');
  } else {
    // Other errors
    showToast('An unexpected error occurred', 'error');
  }
};

// Usage in component
try {
  const data = await fetchOrganizationalPulse(timeRange);
  setPulseData(data);
} catch (error) {
  handleApiError(error);
}
```

---

## Best Practices

### 1. **Use React Query for Data Fetching**
```javascript
import { useQuery } from '@tanstack/react-query';

const usePulseData = (timeRange) => {
  return useQuery({
    queryKey: ['pulse', timeRange],
    queryFn: () => fetchOrganizationalPulse(timeRange),
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    onError: (error) => {
      console.error('Failed to fetch pulse data:', error);
    }
  });
};

// Usage
const PulsePage = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const { data, isLoading, error } = usePulseData(timeRange);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <PulseDashboard data={data} />;
};
```

### 2. **Implement Loading States**
```javascript
const LoadingState = () => (
  <div className="pulse-loading">
    <Skeleton variant="circular" width={300} height={300} />
    <Skeleton variant="rectangular" width="100%" height={200} />
    <Skeleton variant="rectangular" width="100%" height={400} />
  </div>
);
```

### 3. **Cache API Responses**
```javascript
const cacheManager = {
  get: (key) => {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > 5 * 60 * 1000; // 5 min

    return isExpired ? null : data;
  },

  set: (key, data) => {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }
};
```

### 4. **Optimize Chart Rendering**
```javascript
import { useMemo } from 'react';

const EscalationsChart = ({ data }) => {
  const chartData = useMemo(() => ({
    labels: data.map(d => d.month),
    datasets: [{
      label: 'Escalations',
      data: data.map(d => d.count),
      backgroundColor: '#00FFA3',
    }]
  }), [data]);

  return <Bar data={chartData} />;
};
```

### 5. **Handle Real-time Updates**
```javascript
import { useEffect } from 'react';

const useRealtimeUpdates = (timeRange, onUpdate) => {
  useEffect(() => {
    // Poll every 30 seconds
    const interval = setInterval(async () => {
      const data = await fetchOrganizationalPulse(timeRange);
      onUpdate(data);
    }, 30000);

    return () => clearInterval(interval);
  }, [timeRange, onUpdate]);
};
```

---

## Environment Configuration

### Development
```env
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_ENABLE_MOCK=false
```

### Production
```env
REACT_APP_API_URL=https://your-domain.com/api/v1
REACT_APP_ENABLE_MOCK=false
```

---

## Testing

### API Integration Tests
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import PulsePage from './PulsePage';

const server = setupServer(
  rest.get('/api/v1/kpi/dashboard/organizational-pulse', (req, res, ctx) => {
    return res(ctx.json({
      healthScore: 78,
      healthTrend: 5.2,
      // ... mock data
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('displays health score', async () => {
  render(<PulsePage />);

  await waitFor(() => {
    expect(screen.getByText('78')).toBeInTheDocument();
  });
});
```

---

## Support

For API questions or issues:
- Backend API Documentation: `/api/docs` (Swagger UI)
- GitHub Issues: https://github.com/your-org/nexsentia/issues
- API Status: Check `/ping` or `/health` endpoints

---

## Changelog

### Version 1.0.0 (2026-02-03)
- Initial API documentation
- All dashboard endpoints operational
- Metrics calculation endpoints ready
- Business impact tracking enabled
