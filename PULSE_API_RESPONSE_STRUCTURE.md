# Organizational Pulse API Response Structure

## Overview
This document provides a detailed breakdown of the `/api/v1/kpi/dashboard/organizational-pulse` API response, organized section by section for easy frontend integration.

---

## Complete Response Structure

```typescript
interface OrganizationalPulseResponse {
  overallHealth: OverallHealthSection;
  strategicAlignment: StrategicAlignmentSection;
  businessEscalations: BusinessEscalationsSection;
  teamSignals: TeamSignalsSection[];
  metrics: MetricsSection[];
  period: PeriodSection;
}
```

---

## Section 1: Overall Health Score

**Purpose:** Display the main health score circle/gauge on the dashboard.

```typescript
interface OverallHealthSection {
  score: number;              // Main health score (0-100)
  status: string;             // 'excellent' | 'good' | 'warning' | 'critical'
  totalMetrics: number;       // Total number of metrics being tracked
  excellentCount: number;     // Count of metrics in excellent range
  goodCount: number;          // Count of metrics in good range
  warningCount: number;       // Count of metrics in warning range
  criticalCount: number;      // Count of metrics in critical range
}
```

### Example Data
```json
{
  "overallHealth": {
    "score": 25,
    "status": "critical",
    "totalMetrics": 8,
    "excellentCount": 0,
    "goodCount": 0,
    "warningCount": 0,
    "criticalCount": 8
  }
}
```

### Frontend Usage
```javascript
// Display main health score circle
<HealthScoreCircle
  score={data.overallHealth.score}
  status={data.overallHealth.status}
/>

// Display metric breakdown
<MetricBreakdown
  excellent={data.overallHealth.excellentCount}
  good={data.overallHealth.goodCount}
  warning={data.overallHealth.warningCount}
  critical={data.overallHealth.criticalCount}
/>
```

---

## Section 2: Strategic Alignment

**Purpose:** Show high-level alignment metrics across different organizational categories.

```typescript
interface StrategicAlignmentSection {
  overall: number;            // Overall alignment score (0-100)
  categories: {
    [categoryKey: string]: {
      score: number;          // Category score (0-100)
      trend: string;          // 'up' | 'down' | 'stable'
      metricsCount: number;   // Number of metrics in this category
    };
  };
}
```

### Example Data
```json
{
  "strategicAlignment": {
    "overall": 25,
    "categories": {
      "incident_management": {
        "score": 25,
        "trend": "down",
        "metricsCount": 3
      },
      "team_productivity": {
        "score": 25,
        "trend": "up",
        "metricsCount": 3
      },
      "communication": {
        "score": 25,
        "trend": "down",
        "metricsCount": 1
      },
      "engagement": {
        "score": 25,
        "trend": "up",
        "metricsCount": 1
      }
    }
  }
}
```

### Frontend Usage
```javascript
// Display category cards
const categories = Object.entries(data.strategicAlignment.categories);

categories.map(([key, category]) => (
  <AlignmentCard
    key={key}
    title={formatCategoryName(key)}
    score={category.score}
    trend={category.trend}
    metricsCount={category.metricsCount}
  />
));

// Trend indicator
const getTrendIcon = (trend) => {
  return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
};

// Trend color
const getTrendColor = (trend) => {
  return trend === 'up' ? '#00FFA3' : trend === 'down' ? '#FF4444' : '#FFA500';
};
```

---

## Section 3: Business Escalations

**Purpose:** Display business impact events over time with financial metrics.

```typescript
interface BusinessEscalationsSection {
  chartData: MonthlyEscalation[];
  totalCount: number;         // Total escalations in period
  totalLoss: number;          // Total revenue loss in dollars
}

interface MonthlyEscalation {
  month: string;              // Format: 'YYYY-MM' (e.g., '2025-12')
  count: number;              // Number of escalations in this month
  totalLoss: number;          // Revenue loss in this month
  bySeverity: {
    critical: number;         // Count of critical escalations
    high: number;             // Count of high severity escalations
    medium: number;           // Count of medium severity escalations
    low: number;              // Count of low severity escalations
  };
}
```

