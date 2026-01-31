# Time Range Filtering - Implementation Summary

## Overview

Added flexible time range filtering to all KPI dashboard endpoints, allowing users to quickly filter data by predefined time periods (7 days, 14 days, 1 month, 3 months, 6 months, 1 year) or custom date ranges.

## Changes Made

### 1. Controller Updates

**File**: `src/modules/kpi/controllers/dashboard.controller.ts`

#### Added New Query Parameter

All dashboard endpoints now support the `timeRange` parameter:

```typescript
@Get('organizational-pulse')
async getOrganizationalPulse(
  @CurrentTenant() tenantId: number,
  @Query('periodStart') periodStart?: string,
  @Query('periodEnd') periodEnd?: string,
  @Query('timeRange') timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
) {
  const { start, end } = this.calculateDateRange(periodStart, periodEnd, timeRange);
  // ... rest of implementation
}
```

#### Added Helper Method

New private method to calculate date ranges:

```typescript
private calculateDateRange(
  periodStart?: string,
  periodEnd?: string,
  timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
): { start: Date; end: Date } {
  // Priority: custom periodStart > timeRange > default (1m)
  // Returns calculated start and end dates
}
```

**Logic**:
- If `periodStart` is provided → use custom date range
- Else if `timeRange` is provided → calculate from timeRange
- Else → default to last 30 days (1m)

#### Endpoints Updated

1. ✅ `GET /api/v1/kpi/dashboard/organizational-pulse`
2. ✅ `GET /api/v1/kpi/dashboard/org-health`
3. ✅ `GET /api/v1/kpi/dashboard/business-impact`

### 2. Documentation Updates

**File**: `KPI-DASHBOARD-API-GUIDE.md`

#### Added Time Range Parameter Documentation

- Complete parameter table with descriptions
- Usage examples for each time range
- Time range selection guidelines
- Quick reference table

#### Added Frontend Integration Examples

- Time range filter UI implementation
- State management for current time range
- Automatic refresh with selected time range
- Error handling

#### Added Best Practices Section

- Performance considerations for different time ranges
- Recommended granularity adjustments
- Default time range recommendations
- Caching strategies

### 3. Postman Collection Updates

**File**: `postman/KPI-Dashboard-APIs.postman_collection.json`

- Updated all dashboard endpoints with `timeRange` parameter
- Set `timeRange=1m` as default (enabled)
- Custom date parameters disabled by default
- Added descriptions for all time range options

## Time Range Options

| Value | Description | Days | Use Case |
|-------|-------------|------|----------|
| `7d` | Last 7 days | 7 | Recent short-term trends, daily monitoring |
| `14d` | Last 14 days | 14 | Sprint/bi-weekly analysis |
| `1m` | Last month | 30 | Default view, monthly metrics ⭐ |
| `3m` | Last 3 months | 90 | Quarterly trends, seasonal patterns |
| `6m` | Last 6 months | 180 | Half-year analysis, medium-term trends |
| `1y` | Last year | 365 | Annual review, year-over-year comparison |

⭐ = Default if no parameter provided

## API Usage Examples

### Using Time Range Filter (Recommended)

```bash
# Last 7 days
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=7d

# Last month (default)
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1m

# Last year
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1y
```

### Using Custom Date Range

```bash
# Specific period
GET /api/v1/kpi/dashboard/organizational-pulse?periodStart=2026-01-01&periodEnd=2026-01-31

# Note: timeRange is ignored when periodStart is provided
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1m&periodStart=2026-01-15
# → Uses periodStart, ignores timeRange
```

### Response Format

All responses include the calculated period:

```json
{
  "overallHealth": { ... },
  "strategicAlignment": { ... },
  "businessEscalations": { ... },
  "teamSignals": [ ... ],
  "metrics": [ ... ],
  "period": {
    "start": "2026-01-01T00:00:00.000Z",
    "end": "2026-01-31T23:59:59.999Z"
  }
}
```

## Frontend Integration

### HTML Dropdown

```html
<select id="timeRangeFilter" onchange="handleTimeRangeChange()">
  <option value="7d">Last 7 Days</option>
  <option value="14d">Last 14 Days</option>
  <option value="1m" selected>Last Month</option>
  <option value="3m">Last 3 Months</option>
  <option value="6m">Last 6 Months</option>
  <option value="1y">Last Year</option>
</select>
```

### JavaScript Handler

