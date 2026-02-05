# Frontend Integration Guide - Privacy & Data Page

## Overview
This guide provides complete API integration details for the NexSentia Privacy & Data Page, which displays privacy-first architecture metrics, connected data sources with anonymization statistics, privacy guarantees, and compliance status.

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

All Privacy endpoints require JWT authentication. Include the access token in the Authorization header:

```javascript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};
```

The tenant ID is automatically extracted from the JWT token.

---

## API Endpoints

### Base URL
```
Production: https://your-domain.com/api/v1/privacy
Development: http://localhost:3000/api/v1/privacy
```

---

## 1. Privacy Dashboard Overview

### GET `/dashboard`
**Primary endpoint for the complete Privacy & Data page**

#### Example Request
```javascript
const fetchPrivacyDashboard = async () => {
  const response = await fetch(
    `${API_BASE_URL}/privacy/dashboard`,
    { headers }
  );
  return await response.json();
};
```

#### Response Structure
```typescript
interface PrivacyDashboardResponse {
  privacyArchitecture: {
    anonymizationRate: number;     // Percentage (0-100)
    piiStored: number;              // Number of PII records stored (should be 0)
    soc2Compliant: boolean;
    gdprCompliant: boolean;
    message: string;
  };

  dataSources: {
    totalSources: number;
    totalPiiStored: number;
    activeConnections: number;
    lastUpdate: string | null;     // ISO date string
    sources: DataSource[];
  };

  privacyGuarantees: {
    fullyAnonymized: {
      enabled: boolean;
      description: string;
    };
    noPersonalIdentification: {
      enabled: boolean;
      description: string;
    };
    noDataStorage: {
      enabled: boolean;
      description: string;
    };
    ephemeralProcessing: {
      enabled: boolean;
      description: string;
    };
  };

  complianceStatus: {
    soc2: {
      compliant: boolean;
      lastAudit: string;            // ISO date
      nextAudit: string;            // ISO date
    };
    gdpr: {
      compliant: boolean;
      dataProcessingAgreement: boolean;
      rightToErasure: boolean;
      dataPortability: boolean;
    };
    hipaa: {
      compliant: boolean;
      reason?: string;
    };
    ccpa: {
      compliant: boolean;
      optOutMechanism: boolean;
      dataDisclosure: boolean;
    };
  };
}

interface DataSource {
  id: string;                       // e.g., "jira", "slack", "teams"
  name: string;                     // Display name
  platform: string;                 // Platform description
  isConnected: boolean;
  users: number;
  threads: number;
  participants: number;
  piiStored: number;
  lastSync: string | null;          // ISO date string
  category: string;                 // e.g., "Communication"
  itemsProcessed: number;
}
```

#### Frontend Integration Example
```javascript
import React, { useState, useEffect } from 'react';

const PrivacyDataPage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchPrivacyDashboard();
        setDashboardData(data);
      } catch (error) {
        console.error('Failed to fetch privacy dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="privacy-page">
      {/* Privacy-First Architecture */}
      <section className="privacy-architecture">
        <h2>PRIVACY-FIRST ARCHITECTURE</h2>
        <p>{dashboardData.privacyArchitecture.message}</p>

        <div className="architecture-metrics">
          <MetricCard
            value={`${dashboardData.privacyArchitecture.anonymizationRate}%`}
            label="Anonymized"
          />
          <MetricCard
            value={dashboardData.privacyArchitecture.piiStored}
            label="PII Stored"
          />
          <MetricCard
            value={dashboardData.privacyArchitecture.soc2Compliant ? 'SOC2' : 'N/A'}
            label="Compliant"
            status={dashboardData.privacyArchitecture.soc2Compliant}
          />
          <MetricCard
            value={dashboardData.privacyArchitecture.gdprCompliant ? 'GDPR' : 'N/A'}
            label="Compliant"
            status={dashboardData.privacyArchitecture.gdprCompliant}
          />
        </div>
      </section>

      {/* Data Sources */}
      <section className="data-sources">
        <h2>Data Sources</h2>
        <p>Connected integrations and data pipelines</p>

        <div className="sources-summary">
          <div className="summary-card">
            <span className="value">{dashboardData.dataSources.totalSources}</span>
            <span className="label">Sources</span>
          </div>
          <div className="summary-card">
            <span className="value">{dashboardData.dataSources.totalPiiStored.toLocaleString()}</span>
            <span className="label">PII Stored</span>
          </div>
          <div className="summary-card">
            <span className="value">{dashboardData.dataSources.activeConnections}</span>
            <span className="label">Active Connections</span>
          </div>
          <div className="summary-card">
            <span className="value">
              {dashboardData.dataSources.lastUpdate
                ? formatDistanceToNow(parseISO(dashboardData.dataSources.lastUpdate))
                : 'Never'}
            </span>
            <span className="label">Last Update</span>
          </div>
        </div>

        <DataSourcesGrid sources={dashboardData.dataSources.sources} />
      </section>

      {/* Privacy Guarantees */}
      <section className="privacy-guarantees">
        <h2>PRIVACY GUARANTEES</h2>
        <PrivacyGuaranteesList guarantees={dashboardData.privacyGuarantees} />
      </section>
    </div>
  );
};
```

