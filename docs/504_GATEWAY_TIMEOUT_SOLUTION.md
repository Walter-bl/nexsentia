# 504 Bad Gateway Timeout - Complete Solution

## Problem

Multiple dashboard endpoints are experiencing **504 Bad Gateway** errors because:

1. **Heavy database operations** take 60+ seconds
2. **Gateway/Proxy timeout** is set to 60 seconds (default)
3. **Multiple sequential queries** compound the delay
4. **No caching** on most endpoints

## Affected Endpoints

| Endpoint | Status | Avg Time | Action Needed |
|----------|--------|----------|---------------|
| `/kpi/dashboard/organizational-pulse` | ✅ **FIXED** | 50ms (cached) | Cached (5min TTL) |
| `/kpi/dashboard/org-health` | ❌ **SLOW** | 60-90s | Need caching |
| `/kpi/dashboard/business-impact` | ❌ **SLOW** | 45-70s | Need caching |
| `/kpi/dashboard/team-impact` | ❌ **SLOW** | 50-80s | Need caching |
| `/kpi/dashboard/health-report` | ⚠️ **MODERATE** | 30-50s | Optional caching |

## Solutions (Choose One or Combine)

### Solution 1: Increase Gateway Timeout ⚡ (Quick Fix - 5 minutes)

**Pros**: Quick, no code changes
**Cons**: Doesn't fix slow performance, just prevents timeout

#### For AWS Elastic Beanstalk + Application Load Balancer

Create file: `.ebextensions/alb-timeout.config`
```yaml
option_settings:
  aws:elbv2:listener:default:
    IdleTimeout: 300  # 5 minutes (up from 60 seconds)
```

#### For Nginx Reverse Proxy

Edit `/etc/nginx/nginx.conf` or `/etc/nginx/sites-available/default`:
```nginx
http {
    # Increase timeouts
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_buffering off;

    upstream backend {
        server localhost:3000;
        keepalive 32;
    }

    server {
        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_read_timeout 300s;
            proxy_connect_timeout 300s;
        }
    }
}
```

**Deployment**:
```bash
# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# For Elastic Beanstalk
git add .ebextensions/alb-timeout.config
git commit -m "Increase ALB timeout to 5 minutes"
git push origin main
```

---

### Solution 2: Add Caching to All Slow Endpoints 🚀 (Best Fix - 30 minutes)

**Pros**: Dramatically improves performance, fixes root cause
**Cons**: Requires code changes

We already implemented caching for `organizational-pulse`. Extend it to other endpoints:

#### Step 1: Update Cache Service

Edit: `src/modules/kpi/services/organizational-pulse-cache.service.ts`

Rename to: `dashboard-cache.service.ts` and extend it:

```typescript
/**
 * Universal cache service for all dashboard endpoints
 */
@Injectable()
export class DashboardCacheService {
  private readonly CACHE_TTL = 300000; // 5 minutes

  getCacheKey(endpoint: string, tenantId: number, params: any): string {
    const paramString = JSON.stringify(params);
    return `dashboard:${endpoint}:${tenantId}:${paramString}`;
  }

  async get(endpoint: string, tenantId: number, params: any): Promise<any | null> {
    const key = this.getCacheKey(endpoint, tenantId, params);
    return await this.cacheManager.get(key);
  }

  async set(endpoint: string, tenantId: number, params: any, data: any): Promise<void> {
    const key = this.getCacheKey(endpoint, tenantId, params);
    await this.cacheManager.set(key, data, this.CACHE_TTL);
  }
}
```

#### Step 2: Add Caching to Each Endpoint

**Example for `org-health`**:

```typescript
@Get('org-health')
async getOrgHealthDashboard(
  @CurrentTenant() tenantId: number,
  @Query('periodStart') periodStart?: string,
  @Query('periodEnd') periodEnd?: string,
  @Query('timeRange') timeRange?: '7d' | '14d' | '1m' | '3m' | '6m' | '1y',
) {
  const params = { periodStart, periodEnd, timeRange };

  // Check cache
  const cached = await this.cache.get('org-health', tenantId, params);
  if (cached) return cached;

  // Calculate (slow)
  const result = await this.calculateOrgHealth(tenantId, periodStart, periodEnd, timeRange);

  // Store in cache
  await this.cache.set('org-health', tenantId, params, result);

  return result;
}
```

**Repeat for**:
- `business-impact`
- `team-impact`
- `health-report`

---

### Solution 3: Database Query Optimization 🔧 (Long-term Fix - 2-4 hours)

**Pros**: Permanent performance improvement
**Cons**: Requires database analysis and optimization

#### Add Missing Indexes

Analyze slow queries:
```sql
-- PostgreSQL
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Common missing indexes:
```sql
-- Weak signals
CREATE INDEX idx_weak_signals_tenant_detected
ON weak_signals(tenant_id, detected_at DESC);

CREATE INDEX idx_weak_signals_category
ON weak_signals(tenant_id, category);

-- Business impacts
CREATE INDEX idx_business_impacts_tenant_date
ON business_impacts(tenant_id, impact_date DESC);

-- Metric values
CREATE INDEX idx_metric_values_tenant_period
ON metric_values(tenant_id, period_start, period_end);
```

#### Use Database Views

Create materialized views for complex aggregations:
```sql
CREATE MATERIALIZED VIEW mv_organizational_pulse AS
SELECT
  tenant_id,
  date_trunc('day', detected_at) as day,
  category,
  COUNT(*) as signal_count,
  AVG(confidence_score) as avg_confidence