### Example Data
```json
{
  "businessEscalations": {
    "chartData": [
      {
        "month": "2025-10",
        "count": 0,
        "totalLoss": 0,
        "bySeverity": {
          "critical": 0,
          "high": 0,
          "medium": 0,
          "low": 0
        }
      },
      {
        "month": "2025-11",
        "count": 0,
        "totalLoss": 0,
        "bySeverity": {
          "critical": 0,
          "high": 0,
          "medium": 0,
          "low": 0
        }
      },
      {
        "month": "2025-12",
        "count": 5,
        "totalLoss": 218000,
        "bySeverity": {
          "critical": 2,
          "high": 2,
          "medium": 1,
          "low": 0
        }
      }
    ],
    "totalCount": 6,
    "totalLoss": 223000
  }
}
```

### Frontend Usage
```javascript
// Format month for display
const formatMonth = (monthString) => {
  const date = new Date(monthString + '-01');
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// Chart component
<BarChart
  data={{
    labels: data.businessEscalations.chartData.map(d => formatMonth(d.month)),
    datasets: [
      {
        label: 'Critical',
        data: data.businessEscalations.chartData.map(d => d.bySeverity.critical),
        backgroundColor: '#FF0000'
      },
      {
        label: 'High',
        data: data.businessEscalations.chartData.map(d => d.bySeverity.high),
        backgroundColor: '#FFA500'
      },
      {
        label: 'Medium',
        data: data.businessEscalations.chartData.map(d => d.bySeverity.medium),
        backgroundColor: '#FFFF00'
      }
    ]
  }}
/>

// Summary metrics
<div className="escalation-summary">
  <MetricCard
    label="Total Escalations"
    value={data.businessEscalations.totalCount}
  />
  <MetricCard
    label="Revenue Impact"
    value={`$${data.businessEscalations.totalLoss.toLocaleString()}`}
  />
</div>
```

---

## Section 4: Team Signals

**Purpose:** Display detailed metrics broken down by team/department.

```typescript
interface TeamSignalsSection {
  team: string;               // Team name (e.g., 'Engineering', 'Product', 'Support')
  metrics: TeamMetric[];      // Array of metrics for this team
  overallScore: number;       // Team's overall health score (0-100)
}

interface TeamMetric {
  key: string;                // Metric identifier (e.g., 'team_velocity')
  name: string;               // Display name (e.g., 'Team Velocity')
  value: number;              // Current metric value
  status: string;             // 'excellent' | 'good' | 'warning' | 'critical'
}
```

### Example Data
```json
{
  "teamSignals": [
    {
      "team": "Engineering",
      "metrics": [
        {
          "key": "response_time",
          "name": "Average Response Time",
          "value": 3.52,
          "status": "good"
        },
        {
          "key": "cycle_time",
          "name": "Cycle Time",
          "value": 10.76,
          "status": "good"
        },
        {
          "key": "team_velocity",
          "name": "Team Velocity",
          "value": 55.7,
          "status": "good"
        }
      ],
      "overallScore": 75
    },
    {
      "team": "Product",
      "metrics": [
        {
          "key": "response_time",
          "name": "Average Response Time",
          "value": 2.95,
          "status": "good"
        }
      ],
      "overallScore": 75
    }
  ]
}
```

### Frontend Usage
```javascript
// Team comparison view
{data.teamSignals.map(team => (
  <TeamCard key={team.team}>
    <h3>{team.team}</h3>
    <ScoreBadge score={team.overallScore} />

    <MetricsGrid>
      {team.metrics.map(metric => (
        <MetricItem
          key={metric.key}
          name={metric.name}
          value={metric.value}
          status={metric.status}
        />
      ))}
    </MetricsGrid>
  </TeamCard>
))}

// Team comparison chart
const compareTeamsChart = {
  labels: data.teamSignals.map(t => t.team),
  datasets: [{
    label: 'Overall Score',
    data: data.teamSignals.map(t => t.overallScore),
    backgroundColor: '#00FFA3'
  }]
};
```

---

## Section 5: Detailed Metrics

**Purpose:** Comprehensive metrics with historical trends and breakdowns.

```typescript
interface MetricsSection {
  key: string;                // Metric identifier
  name: string;               // Display name
  value: string;              // Current value as string (for precision)
  unit: string;               // Unit of measurement (e.g., 'hrs', 'days', '%', 'pts')
  trend: string;              // 'up' | 'down' | 'stable'
  changePercent: number;      // Percentage change (can be negative)
  status: string;             // 'excellent' | 'good' | 'warning' | 'critical'
  breakdown: {
    byTeam: {
      [teamName: string]: number;     // Value per team
    };
    byProject: {
      [projectKey: string]: number;   // Value per project
    };
  };
}
```