---

## 2. Privacy Architecture Metrics

### GET `/dashboard/architecture`
**Get privacy-first architecture metrics**

#### Example Request
```javascript
const fetchPrivacyArchitecture = async () => {
  const response = await fetch(
    `${API_BASE_URL}/privacy/dashboard/architecture`,
    { headers }
  );
  return await response.json();
};
```

#### Response
```typescript
interface PrivacyArchitectureResponse {
  anonymizationRate: number;        // 0-100
  piiStored: number;                // Should be 0 for privacy-first
  soc2Compliant: boolean;
  gdprCompliant: boolean;
  message: string;
}
```

#### Frontend Component Example
```javascript
const PrivacyArchitecture = () => {
  const [architecture, setArchitecture] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchPrivacyArchitecture();
      setArchitecture(data);
    };
    fetchData();
  }, []);

  if (!architecture) return <LoadingSpinner />;

  return (
    <div className="privacy-architecture-card">
      <div className="shield-icon">
        <ShieldCheckIcon />
      </div>
      <h3>PRIVACY-FIRST ARCHITECTURE</h3>
      <p>{architecture.message}</p>

      <div className="metrics-grid">
        <div className="metric-large">
          <div className="percentage-circle">
            <CircularProgress value={architecture.anonymizationRate} />
            <span className="value">{architecture.anonymizationRate}%</span>
          </div>
          <span className="label">Anonymized</span>
        </div>

        <div className="metric">
          <span className="value">{architecture.piiStored}</span>
          <span className="label">PII Stored</span>
        </div>

        <div className="metric">
          <div className={`badge ${architecture.soc2Compliant ? 'compliant' : 'not-compliant'}`}>
            SOC2
          </div>
          <span className="label">Compliant</span>
        </div>

        <div className="metric">
          <div className={`badge ${architecture.gdprCompliant ? 'compliant' : 'not-compliant'}`}>
            GDPR
          </div>
          <span className="label">Compliant</span>
        </div>
      </div>
    </div>
  );
};
```

---

## 3. Data Sources Statistics

### GET `/dashboard/data-sources`
**Get all connected data sources with privacy statistics**

#### Example Request
```javascript
const fetchDataSources = async () => {
  const response = await fetch(
    `${API_BASE_URL}/privacy/dashboard/data-sources`,
    { headers }
  );
  return await response.json();
};
```

#### Response
```typescript
interface DataSourcesResponse {
  totalSources: number;
  totalPiiStored: number;
  activeConnections: number;
  lastUpdate: string | null;
  sources: DataSource[];
}

interface DataSource {
  id: string;
  name: string;
  platform: string;
  isConnected: boolean;
  users: number;
  threads: number;
  participants: number;
  piiStored: number;
  lastSync: string | null;
  category: string;
  itemsProcessed: number;
}
```

