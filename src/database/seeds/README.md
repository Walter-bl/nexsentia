# Database Seeders

This directory contains database seeders for populating demo and initial data.

## Available Seeders

### 1. Roles & Permissions Seeder (TypeScript)

**File:** `roles-permissions.seeder.ts`

Seeds the RBAC system with default roles and permissions.

### 2. Integration Data Seeders (TypeScript)

Separate TypeScript seeders for each integration.

**Files:**
- `jira.seeder.ts` - Jira integration demo data
- `slack.seeder.ts` - Slack integration demo data
- `teams.seeder.ts` - Teams integration demo data
- `servicenow.seeder.ts` - ServiceNow integration demo data

## Usage

### Seed All Data (Recommended)

```bash
# Development - Seeds roles, permissions, and all integration data
npm run seed

# Production
npm run seed:prod
```

### What Gets Seeded

| Integration | Connections | Projects/Channels | Items | Details |
|-------------|-------------|-------------------|-------|---------|
| **Jira** | 1 | 3 projects | 20 issues | PROD (6 incidents), ENG (8 stories/tasks), SUP (6 bugs) |
| **Slack** | 1 | 3 channels | 15 messages | #general, #engineering, #incidents |
| **Teams** | 1 | 3 channels | 10 messages | General, Engineering, Support |
| **ServiceNow** | 1 | N/A | 10 incidents | Critical, High, Moderate, Low priorities |
| **Total** | **4** | **9** | **55 items** | |

## Configuration

### Change Tenant ID

Edit `src/database/seeds/index.ts` (line 29):

```typescript
const demoTenantId = 1;  // Change to your tenant ID
```

## Complete Setup Process

For a fresh database setup:

```bash
# 1. Run migrations
npm run migration:run

# 2. Seed all data (roles + integrations)
npm run seed
```

## Verification

### Via SQL

```sql
-- Check integration data counts
SELECT 'Jira Issues' AS Entity, COUNT(*) AS Count FROM jira_issues WHERE tenantId = 1
UNION ALL
SELECT 'Slack Messages', COUNT(*) FROM slack_messages WHERE tenantId = 1
UNION ALL
SELECT 'Teams Messages', COUNT(*) FROM teams_messages WHERE tenantId = 1
UNION ALL
SELECT 'ServiceNow Incidents', COUNT(*) FROM servicenow_incidents WHERE tenantId = 1;
```

### Via API

```bash
# Get Jira issues
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/jira/issues

# Get Slack messages
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/slack/messages

# Get Teams messages
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/teams/messages

# Get ServiceNow incidents
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/servicenow/incidents
```

## Seeder Details

### Jira Seeder (jira.seeder.ts)

**Demo Data:**
- Connection: Demo Jira Cloud workspace
- Projects:
  - PROD (Production Support) - 3 critical/high incidents
  - ENG (Engineering) - 2 stories with story points
  - SUP (Customer Support) - 2 bug tickets

**Sample Issues:**
- `PROD-1234`: Payment gateway timeout (Critical, Resolved)
- `ENG-567`: Real-time notifications (Story, 8 points, In Progress)
- `SUP-2267`: Export functionality bug (Medium, In Progress)

### Slack Seeder (slack.seeder.ts)

**Demo Data:**
- Workspace: Demo Company Slack
- Channels:
  - #general (156 members)
  - #engineering (42 members)
  - #incidents (28 members)

**Sample Messages:**
- Incident coordination thread (payment gateway issue)
- PR review notifications
- Sprint retrospective discussions

### Teams Seeder (teams.seeder.ts)

**Demo Data:**
- Workspace: Demo Company Teams
- Channels:
  - General
  - Engineering
  - Support

**Sample Messages:**
- Code review requests with Azure DevOps links
- Sprint retrospective updates
- VIP customer escalations (urgent priority)

### ServiceNow Seeder (servicenow.seeder.ts)

**Demo Data:**
- Instance: Demo ServiceNow

**Sample Incidents:**
- `INC0010234`: Email service outage (Critical, Resolved, 523 users affected)
- `INC0010789`: Database connection failures (Critical, In Progress, 1200 users affected)
- `INC0010891`: VPN connectivity issues (Moderate, Resolved, 42 users affected)

## Troubleshooting

### Foreign Key Constraint Errors

**Issue:** `Cannot add or update a child row: a foreign key constraint fails`

**Solution:** Ensure the tenant exists before running seeders:
```sql
SELECT id, name FROM tenants WHERE id = 1;
```

If the tenant doesn't exist, create it by registering a user through the API.

### Duplicate Entry Errors

**Issue:** Seeders report duplicate key errors

**Solution:** Seeders are idempotent - they check for existing data before inserting. If you see "already exists" messages, this is normal behavior.

### Build Errors

**Issue:** `npm run seed` fails with TypeScript errors

**Solution:** Run build first:
```bash
npm run build
npm run seed
```

## Documentation

For detailed documentation, see:
- [INTEGRATION_SEEDERS_GUIDE.md](../../../INTEGRATION_SEEDERS_GUIDE.md) - Complete seeder guide
- [FRONTEND_PULSE_PAGE_INTEGRATION.md](../../../FRONTEND_PULSE_PAGE_INTEGRATION.md) - API integration guide
- [PULSE_PAGE_API_VERIFICATION.md](../../../PULSE_PAGE_API_VERIFICATION.md) - API checklist
