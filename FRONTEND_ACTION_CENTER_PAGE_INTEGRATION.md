# Action Center Page - Frontend Integration Guide

## Overview

This guide provides complete frontend integration details for the Action Center page, which displays AI-generated action items from ingested data sources (Jira, ServiceNow, Timeline Events, and KPIs).

## Authentication

All Action Center endpoints require JWT authentication. Include the access token in the Authorization header:

```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`
}
```

The backend automatically extracts `tenantId` from the JWT token using the `@CurrentTenant()` decorator.

## API Endpoints

### Base URL
```
https://api.nexsentia.com/api/v1/action-center
```

### 1. Get All Actions

**Endpoint:** `GET /action-center`

**Query Parameters:**
- `status` (optional): `'open' | 'in_progress' | 'done'` - Filter by action status
- `priority` (optional): `'critical' | 'high' | 'medium' | 'low'` - Filter by priority level
- `search` (optional): `string` - Search in title and description

**Response:**
```typescript
interface ActionCenterResponse {
  actions: GeneratedAction[];
  stats: {
    totalSources: number;         // Total number of data sources
    totalPiiStored: number;        // Total PII records stored
    activeConnections: number;     // Active integration connections
    lastUpdate: Date | null;       // Last action update timestamp
  };
  byStatus: {
    open: number;                  // Count of open actions
    in_progress: number;           // Count of in-progress actions
    done: number;                  // Count of done actions
  };
}

interface GeneratedAction {
  id: string;                      // Format: 'jira_123', 'servicenow_456', 'timeline_789'
  title: string;                   // Action title
  description: string;             // Detailed description
  status: 'open' | 'in_progress' | 'done';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;                // e.g., 'Engineering', 'Operations', 'Security'
  sourceType: string;              // 'jira', 'servicenow', 'timeline', 'kpi'
  sourceId: string;                // Original ID from source system
  metadata: {
    detectionPattern?: string;     // AI-detected pattern
    affectedSystems?: string[];    // Systems affected
    estimatedImpact?: string;      // Impact description
    [key: string]: any;            // Additional metadata
  };
  aiAnalysis?: {
    detectedIssue: string;         // AI-detected issue summary
    rootCause: string;             // Root cause analysis
    recommendedSolution: string;   // AI recommendation
    estimatedEffort: string;       // e.g., '2-4 hours', '1-2 days'
  };
  assignedToName?: string;         // Assignee display name
  createdAt: Date;                 // Creation timestamp
}
```

**Example Request:**
```typescript
// Get all actions
GET /api/v1/action-center

// Get open actions only
GET /api/v1/action-center?status=open

// Get critical priority actions
GET /api/v1/action-center?priority=critical

// Search actions
GET /api/v1/action-center?search=deployment

// Combined filters
GET /api/v1/action-center?status=open&priority=critical
```

### 2. Get Statistics

**Endpoint:** `GET /action-center/statistics`

**Response:**
```typescript
interface ActionStatistics {
  totalSources: number;
  totalPiiStored: number;
  activeConnections: number;
  lastUpdate: Date | null;
  byStatus: {
    open: number;
    in_progress: number;
    done: number;
  };
}
```

**Example Request:**
```typescript
GET /api/v1/action-center/statistics
```

## Frontend API Service Module

```typescript
// services/actionCenterApi.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.nexsentia.com/api/v1';

interface ActionFilters {
  status?: 'open' | 'in_progress' | 'done';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  search?: string;
}

export const actionCenterApi = {
  /**
   * Fetch actions with optional filters
   */
  async getActions(filters?: ActionFilters): Promise<ActionCenterResponse> {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString
      ? `${API_BASE_URL}/action-center?${queryString}`
      : `${API_BASE_URL}/action-center`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });

    return response.data;
  },

  /**
   * Fetch action statistics
   */
  async getStatistics(): Promise<ActionStatistics> {
    const response = await axios.get(`${API_BASE_URL}/action-center/statistics`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });

    return response.data;
  }
};
```

## React Component Examples

### 1. Action Center Dashboard

```typescript
// components/ActionCenter/ActionCenterDashboard.tsx
import React, { useState, useEffect } from 'react';
import { actionCenterApi } from '../../services/actionCenterApi';

export const ActionCenterDashboard: React.FC = () => {
  const [data, setData] = useState<ActionCenterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActionFilters>({});

  useEffect(() => {
    fetchActions();
  }, [filters]);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const response = await actionCenterApi.getActions(filters);
      setData(response);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch actions');
      console.error('Error fetching actions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading actions...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="action-center-dashboard">
      <header>
        <h1>Action Center</h1>
        <StatisticsBar stats={data.stats} byStatus={data.byStatus} />
      </header>

      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        statusCounts={data.byStatus}
      />

      <ActionList actions={data.actions} />
    </div>
  );
};
```

### 2. Statistics Bar Component

```typescript
// components/ActionCenter/StatisticsBar.tsx
import React from 'react';

interface StatisticsBarProps {
  stats: ActionStatistics['stats'];
  byStatus: ActionStatistics['byStatus'];
}

