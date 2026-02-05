# Frontend Integration Guide - Timeline Page (Event Timeline & Pattern Detection)

## Overview
This guide provides complete API integration details for the NexSentia Timeline Page, which displays **dynamically generated** timeline events from ingested data sources (Jira, ServiceNow, Slack, Teams, KPIs). Events are computed on-the-fly from integration data, featuring AI-detected organizational patterns, communication trends, workload imbalances, and critical incidents with timeline visualization and resolution tracking.

**Important:** Timeline events are **not stored in a database**. They are generated dynamically by analyzing data from all connected integrations, ensuring real-time accuracy and eliminating data duplication.

---

## Data-Driven Architecture

### How Timeline Events Are Generated

The Timeline module uses a **dynamic generation approach** where events are computed on-the-fly from existing integration data:

1. **Jira Integration**: Critical and high-priority issues are automatically converted to timeline events
   - Filters: Priority includes "critical", "high", or "blocker"
   - Status automatically maps to `isResolved` (done/resolved/closed = true)
   - Event includes full AI analysis with root cause and suggested actions

2. **ServiceNow Integration**: Priority 1 and 2 incidents become timeline events
   - Critical infrastructure incidents
   - Automatically tracks resolution status from incident state
   - Includes impact assessment and mitigation recommendations

3. **Communication Pattern Detection**: AI analyzes Slack and Teams message volume
   - Detects significant drops in communication (>40% below 7-day average)
   - Identifies potential team engagement or coordination issues
   - Confidence scoring based on data volume

4. **KPI Anomalies**: Metric threshold violations (future enhancement)
   - Performance degradation patterns
   - Business metric anomalies

### Benefits of Dynamic Generation

- **Real-time Accuracy**: Events always reflect current source system state
- **No Data Duplication**: Single source of truth from integration data
- **Automatic Updates**: When a Jira issue is resolved, the timeline event immediately reflects this
- **Reduced Storage**: No additional database tables for timeline data
- **Simplified Sync**: No need to keep timeline events in sync with source systems

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

All Timeline endpoints require JWT authentication. Include the access token in the Authorization header:

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
Production: https://your-domain.com/api/v1/timeline
Development: http://localhost:3000/api/v1/timeline
```

---

## 1. List Timeline Events

### GET `/timeline`
**Primary endpoint for fetching timeline events with filters and pagination**

#### Request Parameters
```typescript
interface TimelineQueryParams {
  page?: number;                 // Page number (default: 1)
  limit?: number;                // Items per page (default: 20, max: 100)
  startDate?: string;            // ISO date string (filter by event date)
  endDate?: string;              // ISO date string
  impactLevel?: 'high' | 'medium' | 'low';  // Filter by impact level
  category?: string;             // Filter by category (e.g., "Communication", "Operations")
  isResolved?: boolean;          // Filter by resolution status
}
```

#### Example Request
```javascript
const fetchTimelineEvents = async (filters = {}) => {
  const params = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 20,
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
    ...(filters.impactLevel && { impactLevel: filters.impactLevel }),
    ...(filters.category && { category: filters.category }),
    ...(filters.isResolved !== undefined && { isResolved: filters.isResolved })
  });

  const response = await fetch(
    `${API_BASE_URL}/timeline?${params}`,
    { headers }
  );
  return await response.json();
};
```

#### Response Structure
```typescript
interface TimelineEventsResponse {
  events: GeneratedTimelineEvent[];
  total: number;                 // Total number of generated events
  page: number;                  // Current page
  limit: number;                 // Items per page
  totalPages: number;            // Total pages
}