### Example Data
```json
{
  "metrics": [
    {
      "key": "response_time",
      "name": "Average Response Time",
      "value": "3.2600",
      "unit": "hrs",
      "trend": "down",
      "changePercent": 3.06,
      "status": "critical",
      "breakdown": {
        "byTeam": {
          "Product": 2.95,
          "Support": 3.32,
          "Engineering": 3.52
        },
        "byProject": {
          "ENG": 1.14,
          "SUP": 0.81,
          "PROD": 1.3
        }
      }
    },
    {
      "key": "team_velocity",
      "name": "Team Velocity",
      "value": "61.0000",
      "unit": "pts",
      "trend": "up",
      "changePercent": -3.15,
      "status": "critical",
      "breakdown": {
        "byTeam": {
          "Product": 66.36,
          "Support": 67.06,
          "Engineering": 55.7
        },
        "byProject": {
          "ENG": 21.35,
          "SUP": 15.25,
          "PROD": 24.4
        }
      }
    }
  ]
}
```

### Frontend Usage
```javascript
// Metric card component
const MetricCard = ({ metric }) => {
  const numValue = parseFloat(metric.value);

  return (
    <div className={`metric-card status-${metric.status}`}>
      <h4>{metric.name}</h4>

      {/* Main value */}
      <div className="metric-value">
        {numValue.toFixed(2)}{metric.unit}
      </div>

      {/* Trend indicator */}
      <div className={`trend trend-${metric.trend}`}>
        {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
        {Math.abs(metric.changePercent).toFixed(1)}%
      </div>

      {/* Team breakdown */}
      <div className="breakdown">
        <h5>By Team</h5>
        {Object.entries(metric.breakdown.byTeam).map(([team, value]) => (
          <div key={team} className="breakdown-item">
            <span>{team}</span>
            <span>{value.toFixed(2)}{metric.unit}</span>
          </div>
        ))}
      </div>

      {/* Project breakdown */}
      <div className="breakdown">
        <h5>By Project</h5>
        {Object.entries(metric.breakdown.byProject).map(([project, value]) => (
          <div key={project} className="breakdown-item">
            <span>{project}</span>
            <span>{value.toFixed(2)}{metric.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Grid of all metrics
<div className="metrics-grid">
  {data.metrics.map(metric => (
    <MetricCard key={metric.key} metric={metric} />
  ))}
</div>
```

---

## Section 6: Period Information

**Purpose:** Show the time range for all displayed data.

```typescript
interface PeriodSection {
  start: string;              // ISO date string
  end: string;                // ISO date string
}
```

### Example Data
```json
{
  "period": {
    "start": "2025-11-07T12:19:32.031Z",
    "end": "2026-02-05T12:19:32.031Z"
  }
}
```

### Frontend Usage
```javascript
// Format period for display
const formatPeriod = (period) => {
  const start = new Date(period.start);
  const end = new Date(period.end);

  return {
    startDate: start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    endDate: end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    duration: Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + ' days'
  };
};

// Display period
<div className="period-info">
  <span>Data Period: {formatPeriod(data.period).startDate} - {formatPeriod(data.period).endDate}</span>
  <span>Duration: {formatPeriod(data.period).duration}</span>
</div>
```

---

## Complete Integration Example

### React Component with All Sections

