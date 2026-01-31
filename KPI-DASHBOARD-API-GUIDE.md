# KPI Dashboard API Guide

This guide provides comprehensive documentation for the KPI Dashboard APIs that power your organizational health monitoring dashboard.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Main Dashboard Endpoint](#main-dashboard-endpoint)
4. [Metrics Management](#metrics-management)
5. [Business Impact Tracking](#business-impact-tracking)
6. [Response Examples](#response-examples)
7. [Dashboard Integration](#dashboard-integration)

---

## Overview

The KPI Dashboard APIs provide real-time organizational health monitoring through:

- **11 Pre-defined Org Health KPIs**: Incident resolution, team velocity, collaboration, quality metrics
- **Business Impact Tracking**: Revenue loss estimation and validation
- **Strategic Alignment**: Category-based performance scoring
- **Team Signals**: Team-level metric breakdowns
- **Trend Analysis**: Time-series data with comparison analytics

**Base URL**: `http://localhost:3000/api/v1/kpi`

---

## Authentication

All endpoints require JWT authentication. Include the access token in the Authorization header:

```http
Authorization: Bearer <your_access_token>
```

The tenant ID is automatically extracted from the JWT token using the `@CurrentTenant()` decorator.

---

## Main Dashboard Endpoint

### GET `/dashboard/organizational-pulse`

**Primary endpoint for your dashboard UI** - Returns comprehensive organizational health data in a single response.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| timeRange | string | No | `1m` | Quick time range filter: `7d`, `14d`, `1m`, `3m`, `6m`, `1y` |
| periodStart | string (ISO 8601) | No | Calculated from timeRange | Custom start date (overrides timeRange) |
| periodEnd | string (ISO 8601) | No | Now | Custom end date |

**Time Range Options:**
- `7d` - Last 7 days
- `14d` - Last 14 days
- `1m` - Last month (30 days)
- `3m` - Last 3 months (90 days)
- `6m` - Last 6 months (180 days)
- `1y` - Last year (365 days)

**Usage Examples:**
```http
# Using time range filter (recommended)
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=7d

# Using custom date range
GET /api/v1/kpi/dashboard/organizational-pulse?periodStart=2026-01-01&periodEnd=2026-01-31

# timeRange is ignored if periodStart is provided
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1m&periodStart=2026-01-15
```

#### Response Structure

```json
{
  "overallHealth": {
    "score": 78,                    // 0-100 score shown in center gauge
    "status": "good",               // excellent/good/warning/critical
    "totalMetrics": 11,
    "excellentCount": 3,
    "goodCount": 5,
    "warningCount": 2,
    "criticalCount": 1
  },
  "strategicAlignment": {
    "overall": 84,                  // Overall alignment percentage
    "categories": {
      "incident_management": {
        "score": 76,                // Category score (0-100)
        "trend": "up",              // up/down/stable
        "metricsCount": 3
      },
      "team_productivity": {
        "score": 82,
        "trend": "stable",
        "metricsCount": 3
      },
      "communication": {
        "score": 90,
        "trend": "up",
        "metricsCount": 2
      },
      "quality": {
        "score": 85,
        "trend": "stable",
        "metricsCount": 2
      },
      "engagement": {
        "score": 88,
        "trend": "up",
        "metricsCount": 1
      }
    }
  },
  "businessEscalations": {
    "chartData": [
      {
        "month": "2026-01",
        "count": 12,
        "totalLoss": 45000,
        "bySeverity": {
          "critical": 2,
          "high": 4,
          "medium": 5,
          "low": 1
        }
      }
    ],
    "totalCount": 12,
    "totalLoss": 45000
  },
  "teamSignals": [
    {
      "team": "Communication",
      "overallScore": 85,
      "metrics": [
        {
          "key": "response_time",
          "name": "Average Response Time",
          "value": 120,
          "status": "good"
        }
      ]
    }
  ],
  "metrics": [...],                 // Full metric details
  "period": {
    "start": "2026-01-01T00:00:00.000Z",
    "end": "2026-01-31T23:59:59.999Z"
  }
}
```

#### Dashboard UI Mapping

**Center Health Gauge**:
- Value: `overallHealth.score`
- Status color: `overallHealth.status`

**Strategic Alignment Section**:
- Left percentage: `strategicAlignment.overall`
- Right percentage: `strategicAlignment.categories.incident_management.score` (or any category)
- Radar chart: Use `strategicAlignment.categories` with all 5 categories

**Business Escalations Chart**:
- X-axis: `businessEscalations.chartData[].month`
- Y-axis: `businessEscalations.chartData[].count`
- Breakdown: `businessEscalations.chartData[].bySeverity`

**Team Signals**:
- Teams list: `teamSignals[].team`
- Team score: `teamSignals[].overallScore`
- Individual metrics: `teamSignals[].metrics[]`

---

## Metrics Management

### GET `/metrics`

Get all metric definitions.

**Query Parameters**:
- `category` (optional): Filter by category (`org_health`, `business_impact`)
- `active` (optional): Filter by active status (`true`, `false`)

**Response**:
```json
[
  {
    "id": 1,
    "metricKey": "incident_resolution_time",
    "name": "Average Incident Resolution Time",
    "description": "Mean time to resolve incidents",
    "category": "org_health",
    "dataType": "duration",
    "aggregationType": "avg",
    "calculation": {
      "formula": "AVG(resolvedDate - createdDate)",
      "sourceFields": ["sysCreatedOn", "resolvedDate", "state"],
      "sourceTypes": ["servicenow"],
      "filters": { "state": "Resolved" }
    },
    "thresholds": {
      "excellent": { "max": 240 },
      "good": { "max": 480 },
      "warning": { "max": 1440 },
      "critical": { "min": 1440 }
    },
    "displayConfig": {
      "unit": "minutes",
      "format": "duration",
      "chartType": "line"
    },
    "isActive": true,
    "isCustom": false
  }
]
```

### GET `/metrics/:metricKey`

Get a specific metric definition by its key.

### POST `/metrics`

Create a custom metric definition.

**Request Body**:
```json
{
  "metricKey": "custom_metric_key",
  "name": "Custom Metric Name",
  "description": "Description of what this metric measures",
  "category": "org_health",
  "dataType": "number",
  "aggregationType": "avg",
  "calculation": {
    "formula": "AVG(field)",
    "sourceFields": ["field1", "field2"],
    "sourceTypes": ["jira"],
    "filters": {}
  },
  "thresholds": {
    "excellent": { "min": 90 },
    "good": { "min": 70 },
    "warning": { "min": 50 },
    "critical": { "max": 50 }
  },
  "displayConfig": {
    "unit": "count",
    "format": "number",
    "chartType": "line"
  }
}
```

### PUT `/metrics/:metricKey`

Update an existing metric definition.

### DELETE `/metrics/:metricKey`

Delete a custom metric (system metrics cannot be deleted).

### POST `/metrics/:metricKey/calculate`

Trigger calculation of a metric for a specific period.

**Request Body**:
```json
{
  "periodStart": "2026-01-01T00:00:00.000Z",
  "periodEnd": "2026-01-31T23:59:59.999Z",
  "granularity": "daily"
}
```

**Granularity Options**: `hourly`, `daily`, `weekly`, `monthly`

### GET `/metrics/:metricKey/values`

Get calculated metric values over time.

**Query Parameters**:
- `periodStart` (required): Start date
- `periodEnd` (required): End date
- `granularity` (optional): Time bucket size

**Response**:
```json
[
  {
    "id": 1,
    "value": 320.5,
    "periodStart": "2026-01-01T00:00:00.000Z",
    "periodEnd": "2026-01-01T23:59:59.999Z",
    "granularity": "daily",
    "breakdown": {
      "byTeam": {
        "Communication": 280,
        "Stock": 360
      },
      "byProject": {
        "Project A": 300,
        "Project B": 340
      }
    },
    "metadata": {
      "dataPoints": 45,
      "confidence": 0.95
    },
    "comparisonData": {
      "previousPeriod": 365,
      "changePercent": -12.2,
      "trend": "down"
    },
    "createdAt": "2026-01-02T00:00:00.000Z"
  }
]
```

---

## Business Impact Tracking

### POST `/business-impact`

Create a business impact record linked to an incident.

**Request Body**:
```json
{
  "sourceType": "servicenow",
  "sourceId": "INC0012345",
  "impactType": "service_outage",
  "customersAffected": 150,
  "durationMinutes": 240,
  "severity": "high",
  "revenueMapping": {
    "affectedServices": ["payment-service", "checkout-service"],
    "revenuePerHour": 5000,
    "recurringRevenueImpact": 2000
  }
}
```

**Response**: Created business impact with estimated revenue loss.

### POST `/business-impact/:impactId/estimate-loss`

Calculate comprehensive loss estimation.

**Request Body**:
```json
{
  "includeOpportunityCost": true,
  "includeReputationImpact": true
}
```

**Response**:
```json
{
  "id": 1,
  "estimatedRevenueLoss": 20000,
  "lossEstimation": {
    "directCosts": 15000,
    "indirectCosts": 3000,
    "opportunityCost": 2000,
    "reputationImpact": 5000,
    "confidence": 0.85
  }
}
```

### POST `/business-impact/:impactId/validate`

Validate a business impact with actual data.

**Request Body**:
```json
{
  "isValid": true,
  "notes": "Validation notes from finance team",
  "actualRevenueLoss": 18500
}
```

### GET `/business-impact`

Get all business impacts with optional filters.

**Query Parameters**:
- `periodStart` (required): Start date
- `periodEnd` (required): End date
- `severity` (optional): Filter by severity
- `sourceType` (optional): Filter by source type
- `validated` (optional): Filter by validation status (`true`, `false`)

### GET `/business-impact/total-loss`

Get aggregated revenue loss data.

**Query Parameters**:
- `periodStart` (required)
- `periodEnd` (required)

**Response**:
```json
{
  "total": 125000,
  "validated": 85000,
  "estimated": 40000,
  "byType": {
    "service_outage": 75000,
    "performance_degradation": 30000,
    "data_loss": 20000
  },
  "bySeverity": {
    "critical": 60000,
    "high": 40000,
    "medium": 20000,
    "low": 5000
  },
  "byMonth": [
    {
      "month": "2026-01",
      "total": 45000,
      "count": 12
    }
  ]
}
```

---

## Pre-defined Org Health KPIs

The system includes 11 pre-configured organizational health metrics:

### Incident Management
1. **incident_resolution_time**: Average time to resolve incidents
   - Unit: minutes
   - Source: ServiceNow
   - Thresholds: <4h excellent, <8h good, <24h warning, >24h critical

2. **mttr**: Mean Time To Repair
   - Unit: minutes
   - Source: ServiceNow
   - Thresholds: <2h excellent, <4h good, <12h warning, >12h critical

3. **incident_volume**: Number of incidents per period
   - Unit: count
   - Source: ServiceNow
   - Thresholds: <10 excellent, <25 good, <50 warning, >50 critical

### Team Productivity
4. **team_velocity**: Story points completed per sprint
   - Unit: points
   - Source: Jira
   - Thresholds: >40 excellent, >30 good, >20 warning, <20 critical

5. **issue_throughput**: Issues resolved per period
   - Unit: count
   - Source: Jira
   - Thresholds: >50 excellent, >30 good, >15 warning, <15 critical

6. **cycle_time**: Time from start to completion
   - Unit: hours
   - Source: Jira
   - Thresholds: <48h excellent, <72h good, <120h warning, >120h critical

### Communication
7. **response_time**: Average time to respond to messages
   - Unit: minutes
   - Source: Slack, Teams
   - Thresholds: <15min excellent, <30min good, <60min warning, >60min critical

8. **collaboration_index**: Team collaboration score (custom formula)
   - Unit: score (0-100)
   - Source: Slack, Teams, Jira
   - Formula: Weighted average of message frequency, thread participation, code reviews

### Quality
9. **defect_density**: Bugs per feature
   - Unit: ratio
   - Source: Jira
   - Thresholds: <0.1 excellent, <0.3 good, <0.5 warning, >0.5 critical

10. **rework_rate**: Percentage of reopened issues
    - Unit: percentage
    - Source: Jira
    - Thresholds: <5% excellent, <10% good, <20% warning, >20% critical

### Engagement
11. **team_engagement**: Team participation score (custom formula)
    - Unit: score (0-100)
    - Source: Slack, Teams, Jira
    - Formula: Composite of message activity, meeting participation, contribution diversity

---

## Dashboard Integration

### Frontend Integration Example

```javascript
// Fetch organizational pulse data with time range filter
async function fetchDashboardData(timeRange = '1m') {
  const response = await fetch(
    `/api/v1/kpi/dashboard/organizational-pulse?timeRange=${timeRange}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  const data = await response.json();

  // Update center health gauge
  updateHealthGauge(data.overallHealth.score);

  // Update strategic alignment
  updateStrategicAlignment(data.strategicAlignment);

  // Update business escalations chart
  updateEscalationsChart(data.businessEscalations.chartData);

  // Update team signals
  updateTeamSignals(data.teamSignals);
}

// Update health gauge (center circle)
function updateHealthGauge(score) {
  const gauge = document.getElementById('health-gauge');
  gauge.setAttribute('data-score', score);
  gauge.querySelector('.score').textContent = score;

  // Set color based on status
  const status = score >= 90 ? 'excellent' :
                 score >= 75 ? 'good' :
                 score >= 50 ? 'warning' : 'critical';
  gauge.className = `health-gauge ${status}`;
}

// Update strategic alignment radar chart
function updateStrategicAlignment(alignment) {
  const categories = alignment.categories;

  // Extract data for radar chart
  const radarData = {
    labels: [
      'Incident Management',
      'Team Productivity',
      'Communication',
      'Quality',
      'Engagement'
    ],
    datasets: [{
      data: [
        categories.incident_management.score,
        categories.team_productivity.score,
        categories.communication.score,
        categories.quality.score,
        categories.engagement.score
      ]
    }]
  };

  // Render with your chart library (Chart.js, D3, etc.)
  renderRadarChart(radarData);
}

// Update business escalations chart
function updateEscalationsChart(chartData) {
  const barData = {
    labels: chartData.map(d => d.month),
    datasets: [
      {
        label: 'Critical',
        data: chartData.map(d => d.bySeverity.critical),
        backgroundColor: '#dc3545'
      },
      {
        label: 'High',
        data: chartData.map(d => d.bySeverity.high),
        backgroundColor: '#fd7e14'
      },
      {
        label: 'Medium',
        data: chartData.map(d => d.bySeverity.medium),
        backgroundColor: '#ffc107'
      },
      {
        label: 'Low',
        data: chartData.map(d => d.bySeverity.low),
        backgroundColor: '#28a745'
      }
    ]
  };

  renderBarChart(barData);
}

// Update team signals
function updateTeamSignals(teamSignals) {
  const container = document.getElementById('team-signals');

  teamSignals.forEach(team => {
    const teamCard = createTeamCard(team);
    container.appendChild(teamCard);
  });
}
```

### Time Range Filter UI Implementation

```javascript
// HTML for time range filter
/*
<select id="timeRangeFilter" onchange="handleTimeRangeChange()">
  <option value="7d">Last 7 Days</option>
  <option value="14d">Last 14 Days</option>
  <option value="1m" selected>Last Month</option>
  <option value="3m">Last 3 Months</option>
  <option value="6m">Last 6 Months</option>
  <option value="1y">Last Year</option>
</select>
*/

// Handle time range filter change
function handleTimeRangeChange() {
  const timeRange = document.getElementById('timeRangeFilter').value;
  fetchDashboardData(timeRange);
}

// Store current time range in state
let currentTimeRange = '1m';

// Fetch dashboard data with time range
async function fetchDashboardData(timeRange = currentTimeRange) {
  currentTimeRange = timeRange;

  try {
    const response = await fetch(
      `/api/v1/kpi/dashboard/organizational-pulse?timeRange=${timeRange}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Update all dashboard components
    updateHealthGauge(data.overallHealth.score);
    updateStrategicAlignment(data.strategicAlignment);
    updateEscalationsChart(data.businessEscalations.chartData);
    updateTeamSignals(data.teamSignals);

    // Update the period display
    updatePeriodDisplay(data.period);
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    showErrorMessage('Failed to load dashboard data');
  }
}

// Display the current period
function updatePeriodDisplay(period) {
  const startDate = new Date(period.start).toLocaleDateString();
  const endDate = new Date(period.end).toLocaleDateString();

  const periodElement = document.getElementById('period-display');
  periodElement.textContent = `${startDate} - ${endDate}`;
}
```

### Refresh Strategy

```javascript
// Recommended: Update dashboard every 5 minutes for near real-time data
setInterval(() => fetchDashboardData(currentTimeRange), 5 * 60 * 1000);

// For critical metrics, use separate endpoint with shorter interval
setInterval(async () => {
  const response = await fetch('/api/v1/kpi/dashboard/health-report');
  const health = await response.json();

  if (health.criticalIssues.length > 0) {
    showAlertBanner(health.criticalIssues);
  }
}, 60 * 1000); // Every minute
```

---

## Additional Endpoints

### GET `/dashboard/org-health`

Simplified org health endpoint (subset of organizational-pulse).

### GET `/dashboard/business-impact`

Simplified business impact endpoint (subset of organizational-pulse).

### GET `/dashboard/health-report`

Data quality and validation report for all metrics.

**Response**:
```json
{
  "overallHealth": "good",
  "metricsValidated": 11,
  "issues": [
    {
      "metricKey": "incident_volume",
      "type": "stale_data",
      "severity": "medium",
      "message": "Data is more than 48 hours old"
    }
  ],
  "warnings": [...],
  "recommendations": [
    "Refresh incident_volume metric",
    "Review threshold configuration for team_velocity"
  ]
}
```

### POST `/dashboard/snapshot`

Create a point-in-time snapshot for historical tracking.

**Response**: Array of snapshots (one per category).

---

## Error Handling

All endpoints follow standard HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

**Error Response Format**:
```json
{
  "statusCode": 400,
  "message": "Invalid period range",
  "error": "Bad Request"
}
```

---

## Rate Limiting

- **Dashboard endpoints**: 60 requests per minute per tenant
- **Calculation endpoints**: 10 requests per minute per tenant
- **Mutation endpoints**: 30 requests per minute per tenant

---

## Time Range Filter Quick Reference

| Filter | API Value | Time Period | Use Case |
|--------|-----------|-------------|----------|
| Last 7 Days | `7d` | Past week | Recent short-term trends, daily monitoring |
| Last 14 Days | `14d` | Past 2 weeks | Sprint/bi-weekly analysis |
| Last Month | `1m` | Past 30 days | Default view, monthly metrics |
| Last 3 Months | `3m` | Past 90 days | Quarterly trends, seasonal patterns |
| Last 6 Months | `6m` | Past 180 days | Half-year analysis, medium-term trends |
| Last Year | `1y` | Past 365 days | Annual review, year-over-year comparison |

### Time Range Selection Guidelines

- **7d/14d**: Best for monitoring recent incidents, immediate team performance
- **1m**: Default recommended view, balances detail and overview
- **3m**: Ideal for identifying patterns and quarterly business reviews
- **6m/1y**: Strategic planning, long-term trend analysis, annual reports

### Example API Calls

```bash
# Last 7 days - for recent incident monitoring
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=7d

# Last month - default dashboard view
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1m

# Last 3 months - quarterly business review
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=3m

# Last year - annual strategic planning
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1y

# Custom date range - specific period analysis
GET /api/v1/kpi/dashboard/organizational-pulse?periodStart=2026-01-01&periodEnd=2026-01-31
```

## Best Practices

1. **Caching**: Cache dashboard data for 2-5 minutes on the frontend
2. **Time Range Selection**: Default to `1m` (last month) for balanced performance
3. **Pagination**: Use shorter time ranges (`7d`, `14d`) for detailed drill-downs
4. **Granularity**: Automatically adjust chart granularity based on time range
   - 7d/14d: Show hourly or daily data points
   - 1m/3m: Show daily data points
   - 6m/1y: Show weekly or monthly data points
5. **Background Calculation**: Schedule metric calculations during off-peak hours
6. **Validation**: Validate business impacts within 24 hours for accuracy
7. **Custom Metrics**: Test custom metric calculations on small date ranges first
8. **Performance**: Longer time ranges (6m, 1y) may take longer to process - consider showing loading indicators

---

## Support

For issues or questions:
- Check the [postman/KPI-Dashboard-APIs.postman_collection.json](postman/KPI-Dashboard-APIs.postman_collection.json) for working examples
- Review entity schemas in `src/modules/kpi/entities/`
- Check service implementations in `src/modules/kpi/services/`