interface GeneratedTimelineEvent {
  id: string;                    // Format: 'jira_123', 'servicenow_456', 'slack_comm_drop_789'
  title: string;
  description: string;
  eventDate: string;             // ISO date string
  impactLevel: 'high' | 'medium' | 'low';
  category: string;              // e.g., "Engineering", "Operations", "Communication"
  sourceType: string;            // 'jira', 'servicenow', 'slack', 'teams', 'kpi'
  sourceId: string;              // Original ID from source system (e.g., "PROJ-123", "INC0001234")
  isResolved: boolean;           // Automatically determined from source system status
  metadata?: {
    issueType?: string;          // For Jira events
    status?: string;
    priority?: string;
    assignee?: string;
    projectId?: number;
    urgency?: string;            // For ServiceNow events
    impact?: string;
    state?: string;
    category?: string;
    assignedTo?: string;
    avgMessagesPerDay?: number;  // For communication events
    recentMessages?: number;
    percentageChange?: number;
    [key: string]: any;
  };
  aiAnalysis?: {
    detectedPattern: string;     // e.g., "critical_engineering_issue", "infrastructure_incident"
    severity: 'high' | 'medium' | 'low';
    rootCause: string;           // AI-detected root cause
    predictedImpact: string;     // Predicted business impact
    suggestedActions: string[];  // AI-recommended actions
  };
  affectedSystems?: string[];    // List of affected systems/teams
  detectionConfidence?: number;  // AI confidence score (0-1)
}
```

**Important Notes:**
- Events are **generated dynamically** from source data
- No database storage - events reflect real-time source system state
- `isResolved` status is automatically determined from source systems (e.g., Jira issue status, ServiceNow incident state)
- Event IDs are prefixed by source type for easy identification

#### Frontend Integration Example
```javascript
// React Component Example
import React, { useState, useEffect } from 'react';

const TimelinePage = () => {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    impactLevel: null,
    category: null,
    isResolved: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetchTimelineEvents({
          page: pagination.page,
          limit: pagination.limit,
          ...filters
        });

        setEvents(response.events);
        setPagination({
          page: response.page,
          limit: response.limit,
          total: response.total,
          totalPages: response.totalPages
        });
      } catch (error) {
        console.error('Failed to fetch timeline events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pagination.page, filters]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="timeline-page">
      {/* Filters */}
      <TimelineFilters
        filters={filters}
        onChange={setFilters}
      />

      {/* Timeline Visualization */}
      <TimelineVisualization events={events} />

      {/* Event List */}
      <EventList events={events} />

      {/* Pagination */}
      <Pagination
        current={pagination.page}
        total={pagination.totalPages}
        onChange={(page) => setPagination({ ...pagination, page })}
      />
    </div>
  );
};
```

---

## 2. Get Single Timeline Event

### GET `/timeline/:id`
**Get detailed information about a specific timeline event**

#### Example Request
```javascript
const fetchTimelineEvent = async (eventId) => {
  const response = await fetch(
    `${API_BASE_URL}/timeline/${eventId}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error('Event not found');
  }

  return await response.json();
};
```

#### Response
```typescript
// Returns a single TimelineEvent object
type TimelineEventResponse = TimelineEvent;
```

#### Frontend Component Example
```javascript
const EventDetailModal = ({ eventId, onClose }) => {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const data = await fetchTimelineEvent(eventId);
        setEvent(data);
      } catch (error) {
        console.error('Failed to fetch event:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  if (loading) return <LoadingSpinner />;
  if (!event) return <ErrorMessage message="Event not found" />;

  return (
    <div className="event-detail-modal">
      <div className="modal-header">
        <h2>{event.title}</h2>
        <span className={`impact-badge ${event.impactLevel}`}>
          {event.impactLevel} impact
        </span>
        {event.isResolved && <span className="resolved-badge">Resolved</span>}
      </div>

      <div className="modal-body">
        <p className="description">{event.description}</p>

        <div className="event-metadata">
          <div className="metadata-item">
            <label>Event Date</label>
            <span>{new Date(event.eventDate).toLocaleString()}</span>
          </div>
          <div className="metadata-item">
            <label>Category</label>
            <span>{event.category}</span>
          </div>
          {event.sourceType && (
            <div className="metadata-item">
              <label>Source</label>
              <span>{event.sourceType}</span>
            </div>
          )}
        </div>

        {/* AI Analysis Section */}
        {event.aiAnalysis && (
          <AIAnalysisSection analysis={event.aiAnalysis} />
        )}

        {/* Resolution Section */}
        {event.isResolved && (
          <ResolutionSection
            resolvedAt={event.resolvedAt}
            notes={event.resolutionNotes}
          />
        )}
      </div>

      <div className="modal-footer">
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

---

## 3. Get Timeline Statistics

### GET `/timeline/statistics`
**Get aggregated statistics for timeline events**

#### Request Parameters
```typescript
interface TimelineStatisticsParams {
  startDate?: string;            // ISO date string
  endDate?: string;              // ISO date string
}
```

#### Example Request
```javascript
const fetchTimelineStatistics = async (startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(
    `${API_BASE_URL}/timeline/statistics?${params}`,
    { headers }
  );
  return await response.json();
};
```

#### Response Structure
```typescript
interface TimelineStatisticsResponse {
  totalEvents: number;
  byImpactLevel: {
    high: number;
    medium: number;
    low: number;
  };
  byCategory: {
    [category: string]: number;
  };
  resolvedCount: number;
  unresolvedCount: number;
}
```

#### Frontend Chart Example
```javascript
const TimelineStatistics = ({ startDate, endDate }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      const data = await fetchTimelineStatistics(startDate, endDate);
      setStats(data);
    };
    fetchStats();
  }, [startDate, endDate]);

  if (!stats) return <LoadingSpinner />;

  return (
    <div className="timeline-statistics">
      <div className="stat-card">
        <h4>Total Events</h4>
        <p className="stat-value">{stats.totalEvents}</p>
      </div>

      <div className="stat-card">
        <h4>Resolution Rate</h4>
        <p className="stat-value">
          {Math.round((stats.resolvedCount / stats.totalEvents) * 100)}%
        </p>
        <p className="stat-detail">
          {stats.resolvedCount} / {stats.totalEvents} resolved
        </p>
      </div>

      {/* Impact Level Distribution */}
      <div className="chart-container">
        <h4>By Impact Level</h4>
        <DoughnutChart
          data={{
            labels: ['High', 'Medium', 'Low'],
            datasets: [{
              data: [
                stats.byImpactLevel.high,
                stats.byImpactLevel.medium,
                stats.byImpactLevel.low
              ],
              backgroundColor: ['#FF4444', '#FFA500', '#00FFA3']
            }]
          }}
        />
      </div>

      {/* Category Distribution */}
      <div className="chart-container">
        <h4>By Category</h4>
        <BarChart
          data={{
            labels: Object.keys(stats.byCategory),
            datasets: [{
              label: 'Events',
              data: Object.values(stats.byCategory),
              backgroundColor: '#00FFA3'
            }]
          }}
        />
      </div>
    </div>
  );
};
```

---

## 4. Create Timeline Event

### POST `/timeline`
**Create a new timeline event (manual or from external trigger)**

#### Request Body
```typescript
interface CreateTimelineEventDto {
  title: string;
  description?: string;
  eventDate: string;             // ISO date string
  impactLevel: 'high' | 'medium' | 'low';
  category: string;              // e.g., "Communication", "Operations", "Team Performance"
  sourceType?: string;           // e.g., "manual", "ai_detection", "jira", "servicenow"
  sourceId?: string;             // External ID if from integrated system
  metadata?: {
    affectedTeams?: string[];
    detectionConfidence?: number;
    dataPoints?: number;
    [key: string]: any;
  };
  aiAnalysis?: {
    detectedPattern?: string;
    severity?: string;
    rootCause?: string;
    predictedImpact?: string;
    suggestedActions?: string[];
    [key: string]: any;
  };
}
```

#### Example Request
```javascript
const createTimelineEvent = async (eventData) => {
  const response = await fetch(
    `${API_BASE_URL}/timeline`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(eventData)
    }
  );

  if (!response.ok) {
    throw new Error('Failed to create event');
  }

  return await response.json();
};

