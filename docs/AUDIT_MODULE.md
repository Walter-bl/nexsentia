# Audit Module Documentation

The Audit Module provides comprehensive activity logging, tracking, and compliance features for the Nexsentia application. It automatically logs all API requests and provides powerful querying and export capabilities.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Automatic Logging](#automatic-logging)
- [Manual Logging](#manual-logging)
- [Querying Audit Logs](#querying-audit-logs)
- [Exporting Audit Logs](#exporting-audit-logs)
- [Scheduled Cleanup](#scheduled-cleanup)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Security & Privacy](#security--privacy)
- [Best Practices](#best-practices)

## Features

### ✅ Implemented Features

1. **Automatic Request Logging**
   - Logs all non-GET authenticated requests automatically
   - Captures HTTP method, path, status code, IP address, user agent
   - Records request duration and metadata
   - Sanitizes sensitive data (passwords, tokens, etc.)

2. **Manual Logging API**
   - Programmatic audit log creation
   - Flexible options for custom events
   - Support for before/after change tracking

3. **Powerful Querying**
   - Filter by user, action, resource, date range
   - Pagination support
   - Multi-tenant isolation

4. **CSV Export**
   - Export filtered logs to CSV format
   - Proper CSV escaping for data integrity
   - Includes all relevant audit fields

5. **Scheduled Cleanup**
   - Automatic deletion of old logs
   - Configurable retention period (default: 365 days)
   - Runs daily at 2:00 AM
   - Per-tenant cleanup

6. **Comprehensive Testing**
   - Unit tests for service, controller, interceptor
   - Edge case coverage
   - Error handling tests

## Architecture

### Components

```
audit/
├── entities/
│   └── audit-log.entity.ts          # Database entity
├── dto/
│   ├── create-audit-log.dto.ts      # Manual log creation
│   └── query-audit-log.dto.ts       # Query filters
├── audit.service.ts                  # Core audit logic
├── audit.controller.ts               # HTTP endpoints
├── audit-cleanup.service.ts          # Scheduled cleanup
├── audit.module.ts                   # Module definition
└── *.spec.ts                         # Test files

common/interceptors/
└── audit-logging.interceptor.ts      # Automatic logging

common/decorators/
└── skip-audit.decorator.ts           # Skip logging decorator
```

### Database Schema

**Table:** `audit_logs`

| Column         | Type      | Description                                  |
|----------------|-----------|----------------------------------------------|
| id             | INTEGER   | Primary key                                  |
| tenantId       | INTEGER   | Tenant ID for multi-tenancy                  |
| userId         | INTEGER   | User who performed the action (nullable)     |
| action         | VARCHAR   | Action performed (e.g., users.create)        |
| resource       | VARCHAR   | Resource type (e.g., users, tenants)         |
| resourceId     | INTEGER   | ID of the affected resource (nullable)       |
| metadata       | JSON      | Additional context data                      |
| changes        | JSON      | Before/after state of changes                |
| ipAddress      | VARCHAR   | Client IP address                            |
| userAgent      | VARCHAR   | Client user agent string                     |
| httpMethod     | VARCHAR   | HTTP method (GET, POST, PUT, DELETE)         |
| requestPath    | VARCHAR   | Full request path with query string          |
| statusCode     | INTEGER   | HTTP response status code                    |
| errorMessage   | VARCHAR   | Error message if request failed              |
| createdAt      | TIMESTAMP | When the log entry was created               |
| updatedAt      | TIMESTAMP | When the log entry was last updated          |

**Indexes:**
- `idx_audit_logs_tenant_user_action` on (tenantId, userId, action, createdAt)

## Automatic Logging

The `AuditLoggingInterceptor` automatically logs all authenticated API requests.

### What Gets Logged Automatically

- ✅ **POST** requests (create operations)
- ✅ **PUT/PATCH** requests (update operations)
- ✅ **DELETE** requests (delete operations)
- ❌ **GET** requests (skipped by default to reduce noise)
- ❌ **Public routes** (no authenticated user)

### How It Works

1. Interceptor checks if user is authenticated
2. Checks for `@SkipAudit()` decorator
3. Skips GET requests by default
4. Extracts action and resource from request path
5. Captures request/response metadata
6. Sanitizes sensitive data
7. Logs to database asynchronously (doesn't block request)

### Example Logged Request

```typescript
// Request: PUT /api/users/15
// Body: { firstName: "Jane" }

// Audit Log Created:
{
  id: 123,
  tenantId: 1,
  userId: 10,
  action: "users.update",
  resource: "users",
  resourceId: 15,
  httpMethod: "PUT",
  requestPath: "/api/users/15",
  statusCode: 200,
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  metadata: {
    duration: 120,
    requestBody: { firstName: "Jane" },
    queryParams: {}
  },
  createdAt: "2024-01-15T10:30:00Z"
}
```

### Skipping Automatic Logging

Use the `@SkipAudit()` decorator to skip logging for specific routes:

```typescript
import { SkipAudit } from '../../common/decorators/skip-audit.decorator';

@Post('bulk-import')
@SkipAudit() // This endpoint won't be automatically logged
async bulkImport(@Body() data: any) {
  // Your logic here
}
```

## Manual Logging

For custom events or more control, use the `AuditService` directly.

### Basic Manual Logging

```typescript
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../common/enums';

@Injectable()
export class MyService {
  constructor(private readonly auditService: AuditService) {}

  async performAction(tenantId: number, userId: number) {
    // Your business logic...

    // Log the action
    await this.auditService.log(tenantId, AuditAction.USER_CREATED, 'users', {
      userId,
      resourceId: newUser.id,
      metadata: { source: 'bulk-import' },
      ipAddress: req.ip,
    });
  }
}
```

### Advanced Manual Logging with Change Tracking

```typescript
async updateUser(userId: number, updates: any, currentUser: any) {
  const user = await this.findOne(userId);
  const before = { ...user };

  // Apply updates
  Object.assign(user, updates);
  await this.userRepository.save(user);

  const after = { ...user };

  // Log with before/after tracking
  await this.auditService.log(currentUser.tenantId, AuditAction.USER_UPDATED, 'users', {
    userId: currentUser.id,
    resourceId: userId,
    changes: { before, after },
    metadata: { updatedFields: Object.keys(updates) },
  });

  return user;
}
```

## Querying Audit Logs

### REST API

**Endpoint:** `GET /api/audit`

**Query Parameters:**

| Parameter   | Type    | Description                           | Example                  |
|-------------|---------|---------------------------------------|--------------------------|
| page        | number  | Page number (default: 1)              | `?page=2`                |
| limit       | number  | Items per page (default: 20)          | `&limit=50`              |
| userId      | number  | Filter by user ID                     | `&userId=10`             |
| action      | string  | Filter by action                      | `&action=users.update`   |
| resource    | string  | Filter by resource type               | `&resource=users`        |
| resourceId  | number  | Filter by resource ID                 | `&resourceId=15`         |
| fromDate    | string  | Start date (ISO 8601)                 | `&fromDate=2024-01-01`   |
| toDate      | string  | End date (ISO 8601)                   | `&toDate=2024-01-31`     |

**Example Request:**

```bash
GET /api/audit?userId=10&action=users.update&fromDate=2024-01-01&limit=50
Authorization: Bearer <jwt-token>
x-tenant-id: 1
```

**Example Response:**

```json
{
  "items": [
    {
      "id": 123,
      "userId": 10,
      "action": "users.update",
      "resource": "users",
      "resourceId": 15,
      "httpMethod": "PUT",
      "requestPath": "/api/users/15",
      "statusCode": 200,
      "metadata": {
        "duration": 120,
        "requestBody": { "firstName": "Jane" }
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

### Get User Activity

**Endpoint:** `GET /api/audit/user/:userId`

```bash
GET /api/audit/user/10?limit=100
```

### Get Resource History

**Endpoint:** `GET /api/audit/resource/:resource/:resourceId`

```bash
GET /api/audit/resource/users/15?limit=50
```

## Exporting Audit Logs

### CSV Export

**Endpoint:** `GET /api/audit/export`

Accepts the same query parameters as the main query endpoint.

**Example Request:**

```bash
GET /api/audit/export?fromDate=2024-01-01&toDate=2024-01-31
Authorization: Bearer <jwt-token>
x-tenant-id: 1
```

**Response:**

```csv
ID,Timestamp,User ID,User Email,Action,Resource,Resource ID,HTTP Method,Request Path,Status Code,IP Address,User Agent,Error Message
123,2024-01-15T10:30:00Z,10,john@example.com,users.update,users,15,PUT,/api/users/15,200,192.168.1.1,Mozilla/5.0,
124,2024-01-15T11:00:00Z,10,john@example.com,users.delete,users,20,DELETE,/api/users/20,200,192.168.1.1,Mozilla/5.0,
```

### Programmatic Export

```typescript
import { AuditService } from '../modules/audit/audit.service';

const csv = await this.auditService.exportToCsv(tenantId, {
  fromDate: '2024-01-01',
  toDate: '2024-01-31',
  action: 'users.update',
});

// Save to file or send via email
fs.writeFileSync('audit-report.csv', csv);
```

## Scheduled Cleanup

### Automatic Cleanup

The `AuditCleanupService` runs daily at 2:00 AM to delete old audit logs based on the retention policy.

**Configuration:**

```env
# .env
AUDIT_LOG_RETENTION_DAYS=365  # Keep logs for 1 year
```

**What Gets Cleaned:**

- Audit logs older than the retention period
- Runs for all active tenants
- Logs the number of deleted records

**Cron Schedule:**

```typescript
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async handleAuditLogCleanup() {
  // Cleanup logic
}
```

### Manual Cleanup

For on-demand cleanup or testing:

```typescript
import { AuditCleanupService } from '../modules/audit/audit-cleanup.service';

// Cleanup for specific tenant
const result = await this.auditCleanupService.manualCleanup(tenantId);
console.log(result.message); // "Deleted 150 audit log(s) older than 365 days"

// Cleanup for all tenants
const result = await this.auditCleanupService.manualCleanup();
console.log(result.message); // "Deleted 500 audit log(s) across 5 tenant(s)"
```

## API Endpoints

### Summary

| Method | Endpoint                                | Description                  | Permission      |
|--------|-----------------------------------------|------------------------------|-----------------|
| GET    | /api/audit                              | Query audit logs             | AUDIT_READ      |
| GET    | /api/audit/user/:userId                 | Get user activity            | AUDIT_READ      |
| GET    | /api/audit/resource/:resource/:resourceId | Get resource history       | AUDIT_READ      |
| GET    | /api/audit/export                       | Export logs to CSV           | AUDIT_READ      |

All endpoints require:
- Valid JWT token in `Authorization: Bearer <token>` header
- Tenant ID in `x-tenant-id` header
- `AUDIT_READ` permission

## Configuration

### Environment Variables

```env
# Audit Configuration
AUDIT_LOG_RETENTION_DAYS=365    # Days to keep audit logs (default: 365)
```

### Module Configuration

The audit module is automatically imported in `app.module.ts`:

```typescript
import { AuditModule } from './modules/audit/audit.module';
import { AuditLoggingInterceptor } from './common/interceptors/audit-logging.interceptor';

@Module({
  imports: [
    // ...
    AuditModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggingInterceptor, // Enables automatic logging
    },
  ],
})
export class AppModule {}
```

## Security & Privacy

### Data Sanitization

Sensitive fields are automatically redacted from audit logs:

**Redacted Fields:**
- `password`
- `currentPassword`
- `newPassword`
- `confirmPassword`
- `accessToken`
- `refreshToken`
- `token`
- `secret`
- `apiKey`
- `privateKey`

**Example:**

```typescript
// Request body:
{
  email: "user@example.com",
  password: "secret123",
  firstName: "John"
}

// Logged metadata:
{
  requestBody: {
    email: "user@example.com",
    password: "[REDACTED]",
    firstName: "John"
  }
}
```

### Multi-tenant Isolation

- All queries are automatically scoped to the current tenant
- Users can only view audit logs for their own tenant
- Tenant ID is extracted from the `x-tenant-id` header
- Database indexes ensure efficient tenant-specific queries

### Access Control

- All audit endpoints require the `AUDIT_READ` permission
- Only users with appropriate roles can access audit logs
- Typically limited to Admin and Super Admin roles

## Best Practices

### 1. Use Automatic Logging When Possible

Let the interceptor handle most logging automatically. Only use manual logging for:
- Custom business events
- Bulk operations that bypass normal endpoints
- Actions that don't map to HTTP requests

### 2. Include Meaningful Metadata

When manually logging, include context that helps with debugging and compliance:

```typescript
await this.auditService.log(tenantId, AuditAction.USER_CREATED, 'users', {
  userId: currentUser.id,
  resourceId: newUser.id,
  metadata: {
    source: 'bulk-import',
    importBatchId: batchId,
    totalUsers: users.length,
  },
});
```

### 3. Track Changes for Updates

For update operations, capture before/after state:

```typescript
const before = { ...entity };
// Apply updates
const after = { ...entity };

await this.auditService.log(tenantId, action, resource, {
  changes: { before, after },
});
```

### 4. Monitor Audit Log Size

- Check database size regularly
- Adjust retention period based on compliance requirements
- Consider archiving old logs to cold storage
- Use the export feature for long-term archival

### 5. Review Logs Regularly

Set up periodic reviews:
- Failed login attempts
- Administrative actions
- Bulk deletions
- Permission changes

### 6. Compliance Considerations

- **GDPR:** Include audit log deletion in user data deletion processes
- **SOC 2:** Ensure logs are tamper-proof (append-only pattern)
- **HIPAA:** Encrypt logs at rest and in transit
- **Retention:** Adjust `AUDIT_LOG_RETENTION_DAYS` based on legal requirements

## Testing

Run the comprehensive test suite:

```bash
# Run all audit module tests
npm test -- audit

# Run specific test file
npm test -- audit.service.spec.ts

# Run with coverage
npm test -- --coverage audit
```

**Test Coverage:**

- ✅ Service methods (create, log, findAll, findByUser, findByResource, deleteOldLogs, exportToCsv)
- ✅ Controller endpoints (all GET endpoints, export)
- ✅ Cleanup service (scheduled and manual cleanup)
- ✅ Interceptor (automatic logging, skipping, sanitization, error handling)
- ✅ Edge cases and error scenarios

## Troubleshooting

### Logs Not Being Created

**Symptom:** No audit logs appearing in database

**Possible Causes:**

1. User not authenticated → Interceptor skips public routes
2. GET request → Skipped by default
3. `@SkipAudit()` decorator present
4. Audit service error → Check application logs

**Solution:**

```bash
# Check application logs for errors
tail -f logs/application.log | grep -i audit

# Verify interceptor is registered
# Check app.module.ts for APP_INTERCEPTOR provider
```

### Cleanup Not Running

**Symptom:** Old logs not being deleted

**Possible Causes:**

1. Scheduler module not imported
2. Retention period too long
3. No active tenants

**Solution:**

```typescript
// Verify ScheduleModule is imported in app.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Required for cron jobs
    // ...
  ],
})
```

### Export Too Large

**Symptom:** CSV export times out or fails

**Solution:**

Use more specific filters to reduce result set:

```bash
# Instead of exporting all logs
GET /api/audit/export

# Export specific date range and resource
GET /api/audit/export?fromDate=2024-01-15&toDate=2024-01-16&resource=users
```

## Examples

### Example 1: Track User Login

```typescript
@Post('login')
@Public()
@SkipAudit() // Skip automatic logging
async login(@Body() loginDto: LoginDto, @Req() req: Request) {
  const user = await this.authService.validateUser(loginDto.email, loginDto.password);

  // Manual log for login event
  await this.auditService.log(user.tenantId, AuditAction.USER_LOGIN, 'auth', {
    userId: user.id,
    metadata: { method: 'email/password' },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return this.authService.login(user);
}
```

### Example 2: Track Failed Actions

```typescript
async deleteUser(id: number, currentUser: User) {
  try {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);

    // Success log (automatic via interceptor)
  } catch (error) {
    // Manual log for failure
    await this.auditService.log(currentUser.tenantId, AuditAction.USER_DELETED, 'users', {
      userId: currentUser.id,
      resourceId: id,
      errorMessage: error.message,
      statusCode: 500,
    });

    throw error;
  }
}
```

### Example 3: Generate Compliance Report

```typescript
async generateComplianceReport(tenantId: number, startDate: string, endDate: string) {
  // Query all administrative actions
  const adminLogs = await this.auditService.findAll(tenantId, {
    fromDate: startDate,
    toDate: endDate,
    action: 'users.delete', // or any admin action
  });

  // Export to CSV
  const csv = await this.auditService.exportToCsv(tenantId, {
    fromDate: startDate,
    toDate: endDate,
    action: 'users.delete',
  });

  // Send via email or save to S3
  await this.emailService.sendComplianceReport(csv);
}
```

## Future Enhancements

Potential improvements for future versions:

- [ ] Real-time audit log streaming via WebSocket
- [ ] Advanced analytics and reporting dashboard
- [ ] Anomaly detection (e.g., unusual access patterns)
- [ ] Integration with SIEM systems
- [ ] Audit log signing/verification for tamper detection
- [ ] Granular control over what gets logged per resource
- [ ] Custom retention policies per resource type
- [ ] Audit log replication to external systems

## Support

For issues or questions:

1. Check application logs for errors
2. Review this documentation
3. Check test files for usage examples
4. Consult the codebase comments
5. Open an issue on the project repository