export const StatisticsBar: React.FC<StatisticsBarProps> = ({ stats, byStatus }) => {
  return (
    <div className="statistics-bar">
      <div className="stat-card">
        <label>Total Sources</label>
        <value>{stats.totalSources}</value>
      </div>

      <div className="stat-card">
        <label>Active Connections</label>
        <value>{stats.activeConnections}</value>
      </div>

      <div className="stat-card">
        <label>Open Actions</label>
        <value className="status-open">{byStatus.open}</value>
      </div>

      <div className="stat-card">
        <label>In Progress</label>
        <value className="status-progress">{byStatus.in_progress}</value>
      </div>

      <div className="stat-card">
        <label>Completed</label>
        <value className="status-done">{byStatus.done}</value>
      </div>

      {stats.lastUpdate && (
        <div className="stat-card">
          <label>Last Update</label>
          <value>{new Date(stats.lastUpdate).toLocaleString()}</value>
        </div>
      )}
    </div>
  );
};
```

### 3. Action List Component

```typescript
// components/ActionCenter/ActionList.tsx
import React from 'react';

interface ActionListProps {
  actions: GeneratedAction[];
}

export const ActionList: React.FC<ActionListProps> = ({ actions }) => {
  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#65a30d'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      open: { label: 'OPEN', className: 'badge-open' },
      in_progress: { label: 'IN PROGRESS', className: 'badge-progress' },
      done: { label: 'DONE', className: 'badge-done' }
    };
    return badges[status] || badges.open;
  };

  return (
    <div className="action-list">
      {actions.map(action => (
        <div key={action.id} className="action-card">
          <div className="action-header">
            <div className="action-title-row">
              <span
                className="priority-indicator"
                style={{ backgroundColor: getPriorityColor(action.priority) }}
              />
              <h3>{action.title}</h3>
              <span className={`status-badge ${getStatusBadge(action.status).className}`}>
                {getStatusBadge(action.status).label}
              </span>
            </div>

            <div className="action-meta">
              <span className="category">{action.category}</span>
              <span className="source">{action.sourceType.toUpperCase()}</span>
              {action.assignedToName && (
                <span className="assignee">Assigned to: {action.assignedToName}</span>
              )}
            </div>
          </div>

          <p className="action-description">{action.description}</p>

          {action.aiAnalysis && (
            <div className="ai-analysis">
              <h4>🤖 AI Analysis</h4>
              <div className="analysis-section">
                <strong>Detected Issue:</strong>
                <p>{action.aiAnalysis.detectedIssue}</p>
              </div>
              <div className="analysis-section">
                <strong>Root Cause:</strong>
                <p>{action.aiAnalysis.rootCause}</p>
              </div>
              <div className="analysis-section">
                <strong>Recommended Solution:</strong>
                <p>{action.aiAnalysis.recommendedSolution}</p>
              </div>
              <div className="analysis-section">
                <strong>Estimated Effort:</strong>
                <p>{action.aiAnalysis.estimatedEffort}</p>
              </div>
            </div>
          )}

          {action.metadata && (
            <div className="action-metadata">
              {action.metadata.detectionPattern && (
                <div className="metadata-item">
                  <strong>Pattern:</strong> {action.metadata.detectionPattern}
                </div>
              )}
              {action.metadata.affectedSystems && (
                <div className="metadata-item">
                  <strong>Affected Systems:</strong> {action.metadata.affectedSystems.join(', ')}
                </div>
              )}
              {action.metadata.estimatedImpact && (
                <div className="metadata-item">
                  <strong>Impact:</strong> {action.metadata.estimatedImpact}
                </div>
              )}
            </div>
          )}

          <div className="action-footer">
            <span className="timestamp">
              Created: {new Date(action.createdAt).toLocaleString()}
            </span>
            <a href={`/${action.sourceType}/${action.sourceId}`} className="view-source">
              View in {action.sourceType}
            </a>
          </div>
        </div>
      ))}

      {actions.length === 0 && (
        <div className="empty-state">
          <p>No actions found matching your filters.</p>
        </div>
      )}
    </div>
  );
};
```

### 4. Filter Bar Component

```typescript
// components/ActionCenter/FilterBar.tsx
import React from 'react';