```javascript
let currentTimeRange = '1m';

function handleTimeRangeChange() {
  const timeRange = document.getElementById('timeRangeFilter').value;
  fetchDashboardData(timeRange);
}

async function fetchDashboardData(timeRange = currentTimeRange) {
  currentTimeRange = timeRange;

  const response = await fetch(
    `/api/v1/kpi/dashboard/organizational-pulse?timeRange=${timeRange}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();

  // Update dashboard components
  updateHealthGauge(data.overallHealth.score);
  updateStrategicAlignment(data.strategicAlignment);
  updateEscalationsChart(data.businessEscalations.chartData);
  updateTeamSignals(data.teamSignals);
  updatePeriodDisplay(data.period);
}

// Auto-refresh with current time range
setInterval(() => fetchDashboardData(currentTimeRange), 5 * 60 * 1000);
```

## Performance Considerations

### Response Times (Estimated)

| Time Range | Estimated Response Time | Data Points |
|------------|------------------------|-------------|
| 7d | ~200-500ms | Low |
| 14d | ~300-600ms | Low-Medium |
| 1m | ~400-800ms | Medium |
| 3m | ~600-1200ms | Medium-High |
| 6m | ~1000-2000ms | High |
| 1y | ~1500-3000ms | Very High |

### Optimization Recommendations

1. **Loading Indicators**: Show loading state for 6m/1y ranges
2. **Caching**: Cache results for 2-5 minutes on frontend
3. **Debouncing**: Debounce rapid time range changes
4. **Background Refresh**: Use longer intervals for 6m/1y (10-15 minutes)
5. **Data Aggregation**: Consider pre-aggregating data for longer ranges

## Chart Granularity Recommendations

Automatically adjust chart granularity based on selected time range:

```javascript
function getChartGranularity(timeRange) {
  switch (timeRange) {
    case '7d':
    case '14d':
      return 'hourly'; // or 'daily' for simpler charts
    case '1m':
    case '3m':
      return 'daily';
    case '6m':
    case '1y':
      return 'weekly'; // or 'monthly' for yearly view
    default:
      return 'daily';
  }
}
```

## Testing

### Manual Testing with Postman

1. Import the updated Postman collection
2. Set your `access_token` in collection variables
3. Test each time range option:
   - Organizational Pulse → Change `timeRange` parameter
   - Verify `period.start` and `period.end` in response
   - Confirm data matches expected time range

### Example Test Cases

```bash
# Test 1: Default behavior (should return last 30 days)
GET /api/v1/kpi/dashboard/organizational-pulse

# Test 2: Last 7 days
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=7d

# Test 3: Last year
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1y

# Test 4: Custom date range overrides timeRange
GET /api/v1/kpi/dashboard/organizational-pulse?timeRange=1m&periodStart=2025-12-01&periodEnd=2025-12-31

# Expected: Uses Dec 2025, not last month
```

## Backward Compatibility

✅ **Fully backward compatible**

- Existing API calls without `timeRange` parameter continue to work
- Default behavior: last 30 days (unchanged)
- Custom `periodStart`/`periodEnd` parameters work as before
- No breaking changes to response format

## Migration Guide for Frontend

### Before (Custom Dates Only)

```javascript
// Old approach - always using custom dates
fetchDashboardData('2026-01-01', '2026-01-31');
```

### After (Time Range Filter)

```javascript
// New approach - using time range filter
fetchDashboardData('1m'); // Much simpler!

// Custom dates still supported
fetchDashboardData(null, '2026-01-01', '2026-01-31');
```

## Files Modified

1. ✅ `src/modules/kpi/controllers/dashboard.controller.ts`
   - Added `timeRange` parameter to 3 endpoints
   - Added `calculateDateRange()` helper method

2. ✅ `KPI-DASHBOARD-API-GUIDE.md`
   - Updated parameter documentation
   - Added time range quick reference
   - Added frontend integration examples
   - Added best practices section

3. ✅ `postman/KPI-Dashboard-APIs.postman_collection.json`
   - Updated all dashboard requests with `timeRange` parameter
   - Added parameter descriptions

## Summary

The time range filtering feature is now fully implemented and ready to use. Users can:

- ✅ Select from 6 predefined time ranges (7d, 14d, 1m, 3m, 6m, 1y)
- ✅ Use custom date ranges when needed
- ✅ Get consistent date range calculation across all dashboard endpoints
- ✅ See the actual period used in API responses
- ✅ Maintain backward compatibility with existing implementations

**Recommended default**: `timeRange=1m` (last month) for balanced performance and useful insights.
