# NexSentia Postman Collection

This directory contains Postman collections and environments for testing the NexSentia API.

## Files

- **NexSentia-Jira-Module.postman_collection.json** - Complete API collection for Jira integration
- **NexSentia-Local.postman_environment.json** - Local development environment variables

## Setup Instructions

### 1. Import Collection and Environment

1. Open Postman
2. Click **Import** button
3. Select both JSON files from this directory
4. The collection and environment will be imported

### 2. Configure Environment

1. Select **NexSentia - Local Development** environment from the dropdown
2. Set the following variables:
   - `base_url` - Already set to `http://localhost:3000/api/v1`
   - `jwt_token` - Your JWT authentication token (get this from login endpoint)
   - `tenant_id` - Your tenant ID (default: 1)

### 3. Get JWT Token

Before using the Jira endpoints, you need to authenticate:

1. Use your authentication endpoint to login
2. Copy the JWT token from the response
3. Set it in the environment variable `jwt_token`

**OR** manually set the Authorization header in each request.

## Collection Structure

### 1. OAuth (5 requests)
Complete OAuth 2.0 flow for Jira authentication:
- **Initiate OAuth Authorization** - Get authorization URL
- **Complete OAuth Flow** - Exchange code for tokens and create connection
- **Get OAuth Status** - Check token expiration and status
- **Refresh OAuth Token** - Manually refresh access token
- **Revoke OAuth Access** - Disconnect from Jira

### 2. Connections (6 requests)
Manage Jira connections:
- **List All Connections** - Get all connections with pagination
- **Get Connection by ID** - Get specific connection details
- **Update Connection** - Update settings and configuration
- **Delete Connection** - Soft delete a connection
- **Trigger Manual Sync** - Start data synchronization
- **Get Sync History** - View sync logs and history

### 3. Issues (3 requests)
Query Jira issues:
- **List All Issues** - Get issues with filtering, pagination, and sorting
- **Get Issue by Key** - Get specific issue by Jira key (e.g., PROJ-123)
- **Get Issue by ID** - Get specific issue by database ID

### 4. Webhooks (1 request)
Real-time updates:
- **Receive Jira Webhook** - Public endpoint for Jira webhooks (no auth)

## OAuth Flow Example

### Step-by-Step Guide:

1. **Initiate OAuth**
   ```
   GET /jira/oauth/authorize?connectionName=Main Jira Instance
   ```
   - Copy the `authorizationUrl` from the response
   - Open it in your browser
   - Login to Atlassian and authorize the app

2. **Get Authorization Code**
   - After authorization, Jira redirects to the callback URL
   - Copy the `code` parameter from the URL
   - Set it as the `oauth_code` environment variable

3. **Complete OAuth**
   ```
   POST /jira/oauth/complete
   {
     "code": "{{oauth_code}}",
     "connectionName": "Main Jira Instance"
   }
   ```
   - This creates the connection and stores tokens
   - The `connection_id` is automatically saved to environment

4. **Use the Connection**
   - All subsequent requests use the saved `connection_id`
   - OAuth tokens are automatically refreshed when needed

## Query Parameters Reference

### List All Issues
Use any combination of these filters:

```
GET /jira/issues?projectId=1&status=In Progress&assignee=account-id&page=1&limit=50&sortBy=updated&sortOrder=DESC
```

**Available Filters:**
- `projectId` - Filter by project ID
- `status` - Filter by status name
- `assignee` - Filter by assignee account ID
- `issueType` - Filter by issue type (Story, Bug, etc.)
- `updatedAfter` - Filter by update date (ISO 8601 format)

**Pagination:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Sorting:**
- `sortBy` - Field to sort by (created, updated, priority, status)
- `sortOrder` - ASC or DESC (default: DESC)

## Common Use Cases

### Use Case 1: Initial Setup
1. Run "Initiate OAuth Authorization"
2. Open the URL in browser and authorize
3. Run "Complete OAuth Flow" with the code
4. Run "List All Connections" to verify

### Use Case 2: Manual Sync
1. Run "Trigger Manual Sync"
2. Wait a few seconds
3. Run "Get Sync History" to check progress
4. Run "List All Issues" to see synced data

### Use Case 3: Query Issues
1. Run "List All Issues" with filters
2. Find an issue key (e.g., PROJ-123)
3. Run "Get Issue by Key" for full details

### Use Case 4: Update Connection Settings
1. Run "Get Connection by ID" to see current settings
2. Modify the settings in "Update Connection" body
3. Run "Update Connection"
4. Verify with "Get Connection by ID"

## Webhook Configuration

To receive real-time updates from Jira:

1. Go to Jira Settings → System → Webhooks
2. Click "Create a WebHook"
3. Set URL: `http://your-domain/api/v1/jira/webhooks`
   - For local testing: Use ngrok or similar tunneling tool
4. Select events:
   - Issue created
   - Issue updated
   - Issue deleted
5. Save the webhook

**Test webhook in Postman:**
- Use the "Receive Jira Webhook" request
- Modify the body to match Jira's webhook format
- Send request to test webhook processing

## Environment Variables

The collection uses these variables (automatically managed):

| Variable | Description | Set By |
|----------|-------------|---------|
| `base_url` | API base URL | Manual |
| `jwt_token` | JWT authentication token | Manual |
| `tenant_id` | Tenant identifier | Manual |
| `connection_id` | Active connection ID | Auto (from responses) |
| `oauth_code` | OAuth authorization code | Manual (from callback) |
| `oauth_state` | OAuth state parameter | Auto (from initiate) |

## Tips

1. **Auto-save variables**: The collection automatically saves `connection_id` and `oauth_state` from responses
2. **Test scripts**: Each request includes test scripts that log important information
3. **Bearer token**: The collection uses collection-level auth, so `jwt_token` applies to all requests
4. **Public endpoints**: Webhook endpoint overrides collection auth with `noauth`

## Troubleshooting

### "Unauthorized" Error
- Check that `jwt_token` is set in the environment
- Verify token hasn't expired
- Check `X-Tenant-Id` header is set correctly

### OAuth Flow Issues
- Ensure callback URL in Atlassian app matches your endpoint
- Check `oauth_code` is copied correctly (no spaces or newlines)
- Verify your app has required scopes: `read:jira-work`, `write:jira-work`, `offline_access`

### Sync Not Starting
- Check connection `isActive` is true
- Verify OAuth token is valid (use "Get OAuth Status")
- Check sync is not already in progress

## Production Environment

For production:
1. Duplicate the environment
2. Rename to "NexSentia - Production"
3. Update `base_url` to production URL
4. Set production `jwt_token` and `tenant_id`

## Support

For issues or questions, refer to:
- [API Documentation](../src/modules/jira/API_ENDPOINTS.md)
- [OAuth Setup Guide](../src/modules/jira/OAUTH_SETUP.md)
- [OAuth Compliance](../src/modules/jira/OAUTH_COMPLIANCE.md)