#### Frontend Component Example
```javascript
const DataSourcesGrid = ({ sources }) => {
  return (
    <div className="data-sources-grid">
      {sources.map((source) => (
        <DataSourceCard key={source.id} source={source} />
      ))}
    </div>
  );
};

const DataSourceCard = ({ source }) => {
  return (
    <div className={`data-source-card ${source.isConnected ? 'connected' : 'disconnected'}`}>
      <div className="card-header">
        <div className="source-icon">
          <SourceIcon name={source.id} />
        </div>
        <div className="source-info">
          <h4>{source.name}</h4>
          <p className="platform">{source.platform}</p>
        </div>
        <div className="connection-status">
          {source.isConnected ? (
            <span className="badge connected">CONNECTED</span>
          ) : (
            <span className="badge disconnected">NOT CONNECTED</span>
          )}
        </div>
      </div>

      <div className="card-body">
        <div className="stats-row">
          <div className="stat">
            <span className="value">{source.users.toLocaleString()}</span>
            <span className="label">Users</span>
          </div>
          <div className="stat">
            <span className="value">{source.threads.toLocaleString()}</span>
            <span className="label">Threads</span>
          </div>
          <div className="stat">
            <span className="value">{source.participants.toLocaleString()}</span>
            <span className="label">Participants</span>
          </div>
        </div>

        <div className="card-footer">
          <div className="sync-info">
            <ClockIcon />
            <span>
              Last sync: {source.lastSync
                ? format(parseISO(source.lastSync), 'HH:mm')
                : 'Never'}
            </span>
          </div>
          <div className="processing-stats">
            <DatabaseIcon />
            <span>{source.category}</span>
            <span className="items">
              {Math.round(source.itemsProcessed).toLocaleString()} items
            </span>
          </div>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Privacy Guarantees

### GET `/dashboard/guarantees`
**Get privacy guarantees and features**

#### Example Request
```javascript
const fetchPrivacyGuarantees = async () => {
  const response = await fetch(
    `${API_BASE_URL}/privacy/dashboard/guarantees`,
    { headers }
  );
  return await response.json();
};
```

#### Response
```typescript
interface PrivacyGuaranteesResponse {
  fullyAnonymized: {
    enabled: boolean;
    description: string;
  };
  noPersonalIdentification: {
    enabled: boolean;
    description: string;
  };
  noDataStorage: {
    enabled: boolean;
    description: string;
  };
  ephemeralProcessing: {
    enabled: boolean;
    description: string;
  };
}
```

#### Frontend Component Example
```javascript
const PrivacyGuaranteesList = ({ guarantees }) => {
  const guaranteesList = [
    {
      key: 'fullyAnonymized',
      title: 'Fully Anonymized',
      icon: <ShieldCheckIcon />,
      ...guarantees.fullyAnonymized,
    },
    {
      key: 'noPersonalIdentification',
      title: 'No Personal Identification',
      icon: <UserSlashIcon />,
      ...guarantees.noPersonalIdentification,
    },
    {
      key: 'noDataStorage',
      title: 'No Data Storage',
      icon: <DatabaseSlashIcon />,
      ...guarantees.noDataStorage,
    },
    {
      key: 'ephemeralProcessing',
      title: 'Ephemeral Processing',
      icon: <CloudIcon />,
      ...guarantees.ephemeralProcessing,
    },
  ];

  return (
    <div className="privacy-guarantees-grid">
      {guaranteesList.map((guarantee) => (
        <div key={guarantee.key} className="guarantee-card">
          <div className="icon-wrapper">
            {guarantee.icon}
          </div>
          <div className="guarantee-content">
            <h4>{guarantee.title}</h4>
            <p>{guarantee.description}</p>
            {guarantee.enabled && (
              <div className="status-badge enabled">
                <CheckIcon /> Enabled
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 5. Compliance Status

### GET `/dashboard/compliance`
**Get compliance status for various regulations**

#### Example Request
```javascript
const fetchComplianceStatus = async () => {
  const response = await fetch(
    `${API_BASE_URL}/privacy/dashboard/compliance`,
    { headers }
  );
  return await response.json();
};
```

#### Response
```typescript
interface ComplianceStatusResponse {
  soc2: {
    compliant: boolean;
    lastAudit: string;              // ISO date
    nextAudit: string;              // ISO date
  };
  gdpr: {
    compliant: boolean;
    dataProcessingAgreement: boolean;
    rightToErasure: boolean;
    dataPortability: boolean;
  };
  hipaa: {
    compliant: boolean;
    reason?: string;
  };
  ccpa: {
    compliant: boolean;
    optOutMechanism: boolean;
    dataDisclosure: boolean;
  };
}
```

#### Frontend Component Example
```javascript
const ComplianceStatus = ({ compliance }) => {
  return (
    <div className="compliance-section">
      <h2>Compliance Status</h2>

      <div className="compliance-grid">
        {/* SOC2 */}
        <div className="compliance-card">
          <div className="header">
            <h4>SOC 2</h4>
            <span className={`status ${compliance.soc2.compliant ? 'compliant' : 'not-compliant'}`}>
              {compliance.soc2.compliant ? 'Compliant' : 'Not Compliant'}
            </span>
          </div>
          <div className="details">
            <p>Last Audit: {format(parseISO(compliance.soc2.lastAudit), 'MMM dd, yyyy')}</p>
            <p>Next Audit: {format(parseISO(compliance.soc2.nextAudit), 'MMM dd, yyyy')}</p>
          </div>
        </div>

        {/* GDPR */}
        <div className="compliance-card">
          <div className="header">
            <h4>GDPR</h4>
            <span className={`status ${compliance.gdpr.compliant ? 'compliant' : 'not-compliant'}`}>
              {compliance.gdpr.compliant ? 'Compliant' : 'Not Compliant'}
            </span>
          </div>
          <div className="details">
            <div className="feature">
              <CheckIcon />
              <span>Data Processing Agreement</span>
            </div>
            <div className="feature">
              <CheckIcon />
              <span>Right to Erasure</span>
            </div>
            <div className="feature">
              <CheckIcon />
              <span>Data Portability</span>
            </div>
          </div>
        </div>

        {/* HIPAA */}
        <div className="compliance-card">
          <div className="header">
            <h4>HIPAA</h4>
            <span className={`status ${compliance.hipaa.compliant ? 'compliant' : 'not-applicable'}`}>
              {compliance.hipaa.compliant ? 'Compliant' : 'N/A'}
            </span>
          </div>
          {compliance.hipaa.reason && (
            <div className="details">
              <p>{compliance.hipaa.reason}</p>
            </div>
          )}
        </div>

        {/* CCPA */}
        <div className="compliance-card">
          <div className="header">
            <h4>CCPA</h4>
            <span className={`status ${compliance.ccpa.compliant ? 'compliant' : 'not-compliant'}`}>
              {compliance.ccpa.compliant ? 'Compliant' : 'Not Compliant'}
            </span>
          </div>
          <div className="details">
            <div className="feature">
              <CheckIcon />
              <span>Opt-Out Mechanism</span>
            </div>
            <div className="feature">
              <CheckIcon />
              <span>Data Disclosure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## Complete Component Integration Example

### Full Privacy & Data Page Component
```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { fetchPrivacyDashboard } from './services/privacyApi';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

const PrivacyDataPage = () => {
  const { accessToken } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const data = await fetchPrivacyDashboard();
        setDashboardData(data);
      } catch (err) {
        console.error('Failed to load privacy dashboard:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [accessToken]);

  if (loading) {
    return (
      <div className="privacy-page-loading">
        <LoadingSpinner />
        <p>Loading privacy dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="privacy-page-error">
        <ErrorIcon />
        <h3>Failed to load privacy dashboard</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="privacy-data-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Privacy Control</h1>
        <p>Trust & data governance</p>
      </div>

      {/* Privacy-First Architecture */}
      <section className="privacy-architecture-section">
        <div className="architecture-card">
          <div className="card-header">
            <ShieldIcon />
            <div>
              <h2>PRIVACY-FIRST ARCHITECTURE</h2>
              <p>{dashboardData.privacyArchitecture.message}</p>
            </div>
          </div>

          <div className="metrics-row">
            <div className="metric-card highlight">
              <div className="circular-progress">
                <CircularProgressBar
                  value={dashboardData.privacyArchitecture.anonymizationRate}
                  color="#00FFA3"
                />
              </div>
              <div className="metric-label">Anonymized</div>
            </div>

            <div className="metric-card">
              <div className="metric-value">
                {dashboardData.privacyArchitecture.piiStored}
              </div>
              <div className="metric-label">PII Stored</div>
            </div>

            <div className="metric-card">
              <div className="badge-large compliant">SOC2</div>
              <div className="metric-label">Compliant</div>
            </div>

            <div className="metric-card">
              <div className="badge-large compliant">GDPR</div>
              <div className="metric-label">Compliant</div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="data-sources-section">
        <div className="section-header">
          <h2>Data Sources</h2>
          <p>Connected integrations and data pipelines</p>
        </div>

        <div className="sources-summary">
          <SummaryCard
            value={dashboardData.dataSources.totalSources}
            label="Sources"
          />
          <SummaryCard
            value={dashboardData.dataSources.totalPiiStored.toLocaleString()}
            label="PII Stored"
          />
          <SummaryCard
            value={dashboardData.dataSources.activeConnections}
            label="Active Connections"
          />
          <SummaryCard
            value={
              dashboardData.dataSources.lastUpdate
                ? formatDistanceToNow(parseISO(dashboardData.dataSources.lastUpdate)) + ' ago'
                : 'Never'
            }
            label="Last Update"
          />
        </div>

        <div className="sources-grid">
          {dashboardData.dataSources.sources.map((source) => (
            <DataSourceCard key={source.id} source={source} />
          ))}
        </div>
      </section>

      {/* Privacy Guarantees */}
      <section className="privacy-guarantees-section">
        <h2>PRIVACY GUARANTEES</h2>
        <PrivacyGuaranteesList guarantees={dashboardData.privacyGuarantees} />
      </section>

      {/* Compliance Status */}
      <section className="compliance-section">
        <ComplianceStatus compliance={dashboardData.complianceStatus} />
      </section>
    </div>
  );
};

export default PrivacyDataPage;
```

### API Service Module
```javascript
// services/privacyApi.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

class PrivacyApiService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async fetchPrivacyDashboard() {
    const response = await fetch(
      `${API_BASE_URL}/privacy/dashboard`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch privacy dashboard: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchPrivacyArchitecture() {
    const response = await fetch(
      `${API_BASE_URL}/privacy/dashboard/architecture`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch architecture: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchDataSources() {
    const response = await fetch(
      `${API_BASE_URL}/privacy/dashboard/data-sources`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch data sources: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchPrivacyGuarantees() {
    const response = await fetch(
      `${API_BASE_URL}/privacy/dashboard/guarantees`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch guarantees: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchComplianceStatus() {
    const response = await fetch(
      `${API_BASE_URL}/privacy/dashboard/compliance`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch compliance: ${response.statusText}`);
    }

    return await response.json();
  }
}

export default PrivacyApiService;
```

---

## Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case 401:
        redirectToLogin();
        break;
      case 403:
        showToast('You do not have permission to view privacy data', 'error');
        break;
      case 500:
        showToast('Server error. Please try again later', 'error');
        break;
      default:
        showToast(data.message || 'An error occurred', 'error');
    }
  } else {
    showToast('Network error. Please check your connection', 'error');
  }
};
```

---

## Best Practices

### 1. **Use React Query for Caching**
```javascript
import { useQuery } from '@tanstack/react-query';

const usePrivacyDashboard = () => {
  return useQuery({
    queryKey: ['privacy-dashboard'],
    queryFn: fetchPrivacyDashboard,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

### 2. **Auto-refresh Data**
```javascript
const useAutoRefresh = (fetchFn, interval = 60000) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const result = await fetchFn();
      setData(result);
    };

    loadData();
    const intervalId = setInterval(loadData, interval);

    return () => clearInterval(intervalId);
  }, [fetchFn, interval]);

  return data;
};
```

### 3. **Animate Metrics**
```javascript
import { useSpring, animated } from 'react-spring';

const AnimatedMetric = ({ value }) => {
  const props = useSpring({ number: value, from: { number: 0 } });

  return (
    <animated.span>
      {props.number.to((n) => n.toFixed(0))}
    </animated.span>
  );
};
```

---

## Environment Configuration

### Development
```env
REACT_APP_API_URL=http://localhost:3000/api/v1
```

### Production
```env
REACT_APP_API_URL=https://your-domain.com/api/v1
```

---

## Changelog

### Version 1.0.0 (2026-02-05)
- Initial Privacy & Data dashboard API
- Privacy architecture metrics
- Data sources statistics
- Privacy guarantees
- Compliance status (SOC2, GDPR, HIPAA, CCPA)

---

## Related Documentation
- [Pulse Page Integration](./FRONTEND_PULSE_PAGE_INTEGRATION.md)
- [Timeline Page Integration](./FRONTEND_TIMELINE_PAGE_INTEGRATION.md)
- [Authentication Guide](./AUTHENTICATION.md)