```javascript
import React, { useState, useEffect } from 'react';
import { fetchOrganizationalPulse } from './services/kpiApi';

const OrganizationalPulseDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('3m');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchOrganizationalPulse(timeRange);
        setData(response);
      } catch (error) {
        console.error('Failed to load pulse data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [timeRange]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorMessage />;

  return (
    <div className="pulse-dashboard">
      {/* Section 1: Overall Health */}
      <section className="overall-health">
        <HealthScoreCircle
          score={data.overallHealth.score}
          status={data.overallHealth.status}
        />
        <MetricBreakdown
          excellent={data.overallHealth.excellentCount}
          good={data.overallHealth.goodCount}
          warning={data.overallHealth.warningCount}
          critical={data.overallHealth.criticalCount}
        />
      </section>

      {/* Section 2: Strategic Alignment */}
      <section className="strategic-alignment">
        <h2>Strategic Alignment</h2>
        <div className="alignment-grid">
          {Object.entries(data.strategicAlignment.categories).map(([key, category]) => (
            <AlignmentCard
              key={key}
              title={formatCategoryName(key)}
              score={category.score}
              trend={category.trend}
              metricsCount={category.metricsCount}
            />
          ))}
        </div>
      </section>

      {/* Section 3: Business Escalations */}
      <section className="business-escalations">
        <h2>Business Escalations</h2>
        <div className="escalation-summary">
          <MetricCard
            label="Total Escalations"
            value={data.businessEscalations.totalCount}
          />
          <MetricCard
            label="Revenue Impact"
            value={`$${data.businessEscalations.totalLoss.toLocaleString()}`}
          />
        </div>
        <EscalationsChart data={data.businessEscalations.chartData} />
      </section>

      {/* Section 4: Team Signals */}
      <section className="team-signals">
        <h2>Team Health</h2>
        <div className="team-grid">
          {data.teamSignals.map(team => (
            <TeamCard key={team.team} team={team} />
          ))}
        </div>
      </section>

      {/* Section 5: Detailed Metrics */}
      <section className="detailed-metrics">
        <h2>Detailed Metrics</h2>
        <div className="metrics-grid">
          {data.metrics.map(metric => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </div>
      </section>

      {/* Section 6: Period Info */}
      <footer className="period-info">
        <span>
          Data Period: {formatDate(data.period.start)} - {formatDate(data.period.end)}
        </span>
      </footer>
    </div>
  );
};

export default OrganizationalPulseDashboard;
```

---

## Status & Trend Color Mapping

### Status Colors
```javascript
const STATUS_COLORS = {
  excellent: '#00FFA3',  // Green
  good: '#4CAF50',       // Light Green
  warning: '#FFA500',    // Orange
  critical: '#FF4444'    // Red
};
```

### Trend Colors
```javascript
const TREND_COLORS = {
  up: '#00FFA3',         // Green (positive)
  down: '#FF4444',       // Red (negative)
  stable: '#FFA500'      // Orange (neutral)
};
```

### Severity Colors (for Escalations)
```javascript
const SEVERITY_COLORS = {
  critical: '#FF0000',   // Bright Red
  high: '#FFA500',       // Orange
  medium: '#FFFF00',     // Yellow
  low: '#00FF00'         // Green
};
```

---

## Common Helper Functions

```javascript
// Format category names
const formatCategoryName = (key) => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Format dates
const formatDate = (isoString) => {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Format numbers with units
const formatMetricValue = (value, unit) => {
  const num = parseFloat(value);

  if (unit === '%') {
    return `${num.toFixed(1)}%`;
  } else if (unit === 'hrs') {
    return `${num.toFixed(2)} hours`;
  } else if (unit === 'days') {
    return `${num.toFixed(1)} days`;
  } else if (unit === 'pts') {
    return `${num.toFixed(0)} points`;
  } else {
    return `${num.toFixed(2)}${unit}`;
  }
};

// Calculate period duration
const calculateDuration = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  if (days <= 7) return `${days} days`;
  if (days <= 31) return `${Math.ceil(days / 7)} weeks`;
  if (days <= 365) return `${Math.ceil(days / 30)} months`;
  return `${Math.ceil(days / 365)} years`;
};
```

---

## Response Size & Performance Notes

- **Average Response Size:** ~15-25 KB (compressed)
- **Expected Response Time:** 200-500ms
- **Recommended Caching:** 5 minutes
- **Polling Interval:** 30 seconds for real-time updates

---

## Error Handling

```javascript
try {
  const data = await fetchOrganizationalPulse(timeRange);
  setData(data);
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  } else if (error.response?.status === 403) {
    // Show permission error
    showError('You do not have permission to view this data');
  } else {
    // Generic error
    showError('Failed to load organizational pulse data');
  }
}
```

---

## Testing Data

For development/testing, you can use this mock data generator:

```javascript
const generateMockPulseData = () => ({
  overallHealth: {
    score: Math.floor(Math.random() * 100),
    status: ['excellent', 'good', 'warning', 'critical'][Math.floor(Math.random() * 4)],
    totalMetrics: 8,
    excellentCount: Math.floor(Math.random() * 3),
    goodCount: Math.floor(Math.random() * 3),
    warningCount: Math.floor(Math.random() * 3),
    criticalCount: Math.floor(Math.random() * 3)
  },
  // ... rest of mock data
});
```
