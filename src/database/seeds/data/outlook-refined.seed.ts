export const refinedOutlookMessages = [
  // EXECUTIVE: Incident Post-Mortem
  {
    subject: 'Post-Mortem Report: Payment Gateway Outage (Dec 15)',
    fromEmail: 'sarah.martinez@nexsentia.com',
    fromName: 'Sarah Martinez',
    toRecipients: [{ email: 'leadership@nexsentia.com', name: 'Leadership Team' }],
    ccRecipients: [{ email: 'engineering@nexsentia.com', name: 'Engineering Team' }],
    bodyText: 'Please find attached the post-mortem report for the Dec 15 payment gateway outage.\n\nKey takeaways:\n- Duration: 2h 22m\n- Root cause: DB connection pool exhaustion during traffic spike\n- Revenue impact: $118k delayed (all recovered)\n- Customers affected: 12,500\n\nAction items:\n1. Implement auto-scaling for connection pools\n2. Add circuit breaker pattern to all critical services\n3. Update runbook with new thresholds\n4. Schedule quarterly capacity planning reviews\n\nNext review: Jan 5, 2026\n\nSarah Martinez\nSr. Platform Engineer',
    outlookCreatedAt: '2025-12-16T10:00:00Z',
    importance: 'high',
    categories: ['Red Category'],
    hasAttachment: true,
    attachmentName: 'Post-Mortem-INC0010001.pdf',
  },

  // CORPORATE: Quarterly Business Review
  {
    subject: 'Q4 2025 Business Review - Engineering Metrics',
    fromEmail: 'cto@nexsentia.com',
    fromName: 'Robert Chen',
    toRecipients: [{ email: 'leadership@nexsentia.com', name: 'Leadership Team' }],
    bodyText: 'Team,\n\nQ4 2025 engineering highlights:\n\n- Uptime: 99.92% (target: 99.9%)\n- MTTR: Reduced from 4.2h to 2.8h (-33%)\n- Critical incidents: 3 (down from 7 in Q3)\n- Feature velocity: 42 story points/sprint (up 15%)\n- Customer satisfaction: 8.2/10\n\nKey challenges:\n- Payment gateway outage (Dec 15) — addressed with circuit breaker pattern\n- Enterprise rate limiting — resolved with tiered approach\n- Teams reaction data gap — fixed with Graph API beta migration\n\nQ1 2026 focus: Dashboard enhancements, alert system, real-time collaboration.\n\nRobert Chen\nCTO',
    outlookCreatedAt: '2025-12-20T14:00:00Z',
    importance: 'high',
    categories: ['Blue Category'],
    hasAttachment: true,
    attachmentName: 'Q4-2025-Engineering-Review.pptx',
  },

  // COMPLIANCE: Security Incident Report
  {
    subject: 'Security Incident Report - Brute Force Attack (Jan 30)',
    fromEmail: 'security.team@nexsentia.com',
    fromName: 'Security Team',
    toRecipients: [{ email: 'cto@nexsentia.com', name: 'Robert Chen' }, { email: 'compliance@nexsentia.com', name: 'Compliance' }],
    bodyText: 'Formal incident report for the Jan 30 brute force attack.\n\nTimeline:\n- 18:45 UTC: SIEM alert triggered (1,500 failed logins in 2 hours)\n- 18:47 UTC: IP range blocked at WAF\n- 19:00 UTC: War room initiated\n- 19:30 UTC: Rate limiting enabled, passwords reset\n- 20:15 UTC: Attack fully mitigated\n\nOutcome: NO unauthorized access.\n\nRecommendations:\n1. Mandatory MFA for admin accounts\n2. Geographic login restrictions\n3. Enhanced WAF rules for login endpoints\n4. Quarterly penetration testing\n\nFull report attached. INC0010011.',
    outlookCreatedAt: '2026-01-31T09:00:00Z',
    importance: 'high',
    categories: ['Red Category'],
    hasAttachment: true,
    attachmentName: 'Security-Incident-Report-Jan30.pdf',
  },

  // HR: New Hire Onboarding
  {
    subject: 'New Engineering Hire - Access Provisioning Request',
    fromEmail: 'hiring.manager@nexsentia.com',
    fromName: 'Hiring Manager',
    toRecipients: [{ email: 'support@nexsentia.com', name: 'IT Support' }],
    ccRecipients: [{ email: 'hr@nexsentia.com', name: 'HR' }],
    bodyText: 'Please set up the following access for our new hire starting Monday:\n\nName: John Smith (john.smith@nexsentia.com)\nTeam: Product Engineering\nRoles needed: Dashboard, Alert Management, Team Admin\n\nPlease also provide:\n- GitHub organization access\n- Slack workspace invitation\n- VPN credentials\n- Development environment setup guide\n\nThank you',
    outlookCreatedAt: '2026-02-03T09:05:00Z',
    importance: 'normal',
    categories: [],
  },

  // VENDOR: Resend Email Service Issue
  {
    subject: 'RE: SMTP Connection Timeout - Support Ticket #87234',
    fromEmail: 'support@resend.com',
    fromName: 'Resend Support',
    toRecipients: [{ email: 'sarah.martinez@nexsentia.com', name: 'Sarah Martinez' }],
    bodyText: 'Hi Sarah,\n\nThank you for reporting this issue. Our team has identified an infrastructure issue affecting SMTP connections in the us-east-1 region.\n\nWe are currently deploying a fix. Expected resolution: within 24 hours.\n\nIn the meantime, you can use our REST API endpoint as a fallback:\nPOST https://api.resend.com/emails\n\nWe apologize for the inconvenience.\n\nResend Support Team',
    outlookCreatedAt: '2026-02-06T15:30:00Z',
    importance: 'high',
    categories: ['Red Category'],
  },

  // INFRASTRUCTURE: SSL Renewal Complete
  {
    subject: 'RE: SSL Certificate Renewal - Completed Successfully',
    fromEmail: 'devops@nexsentia.com',
    fromName: 'DevOps Team',
    toRecipients: [{ email: 'infrastructure.lead@nexsentia.com', name: 'Infrastructure Lead' }, { email: 'security.team@nexsentia.com', name: 'Security Team' }],
    bodyText: 'SSL certificates renewed successfully:\n\n- api.nexsentia.com: Valid until Jan 2027\n- dashboard.nexsentia.com: Valid until Jan 2027\n\nRoot cause of auto-renewal failure: Outdated DNS CNAME records.\n\nActions taken:\n1. DNS records updated\n2. Manual renewal via AWS Certificate Manager\n3. SSL Labs scan verified (A+ rating)\n4. Additional monitoring configured for certificate expiration\n\nINC0010009 closed.',
    outlookCreatedAt: '2026-01-17T14:25:00Z',
    importance: 'normal',
    categories: [],
  },

  // ENTERPRISE: Client Escalation
  {
    subject: 'ESCALATION: Acme Corp - Dashboard Loading Issues',
    fromEmail: 'support.lead@nexsentia.com',
    fromName: 'Tom Baker',
    toRecipients: [{ email: 'engineering@nexsentia.com', name: 'Engineering Team' }],
    ccRecipients: [{ email: 'account.manager@nexsentia.com', name: 'Account Manager' }],
    bodyText: 'VIP escalation from Acme Corp (500+ users):\n\nIssue: Dashboard loading times of 15-20 seconds during business hours.\nTicket: #5923\nSLA status: At risk (4h SLA response)\n\nAcme Corp is our largest enterprise client. Their VP of Engineering has escalated directly.\n\nCan engineering investigate immediately?\n\nTom Baker\nCustomer Success Lead',
    outlookCreatedAt: '2026-01-25T11:40:00Z',
    importance: 'high',
    categories: ['Red Category'],
  },

  // ENGINEERING: Code Review
  {
    subject: 'Code Review Complete: Alert Subscription API (PR #247)',
    fromEmail: 'alex.johnson@nexsentia.com',
    fromName: 'Alex Johnson',
    toRecipients: [{ email: 'david.park@nexsentia.com', name: 'David Park' }],
    ccRecipients: [{ email: 'engineering@nexsentia.com', name: 'Engineering Team' }],
    bodyText: 'PR #247 reviewed and approved.\n\nHighlights:\n- Clean implementation of STORY-890\n- 95% test coverage on new code\n- Proper validation for subscription preferences\n- Quiet hours logic well-tested\n\nMinor suggestions:\n- Consider adding rate limiting on subscription updates\n- Add OpenAPI docs for new endpoints\n\nGreat work! Ready to merge.\n\nAlex',
    outlookCreatedAt: '2026-01-25T12:10:00Z',
    importance: 'normal',
    categories: [],
  },

  // MANAGEMENT: Sprint Velocity Report
  {
    subject: 'Sprint 25 Velocity Report - Dashboard Filtering Delivered',
    fromEmail: 'sarah.martinez@nexsentia.com',
    fromName: 'Sarah Martinez',
    toRecipients: [{ email: 'leadership@nexsentia.com', name: 'Leadership Team' }],
    bodyText: 'Sprint 25 completed successfully.\n\nDelivered:\n- FEAT-456: Advanced Dashboard Filtering (8 pts) — shipped to production\n- TASK-678: Database Index Optimization (2 pts) — query time 8s → 0.3s\n- ENG-642: CI/CD Pipeline Improvements (3 pts) — build time 12m → 6m\n\nVelocity: 34 points (target: 32)\nBug escape rate: 0\nCustomer impact: Positive (filtering was #1 request)\n\nSprint 26 starts Monday — focused on alert customization and Slack ingestion optimization.\n\nSarah',
    outlookCreatedAt: '2026-01-31T17:00:00Z',
    importance: 'normal',
    categories: ['Blue Category'],
    hasAttachment: true,
    attachmentName: 'Sprint-25-Report.xlsx',
  },

  // INTEGRATION: Jira Sync Issue
  {
    subject: 'Data Quality Alert: Duplicate Jira Issues Detected',
    fromEmail: 'data.quality.team@nexsentia.com',
    fromName: 'Data Quality Team',
    toRecipients: [{ email: 'alex.johnson@nexsentia.com', name: 'Alex Johnson' }, { email: 'engineering@nexsentia.com', name: 'Engineering Team' }],
    bodyText: 'Data quality check flagged 47 duplicate Jira issues in the platform database.\n\nRoot cause: Webhook retry logic not checking for existing issues before insert.\n\nAffected: Reporting accuracy for backlog metrics\n\nRecommendation:\n1. Implement upsert logic using Jira issue key as unique identifier\n2. Add database unique constraint on jira_issue_key column\n3. Clean up existing duplicates\n\nINC0010012 created.',
    outlookCreatedAt: '2026-01-12T11:05:00Z',
    importance: 'high',
    categories: ['Red Category'],
  },

  // INTEGRATION: Slack Channel Sync
  {
    subject: 'Slack Integration: #engineering Channel Messages Not Syncing',
    fromEmail: 'engineering.lead@nexsentia.com',
    fromName: 'Engineering Lead',
    toRecipients: [{ email: 'alex.johnson@nexsentia.com', name: 'Alex Johnson' }],
    bodyText: 'Noticed that #engineering channel messages haven\'t appeared in the platform since Jan 20th.\n\nAll other channels are syncing fine. Last message from #engineering in the platform is from Jan 19th.\n\nCould be related to the channel being archived and recreated last week?\n\nINC0010005 created.',
    outlookCreatedAt: '2026-01-22T10:05:00Z',
    importance: 'normal',
    categories: [],
  },

  // MANAGEMENT: Capacity Planning
  {
    subject: 'Infrastructure Capacity Planning - Q1 Review',
    fromEmail: 'cto@nexsentia.com',
    fromName: 'Robert Chen',
    toRecipients: [{ email: 'engineering@nexsentia.com', name: 'Engineering Team' }, { email: 'devops@nexsentia.com', name: 'DevOps Team' }],
    bodyText: 'Following the Dec 15 incident, I want to schedule a capacity planning review.\n\nAreas to cover:\n1. Database connection pools — are current limits appropriate?\n2. API Gateway — rate limiting thresholds by tier\n3. Redis cluster — memory and connection limits\n4. Application servers — auto-scaling policies\n5. Monitoring — are alert thresholds catching issues early enough?\n\nPlease come prepared with current metrics and growth projections.\n\nMeeting: Jan 10, 10 AM\n\nRobert Chen\nCTO',
    outlookCreatedAt: '2026-01-06T09:00:00Z',
    importance: 'high',
    categories: ['Blue Category'],
  },

  // DEVOPS: Backup Policy Fix
  {
    subject: 'RE: Storage Audit - S3 Lifecycle Policy Created',
    fromEmail: 'devops@nexsentia.com',
    fromName: 'DevOps Team',
    toRecipients: [{ email: 'infrastructure.lead@nexsentia.com', name: 'Infrastructure Lead' }],
    bodyText: 'Update on backup retention issue (INC0010010):\n\n- S3 lifecycle policy created for 30-day retention\n- Currently testing in staging environment\n- Will apply to production after 48h validation\n\nEstimated storage savings: ~$450/month once old backups are cleaned up.\n\nWill update when production policy is active.',
    outlookCreatedAt: '2026-02-07T09:35:00Z',
    importance: 'normal',
    categories: [],
  },

  // TEAMS: Microsoft Graph API Update
  {
    subject: 'Teams Integration: Reaction Data Now Syncing',
    fromEmail: 'david.park@nexsentia.com',
    fromName: 'David Park',
    toRecipients: [{ email: 'data.analyst@nexsentia.com', name: 'Data Analyst' }, { email: 'engineering@nexsentia.com', name: 'Engineering Team' }],
    bodyText: 'Good news — Teams reaction data is now syncing properly.\n\nFix: Migrated from Microsoft Graph API v1.0 to beta endpoint which includes full reaction data.\n\nChanges:\n- Updated Teams message entity schema to store reaction arrays\n- Backfilled reactions for past 30 days\n- Added monitoring for Graph API version deprecation notices\n\nINC0010006 closed. Sentiment analysis should now have complete data.\n\nDavid',
    outlookCreatedAt: '2026-01-08T16:50:00Z',
    importance: 'normal',
    categories: [],
  },
];