// Usage Example 1: Simple Event
const simpleEvent = await createTimelineEvent({
  title: 'Sprint Velocity Decreased',
  description: 'Team velocity dropped by 25% this sprint',
  eventDate: new Date().toISOString(),
  impactLevel: 'medium',
  category: 'Team Performance'
});

// Usage Example 2: Complex Event with AI Analysis
const complexEvent = await createTimelineEvent({
  title: 'Communication Bottleneck Detected',
  description: 'AI detected unusual delay patterns in cross-team communication',
  eventDate: new Date().toISOString(),
  impactLevel: 'high',
  category: 'Communication',
  sourceType: 'ai_detection',
  metadata: {
    affectedTeams: ['Engineering', 'Support', 'Product'],
    detectionConfidence: 0.87,
    dataPoints: 156
  },
  aiAnalysis: {
    detectedPattern: 'cross_team_communication_delay',
    severity: 'high',
    rootCause: 'Increased workload in Engineering team causing delayed responses',
    predictedImpact: 'May lead to customer escalations if not addressed within 48 hours',
    suggestedActions: [
      'Schedule cross-team sync meeting',
      'Review Engineering team capacity',
      'Implement communication SLA monitoring'
    ]
  }
});
```

#### Frontend Form Example
```javascript
const CreateEventForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: new Date().toISOString(),
    impactLevel: 'medium',
    category: 'Communication'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const event = await createTimelineEvent(formData);
      onSuccess(event);
      showToast('Event created successfully', 'success');
    } catch (error) {
      showToast('Failed to create event', 'error');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-event-form">
      <input
        type="text"
        placeholder="Event Title"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        required
      />

      <textarea
        placeholder="Description (optional)"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />

      <select
        value={formData.impactLevel}
        onChange={(e) => setFormData({ ...formData, impactLevel: e.target.value })}
      >
        <option value="low">Low Impact</option>
        <option value="medium">Medium Impact</option>
        <option value="high">High Impact</option>
      </select>

      <select
        value={formData.category}
        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
      >
        <option value="Communication">Communication</option>
        <option value="Operations">Operations</option>
        <option value="Team Performance">Team Performance</option>
        <option value="Technical">Technical</option>
        <option value="Process">Process</option>
      </select>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
};
```

---

## 5. Update Timeline Event

### PUT `/timeline/:id`
**Update an existing timeline event (typically for resolution)**

#### Request Body
```typescript
interface UpdateTimelineEventDto {
  title?: string;
  description?: string;
  isResolved?: boolean;
  resolutionNotes?: string;
}
```

#### Example Request
```javascript
const updateTimelineEvent = async (eventId, updates) => {
  const response = await fetch(
    `${API_BASE_URL}/timeline/${eventId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update event');
  }

  return await response.json();
};

// Usage Example 1: Mark as Resolved
const resolvedEvent = await updateTimelineEvent(123, {
  isResolved: true,
  resolutionNotes: 'Scheduled daily standup between Engineering and Support teams. Communication delays reduced by 70%.'
});

// Usage Example 2: Update Title/Description
const updatedEvent = await updateTimelineEvent(123, {
  title: 'Communication Bottleneck Resolved',
  description: 'Updated description with resolution details'
});

// Usage Example 3: Unresolve Event
const unresolvedEvent = await updateTimelineEvent(123, {
  isResolved: false,
  resolutionNotes: 'Issue resurfaced, needs further investigation'
});
```

#### Frontend Resolve Form Example
```javascript
const ResolveEventForm = ({ eventId, onSuccess }) => {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleResolve = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const updated = await updateTimelineEvent(eventId, {
        isResolved: true,
        resolutionNotes
      });
      onSuccess(updated);
      showToast('Event marked as resolved', 'success');
    } catch (error) {
      showToast('Failed to resolve event', 'error');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleResolve} className="resolve-event-form">
      <h3>Resolve Event</h3>
      <textarea
        placeholder="Resolution notes (optional)"
        value={resolutionNotes}
        onChange={(e) => setResolutionNotes(e.target.value)}
        rows={4}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Resolving...' : 'Mark as Resolved'}
      </button>
    </form>
  );
};
```

---

## 6. Delete Timeline Event

### DELETE `/timeline/:id`
**Soft delete a timeline event**

#### Example Request
```javascript
const deleteTimelineEvent = async (eventId) => {
  const response = await fetch(
    `${API_BASE_URL}/timeline/${eventId}`,
    {
      method: 'DELETE',
      headers
    }
  );

  if (!response.ok) {
    throw new Error('Failed to delete event');
  }

  // Returns 200 with no content
  return true;
};

// Usage with confirmation
const handleDeleteEvent = async (eventId) => {
  if (!confirm('Are you sure you want to delete this event?')) {
    return;
  }

  try {
    await deleteTimelineEvent(eventId);
    showToast('Event deleted successfully', 'success');
    // Refresh event list
    refreshEvents();
  } catch (error) {
    showToast('Failed to delete event', 'error');
    console.error(error);
  }
};
```

---

## 7. Auto-Detect Timeline Events

### POST `/timeline/auto-detect`
**Trigger AI-based auto-detection of timeline events from integration data**

This endpoint analyzes data from Jira, Slack, Teams, ServiceNow, and KPIs to automatically detect significant organizational events and patterns.

#### Example Request
```javascript
const triggerAutoDetection = async () => {
  const response = await fetch(
    `${API_BASE_URL}/timeline/auto-detect`,
    {
      method: 'POST',
      headers
    }
  );

  if (!response.ok) {
    throw new Error('Failed to trigger auto-detection');
  }

  return await response.json();
};

// Usage
const detectedEvents = await triggerAutoDetection();
console.log(`Detected ${detectedEvents.length} new events`);
```

#### Frontend Integration
```javascript
const AutoDetectButton = ({ onDetectionComplete }) => {
  const [detecting, setDetecting] = useState(false);

  const handleAutoDetect = async () => {
    setDetecting(true);
    try {
      const events = await triggerAutoDetection();
      showToast(`Detected ${events.length} new events`, 'success');
      onDetectionComplete(events);
    } catch (error) {
      showToast('Auto-detection failed', 'error');
      console.error(error);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <button
      onClick={handleAutoDetect}
      disabled={detecting}
      className="auto-detect-btn"
    >
      {detecting ? (
        <>
          <SpinnerIcon /> Detecting Events...
        </>
      ) : (
        <>
          <AIIcon /> Auto-Detect Events
        </>
      )}
    </button>
  );
};
```

---

## Data Models

### Timeline Event Categories
```typescript
enum TimelineCategory {
  COMMUNICATION = 'Communication',
  OPERATIONS = 'Operations',
  TEAM_PERFORMANCE = 'Team Performance',
  TECHNICAL = 'Technical',
  PROCESS = 'Process',
  CULTURE = 'Culture',
  STRATEGY = 'Strategy'
}

const categoryColors = {
  'Communication': '#00FFA3',
  'Operations': '#FFA500',
  'Team Performance': '#4A90E2',
  'Technical': '#FF4444',
  'Process': '#9B59B6',
  'Culture': '#F39C12',
  'Strategy': '#1ABC9C'
};
```

### Impact Levels
```typescript
enum ImpactLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

const impactLevelConfig = {
  low: {
    color: '#00FFA3',
    label: 'Low Impact',
    icon: 'info'
  },
  medium: {
    color: '#FFA500',
    label: 'Medium Impact',
    icon: 'warning'
  },
  high: {
    color: '#FF4444',
    label: 'High Impact',
    icon: 'alert'
  }
};
```

### Source Types
```typescript
enum SourceType {
  AI_DETECTION = 'ai_detection',
  MANUAL = 'manual',
  JIRA = 'jira',
  SLACK = 'slack',
  TEAMS = 'teams',
  SERVICENOW = 'servicenow',
  KPI_THRESHOLD = 'kpi_threshold'
}
```

---

## Component Integration Examples

### Complete Timeline Page Component
```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import {
  fetchTimelineEvents,
  fetchTimelineStatistics,
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
  triggerAutoDetection
} from './services/timelineApi';

const TimelinePage = () => {
  const { accessToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    impactLevel: null,
    category: null,
    isResolved: null
  });
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    loadTimelineData();
  }, [filters]);

  const loadTimelineData = async () => {
    try {
      setLoading(true);

      // Fetch events and statistics in parallel
      const [eventsData, statsData] = await Promise.all([
        fetchTimelineEvents(filters),
        fetchTimelineStatistics()
      ]);

      setEvents(eventsData.events);
      setStatistics(statsData);
    } catch (error) {
      console.error('Failed to load timeline data:', error);
      showToast('Failed to load timeline', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (eventData) => {
    try {
      const newEvent = await createTimelineEvent(eventData);
      setEvents([newEvent, ...events]);
      showToast('Event created successfully', 'success');
    } catch (error) {
      showToast('Failed to create event', 'error');
    }
  };

  const handleResolveEvent = async (eventId, resolutionNotes) => {
    try {
      const updated = await updateTimelineEvent(eventId, {
        isResolved: true,
        resolutionNotes
      });

      setEvents(events.map(e => e.id === eventId ? updated : e));
      showToast('Event resolved successfully', 'success');
    } catch (error) {
      showToast('Failed to resolve event', 'error');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await deleteTimelineEvent(eventId);
      setEvents(events.filter(e => e.id !== eventId));
      showToast('Event deleted successfully', 'success');
    } catch (error) {
      showToast('Failed to delete event', 'error');
    }
  };

  const handleAutoDetect = async () => {
    try {
      const detectedEvents = await triggerAutoDetection();
      if (detectedEvents.length > 0) {
        showToast(`Detected ${detectedEvents.length} new events`, 'success');
        loadTimelineData(); // Refresh list
      } else {
        showToast('No new events detected', 'info');
      }
    } catch (error) {
      showToast('Auto-detection failed', 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="timeline-page">
      {/* Header */}
      <div className="page-header">
        <h1>Organizational Timeline</h1>
        <div className="header-actions">
          <button onClick={handleAutoDetect} className="auto-detect-btn">
            <AIIcon /> Auto-Detect Events
          </button>
          <button onClick={() => setSelectedEvent('new')} className="create-btn">
            <PlusIcon /> Create Event
          </button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <section className="statistics-section">
        <TimelineStatistics stats={statistics} />
      </section>

      {/* Filters */}
      <section className="filters-section">
        <TimelineFilters
          filters={filters}
          onChange={setFilters}
        />
      </section>

      {/* Timeline Visualization */}
      <section className="timeline-visualization">
        <TimelineChart
          events={events}
          onEventClick={setSelectedEvent}
        />
      </section>

      {/* Event List */}
      <section className="events-list">
        <EventList
          events={events}
          onResolve={handleResolveEvent}
          onDelete={handleDeleteEvent}
          onView={setSelectedEvent}
        />
      </section>

      {/* Pagination */}
      <Pagination
        current={filters.page}
        total={Math.ceil(statistics?.totalEvents / filters.limit)}
        onChange={(page) => setFilters({ ...filters, page })}
      />

      {/* Event Detail Modal */}
      {selectedEvent && selectedEvent !== 'new' && (
        <EventDetailModal
          eventId={selectedEvent.id}
          onClose={() => setSelectedEvent(null)}
          onResolve={handleResolveEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Create Event Modal */}
      {selectedEvent === 'new' && (
        <CreateEventModal
          onClose={() => setSelectedEvent(null)}
          onCreate={handleCreateEvent}
        />
      )}
    </div>
  );
};

export default TimelinePage;
```

### Timeline Visualization Component
```javascript
import React from 'react';
import { format, parseISO } from 'date-fns';

const TimelineChart = ({ events, onEventClick }) => {
  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = format(parseISO(event.eventDate), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedEvents).sort().reverse();

  return (
    <div className="timeline-chart">
      <div className="timeline-axis">
        {sortedDates.map((date) => (
          <div key={date} className="timeline-date-group">
            <div className="date-marker">
              <span className="date-label">
                {format(parseISO(date), 'MMM dd, yyyy')}
              </span>
            </div>

            <div className="events-for-date">
              {groupedEvents[date].map((event) => (
                <div
                  key={event.id}
                  className={`timeline-event ${event.impactLevel} ${event.isResolved ? 'resolved' : ''}`}
                  onClick={() => onEventClick(event)}
                >
                  <div className="event-marker" />
                  <div className="event-card">
                    <div className="event-header">
                      <span className={`impact-indicator ${event.impactLevel}`} />
                      <h4>{event.title}</h4>
                      {event.isResolved && (
                        <span className="resolved-badge">✓</span>
                      )}
                    </div>
                    <p className="event-category">{event.category}</p>
                    {event.aiAnalysis && (
                      <div className="ai-badge">
                        <AIIcon /> AI Detected
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Event List Component
```javascript
const EventList = ({ events, onResolve, onDelete, onView }) => {
  return (
    <div className="event-list">
      <table>
        <thead>
          <tr>
            <th>Impact</th>
            <th>Title</th>
            <th>Category</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className={event.isResolved ? 'resolved' : ''}>
              <td>
                <span className={`impact-badge ${event.impactLevel}`}>
                  {event.impactLevel}
                </span>
              </td>
              <td>
                <div className="event-title">
                  {event.title}
                  {event.aiAnalysis && (
                    <span className="ai-tag" title="AI Detected">
                      <AIIcon />
                    </span>
                  )}
                </div>
              </td>
              <td>{event.category}</td>
              <td>{format(parseISO(event.eventDate), 'MMM dd, yyyy HH:mm')}</td>
              <td>
                {event.isResolved ? (
                  <span className="status-resolved">Resolved</span>
                ) : (
                  <span className="status-active">Active</span>
                )}
              </td>
              <td>
                <div className="action-buttons">
                  <button onClick={() => onView(event)} className="btn-view">
                    View
                  </button>
                  {!event.isResolved && (
                    <button
                      onClick={() => onResolve(event.id)}
                      className="btn-resolve"
                    >
                      Resolve
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(event.id)}
                    className="btn-delete"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### API Service Module
```javascript
// services/timelineApi.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

class TimelineApiService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async fetchTimelineEvents(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });

    const response = await fetch(
      `${API_BASE_URL}/timeline?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch timeline events: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchTimelineEvent(eventId) {
    const response = await fetch(
      `${API_BASE_URL}/timeline/${eventId}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch event: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchTimelineStatistics(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
      `${API_BASE_URL}/timeline/statistics?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }

    return await response.json();
  }

  async createTimelineEvent(eventData) {
    const response = await fetch(
      `${API_BASE_URL}/timeline`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(eventData)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create event: ${response.statusText}`);
    }

    return await response.json();
  }

  async updateTimelineEvent(eventId, updates) {
    const response = await fetch(
      `${API_BASE_URL}/timeline/${eventId}`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(updates)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update event: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteTimelineEvent(eventId) {
    const response = await fetch(
      `${API_BASE_URL}/timeline/${eventId}`,
      {
        method: 'DELETE',
        headers: this.headers
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete event: ${response.statusText}`);
    }

    return true;
  }

  async triggerAutoDetection() {
    const response = await fetch(
      `${API_BASE_URL}/timeline/auto-detect`,
      {
        method: 'POST',
        headers: this.headers
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to trigger auto-detection: ${response.statusText}`);
    }

    return await response.json();
  }
}

export default TimelineApiService;
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
    const { status, data } = error.response;

    switch (status) {
      case 400:
        showToast('Invalid request. Please check your input', 'error');
        break;
      case 401:
        redirectToLogin();
        break;
      case 403:
        showToast('You do not have permission to perform this action', 'error');
        break;
      case 404:
        showToast('Event not found', 'error');
        break;
      case 500:
        showToast('Server error. Please try again later', 'error');
        break;
      default:
        showToast(data.message || 'An error occurred', 'error');
    }
  } else if (error.request) {
    showToast('Network error. Please check your connection', 'error');
  } else {
    showToast('An unexpected error occurred', 'error');
  }
};

// Usage in component
try {
  const events = await fetchTimelineEvents(filters);
  setEvents(events);
} catch (error) {
  handleApiError(error);
}
```

---

## Best Practices

### 1. **Use React Query for Data Fetching**
```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const useTimelineEvents = (filters) => {
  return useQuery({
    queryKey: ['timeline-events', filters],
    queryFn: () => fetchTimelineEvents(filters),
    staleTime: 2 * 60 * 1000,  // 2 minutes
    cacheTime: 5 * 60 * 1000,  // 5 minutes
    retry: 2
  });
};

const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTimelineEvent,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['timeline-events']);
      showToast('Event created successfully', 'success');
    },
    onError: (error) => {
      handleApiError(error);
    }
  });
};

// Usage
const TimelinePage = () => {
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const { data, isLoading, error } = useTimelineEvents(filters);
  const createEvent = useCreateEvent();

  const handleCreate = (eventData) => {
    createEvent.mutate(eventData);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <TimelineView events={data.events} onCreate={handleCreate} />;
};
```

### 2. **Implement Optimistic Updates**
```javascript
const useResolveEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, resolutionNotes }) =>
      updateTimelineEvent(eventId, { isResolved: true, resolutionNotes }),

    onMutate: async ({ eventId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['timeline-events']);

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(['timeline-events']);

      // Optimistically update
      queryClient.setQueryData(['timeline-events'], (old) => ({
        ...old,
        events: old.events.map((e) =>
          e.id === eventId ? { ...e, isResolved: true } : e
        )
      }));

      return { previousEvents };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['timeline-events'], context.previousEvents);
      showToast('Failed to resolve event', 'error');
    },

    onSettled: () => {
      queryClient.invalidateQueries(['timeline-events']);
    }
  });
};
```

### 3. **Implement Real-time Updates with WebSockets**
```javascript
import { useEffect } from 'react';
import { io } from 'socket.io-client';

const useTimelineWebSocket = (onNewEvent, onEventUpdate) => {
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      auth: { token: accessToken }
    });

    socket.on('timeline:new-event', (event) => {
      onNewEvent(event);
      showToast(`New event detected: ${event.title}`, 'info');
    });

    socket.on('timeline:event-updated', (event) => {
      onEventUpdate(event);
    });

    socket.on('timeline:event-resolved', (event) => {
      onEventUpdate(event);
      showToast(`Event resolved: ${event.title}`, 'success');
    });

    return () => socket.disconnect();
  }, [onNewEvent, onEventUpdate]);
};

// Usage
const TimelinePage = () => {
  const [events, setEvents] = useState([]);

  useTimelineWebSocket(
    (newEvent) => setEvents([newEvent, ...events]),
    (updatedEvent) => setEvents(events.map(e =>
      e.id === updatedEvent.id ? updatedEvent : e
    ))
  );

  // Rest of component...
};
```

### 4. **Implement Virtual Scrolling for Large Lists**
```javascript
import { FixedSizeList } from 'react-window';

const VirtualEventList = ({ events, height = 600 }) => {
  const Row = ({ index, style }) => {
    const event = events[index];
    return (
      <div style={style}>
        <EventCard event={event} />
      </div>
    );
  };

  return (
    <FixedSizeList
      height={height}
      itemCount={events.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

### 5. **Implement Search and Filtering**
```javascript
const useTimelineSearch = (events, searchTerm) => {
  return useMemo(() => {
    if (!searchTerm) return events;

    const lowerSearch = searchTerm.toLowerCase();
    return events.filter(event =>
      event.title.toLowerCase().includes(lowerSearch) ||
      event.description?.toLowerCase().includes(lowerSearch) ||
      event.category.toLowerCase().includes(lowerSearch)
    );
  }, [events, searchTerm]);
};

// Usage
const TimelineList = ({ events }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredEvents = useTimelineSearch(events, searchTerm);

  return (
    <>
      <input
        type="text"
        placeholder="Search events..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <EventList events={filteredEvents} />
    </>
  );
};
```

### 6. **Export Timeline Data**
```javascript
const exportTimelineToCSV = (events) => {
  const headers = ['Title', 'Category', 'Impact Level', 'Date', 'Status', 'Resolution Notes'];

  const rows = events.map(event => [
    event.title,
    event.category,
    event.impactLevel,
    format(parseISO(event.eventDate), 'yyyy-MM-dd HH:mm'),
    event.isResolved ? 'Resolved' : 'Active',
    event.resolutionNotes || ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timeline-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
};
```

---

## Environment Configuration

### Development
```env
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_WS_URL=ws://localhost:3000
REACT_APP_ENABLE_MOCK=false
```

### Production
```env
REACT_APP_API_URL=https://your-domain.com/api/v1
REACT_APP_WS_URL=wss://your-domain.com
REACT_APP_ENABLE_MOCK=false
```

---

## Testing

### API Integration Tests
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import TimelinePage from './TimelinePage';

const mockEvents = [
  {
    id: 1,
    title: 'Test Event',
    impactLevel: 'high',
    category: 'Communication',
    eventDate: '2026-02-05T10:00:00Z',
    isResolved: false
  }
];

const server = setupServer(
  rest.get('/api/v1/timeline', (req, res, ctx) => {
    return res(ctx.json({
      events: mockEvents,
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1
    }));
  }),

  rest.get('/api/v1/timeline/statistics', (req, res, ctx) => {
    return res(ctx.json({
      totalEvents: 1,
      byImpactLevel: { high: 1, medium: 0, low: 0 },
      byCategory: { Communication: 1 },
      resolvedCount: 0,
      unresolvedCount: 1
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('displays timeline events', async () => {
  render(<TimelinePage />);

  await waitFor(() => {
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });
});

test('creates new event', async () => {
  const { user } = render(<TimelinePage />);

  await user.click(screen.getByText('Create Event'));
  await user.type(screen.getByPlaceholderText('Event Title'), 'New Event');
  await user.click(screen.getByText('Create'));

  await waitFor(() => {
    expect(screen.getByText('Event created successfully')).toBeInTheDocument();
  });
});
```

---

## Support

For API questions or issues:
- Backend API Documentation: `/api/docs` (Swagger UI)
- GitHub Issues: https://github.com/your-org/nexsentia/issues
- API Status: Check `/health` endpoint

---

## Changelog

### Version 1.0.0 (2026-02-05)
- Initial Timeline API documentation
- Complete CRUD operations for timeline events
- Statistics and aggregation endpoints
- Auto-detection integration
- Resolution tracking
- AI analysis support

---

## Related Documentation
- [Pulse Page Integration](./FRONTEND_PULSE_PAGE_INTEGRATION.md)
- [Authentication Guide](./AUTHENTICATION.md)
- [API Reference](./API_REFERENCE.md)