interface FilterBarProps {
  filters: ActionFilters;
  onFilterChange: (filters: ActionFilters) => void;
  statusCounts: { open: number; in_progress: number; done: number };
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  statusCounts
}) => {
  const handleStatusClick = (status: 'open' | 'in_progress' | 'done') => {
    onFilterChange({
      ...filters,
      status: filters.status === status ? undefined : status
    });
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      priority: e.target.value as any || undefined
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      search: e.target.value || undefined
    });
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  return (
    <div className="filter-bar">
      <div className="status-filters">
        <button
          className={filters.status === 'open' ? 'active' : ''}
          onClick={() => handleStatusClick('open')}
        >
          Open ({statusCounts.open})
        </button>
        <button
          className={filters.status === 'in_progress' ? 'active' : ''}
          onClick={() => handleStatusClick('in_progress')}
        >
          In Progress ({statusCounts.in_progress})
        </button>
        <button
          className={filters.status === 'done' ? 'active' : ''}
          onClick={() => handleStatusClick('done')}
        >
          Done ({statusCounts.done})
        </button>
      </div>

      <div className="filter-controls">
        <select
          value={filters.priority || ''}
          onChange={handlePriorityChange}
          className="priority-filter"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <input
          type="text"
          placeholder="Search actions..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="search-input"
        />

        {(filters.status || filters.priority || filters.search) && (
          <button onClick={clearFilters} className="clear-filters">
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
```

## Error Handling

```typescript
// utils/errorHandler.ts
export const handleActionCenterError = (error: any): string => {
  if (error.response) {
    switch (error.response.status) {
      case 401:
        return 'Authentication failed. Please log in again.';
      case 403:
        return 'You do not have permission to access action center data.';
      case 404:
        return 'Action center endpoint not found.';
      case 500:
        return 'Server error while fetching actions. Please try again later.';
      default:
        return error.response.data?.message || 'An unexpected error occurred.';
    }
  } else if (error.request) {
    return 'Network error. Please check your connection.';
  } else {
    return error.message || 'An unexpected error occurred.';
  }
};
```

## State Management (Redux Example)

```typescript
// store/actionCenterSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { actionCenterApi } from '../services/actionCenterApi';

export const fetchActions = createAsyncThunk(
  'actionCenter/fetchActions',
  async (filters?: ActionFilters) => {
    return await actionCenterApi.getActions(filters);
  }
);

export const fetchStatistics = createAsyncThunk(
  'actionCenter/fetchStatistics',
  async () => {
    return await actionCenterApi.getStatistics();
  }
);

const actionCenterSlice = createSlice({
  name: 'actionCenter',
  initialState: {
    actions: [],
    stats: null,
    byStatus: { open: 0, in_progress: 0, done: 0 },
    loading: false,
    error: null,
    filters: {}
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActions.fulfilled, (state, action) => {
        state.loading = false;
        state.actions = action.payload.actions;
        state.stats = action.payload.stats;
        state.byStatus = action.payload.byStatus;
      })
      .addCase(fetchActions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { setFilters, clearFilters } = actionCenterSlice.actions;
export default actionCenterSlice.reducer;
```

## Best Practices

### 1. Polling for Updates
```typescript
// Auto-refresh actions every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    fetchActions();
  }, 30000);

  return () => clearInterval(interval);
}, [filters]);
```

### 2. Optimistic Updates
Since actions are read-only (generated from source data), no optimistic updates are needed. Always fetch fresh data.

### 3. Performance Optimization
```typescript
// Memoize expensive computations
const sortedActions = useMemo(() => {
  return [...actions].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}, [actions]);
```

### 4. Accessibility
```typescript
<button
  aria-label={`Filter by ${status} status`}
  aria-pressed={filters.status === status}
  onClick={() => handleStatusClick(status)}
>
  {status} ({count})
</button>
```

### 5. Loading States
```typescript
{loading && <SkeletonLoader count={5} />}
{!loading && actions.length === 0 && <EmptyState />}
{!loading && actions.length > 0 && <ActionList actions={actions} />}
```

## Testing Examples

```typescript
// __tests__/ActionCenterDashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { ActionCenterDashboard } from '../ActionCenterDashboard';
import { actionCenterApi } from '../../services/actionCenterApi';

jest.mock('../../services/actionCenterApi');

describe('ActionCenterDashboard', () => {
  it('renders actions successfully', async () => {
    const mockData = {
      actions: [
        {
          id: 'jira_1',
          title: 'Fix deployment issue',
          description: 'Critical deployment failure',
          status: 'open',
          priority: 'critical',
          category: 'Engineering',
          sourceType: 'jira',
          sourceId: 'PROJ-123',
          metadata: {},
          createdAt: new Date()
        }
      ],
      stats: {
        totalSources: 6,
        totalPiiStored: 305808,
        activeConnections: 5,
        lastUpdate: new Date()
      },
      byStatus: { open: 1, in_progress: 0, done: 0 }
    };

    (actionCenterApi.getActions as jest.Mock).mockResolvedValue(mockData);

    render(<ActionCenterDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Fix deployment issue')).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    (actionCenterApi.getActions as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    render(<ActionCenterDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

## Key Features

1. **Dynamic Action Generation** - Actions are computed on-the-fly from ingested data sources
2. **Multi-Source Analysis** - Aggregates from Jira, ServiceNow, Timeline Events, and KPIs
3. **AI-Powered Insights** - Each action includes AI analysis with root cause and recommendations
4. **Flexible Filtering** - Filter by status, priority, and search terms
5. **Real-time Statistics** - Track action counts by status and overall metrics
6. **Source Traceability** - Each action links back to its source system

## Notes

- Actions are read-only and dynamically generated
- No CRUD operations are available (no create/update/delete)
- Actions reflect the current state of source systems
- Re-fetching always returns latest computed actions
- Authentication is tenant-scoped via JWT token