FROM weak_signals
WHERE detected_at > NOW() - INTERVAL '3 months'
GROUP BY tenant_id, day, category;

-- Refresh hourly via cron
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_organizational_pulse;
```

---

### Solution 4: Async Processing + Polling 🔄 (Advanced - 1-2 hours)

**Pros**: User never experiences timeout
**Cons**: More complex, requires frontend changes

#### Backend Implementation

```typescript
// Store job status
interface DashboardJob {
  id: string;
  tenantId: number;
  endpoint: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

@Post('org-health/request')
async requestOrgHealth(
  @CurrentTenant() tenantId: number,
  @Query() params: any,
): Promise<{ jobId: string }> {
  const jobId = uuidv4();

  // Start async processing
  this.processInBackground(jobId, tenantId, params);

  return { jobId, status: 'pending' };
}

@Get('jobs/:jobId')
async getJobStatus(@Param('jobId') jobId: string): Promise<DashboardJob> {
  return await this.jobRepository.findOne({ where: { id: jobId } });
}
```

#### Frontend Implementation

```typescript
// Request dashboard data
const { jobId } = await fetch('/kpi/dashboard/org-health/request').then(r => r.json());

// Poll for completion
const pollInterval = setInterval(async () => {
  const { status, result } = await fetch(`/kpi/dashboard/jobs/${jobId}`).then(r => r.json());

  if (status === 'completed') {
    clearInterval(pollInterval);
    displayDashboard(result);
  } else if (status === 'failed') {
    clearInterval(pollInterval);
    showError();
  }
}, 2000); // Poll every 2 seconds
```

---

## Recommended Approach

### **For Immediate Fix (Today):**
✅ **Solution 1**: Increase gateway timeout to 5 minutes

### **For Performance Fix (This Week):**
✅ **Solution 2**: Add caching to all slow endpoints

### **For Long-term Optimization (Next Sprint):**
✅ **Solution 3**: Database query optimization + indexes

## Implementation Priority

| Priority | Solution | Impact | Effort | Timeline |
|----------|----------|--------|--------|----------|
| 🔥 **P0** | Increase gateway timeout | Prevents 504 errors | 5 min | Today |
| ⚡ **P1** | Cache organizational-pulse | ✅ **DONE** | 30 min | ✅ Complete |
| 🚀 **P1** | Cache other endpoints | 95% faster | 1 hour | This week |
| 🔧 **P2** | Database optimization | 50% faster queries | 2-4 hours | Next sprint |
| 🔄 **P3** | Async + polling | Best UX | 1-2 hours | Future |

## Quick Start: Increase Timeout NOW

### AWS Elastic Beanstalk

1. Create `.ebextensions/alb-timeout.config`:
```yaml
option_settings:
  aws:elbv2:listener:default:
    IdleTimeout: 300
```

2. Deploy:
```bash
git add .ebextensions/alb-timeout.config
git commit -m "Increase ALB idle timeout to 5 minutes"
git push origin main
```

3. Wait for deployment (5-10 minutes)

4. Test:
```bash
time curl -X GET "https://your-domain.com/kpi/dashboard/organizational-pulse?timeRange=3m" \
  -H "Authorization: Bearer $TOKEN"

# Should complete without 504 error
```

### Nginx

1. Edit config:
```bash
sudo nano /etc/nginx/nginx.conf
```

2. Add timeouts:
```nginx
proxy_read_timeout 300s;
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
```

3. Reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Monitoring

After implementing solutions, monitor:

```bash
# Check response times
grep "OrganizationalPulse" logs/app.log | grep "Cache HIT\|Cache MISS"

# Check for 504 errors
grep "504\|Gateway Time-out" logs/nginx-error.log

# Monitor database query times
SELECT query, mean_exec_time FROM pg_stat_statements
WHERE query LIKE '%weak_signals%'
ORDER BY mean_exec_time DESC;
```

## Expected Results

### Before Fix
- ❌ 504 errors on 30-40% of dashboard requests
- ⏱️ 60-90 second response times
- 😡 Poor user experience

### After Gateway Timeout Increase
- ✅ No more 504 errors
- ⏱️ Still 60-90 second response times
- 😐 No timeouts, but still slow

### After Caching
- ✅ No 504 errors
- ✅ **50-100ms response times** (cached)
- ✅ 60s on first request only
- 😊 Great user experience

### After Database Optimization
- ✅ No 504 errors
- ✅ **20-30 second** first request
- ✅ **50ms** cached requests
- 🚀 Excellent performance

---

## Support

If issues persist after implementing these solutions:

1. **Check logs**:
```bash
# Application logs
tail -f logs/app.log | grep "504\|timeout\|slow"

# Gateway logs
tail -f /var/log/nginx/error.log
```

2. **Test specific endpoint**:
```bash
time curl -v -X GET "https://api.nexsentia.com/kpi/dashboard/organizational-pulse?timeRange=3m" \
  -H "Authorization: Bearer $TOKEN"
```

3. **Check cache**:
```bash
# Look for cache hits
grep "Cache HIT" logs/app.log | wc -l

# Cache hit rate
# hits / (hits + misses) * 100
```

---

**Status**: Solutions documented and ready to implement

**Priority**: P0 - Implement timeout increase immediately
