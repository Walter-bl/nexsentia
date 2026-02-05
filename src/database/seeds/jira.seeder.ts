import { DataSource } from 'typeorm';
import { JiraConnection } from '../../modules/jira/entities/jira-connection.entity';
import { JiraProject } from '../../modules/jira/entities/jira-project.entity';
import { JiraIssue } from '../../modules/jira/entities/jira-issue.entity';

export async function seedJiraData(dataSource: DataSource, tenantId: number): Promise<void> {
  const jiraConnectionRepo = dataSource.getRepository(JiraConnection);
  const jiraProjectRepo = dataSource.getRepository(JiraProject);
  const jiraIssueRepo = dataSource.getRepository(JiraIssue);

  console.log('\n📊 Seeding Jira integration data...');

  // ============================================
  // Jira Connection
  // ============================================
  let jiraConnection = await jiraConnectionRepo.findOne({
    where: { tenantId, name: 'Demo Jira Workspace' },
  });

  if (!jiraConnection) {
    jiraConnection = jiraConnectionRepo.create({
      tenantId,
      name: 'Demo Jira Workspace',
      jiraInstanceUrl: 'https://demo-company.atlassian.net',
      jiraCloudId: 'demo-cloud-id-12345',
      jiraType: 'cloud',
      oauthAccessToken: 'demo_token_encrypted',
      oauthRefreshToken: 'demo_refresh_encrypted',
      oauthTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      oauthScope: 'read:jira-work write:jira-work',
      oauthMetadata: {
        cloudId: 'demo-cloud-id-12345',
        accountId: 'user_001',
        displayName: 'Demo User',
        email: 'demo@democompany.com',
        workspaceName: 'Demo Company',
        workspaceUrl: 'https://demo-company.atlassian.net',
      },
      isActive: true,
      syncSettings: {
        syncInterval: 3600,
        autoSync: true,
        projectFilter: [],
        issueTypeFilter: [],
        statusFilter: [],
        syncComments: true,
        syncAttachments: false,
        syncWorkLogs: false,
      },
      totalIssuesSynced: 1000,
      lastSuccessfulSyncAt: new Date(),
    });
    await jiraConnectionRepo.save(jiraConnection);
    console.log('✓ Created Jira connection');
  } else {
    console.log('✓ Jira connection already exists');
  }

  // ============================================
  // Jira Projects
  // ============================================
  const projectsData = [
    {
      jiraProjectId: 'proj_10001',
      jiraProjectKey: 'PROD',
      name: 'Production Support',
      description: 'Production issues and incidents',
      projectTypeKey: 'software',
      leadAccountId: 'user_001',
      leadDisplayName: 'John Smith',
    },
    {
      jiraProjectId: 'proj_10002',
      jiraProjectKey: 'ENG',
      name: 'Engineering',
      description: 'Engineering team tasks',
      projectTypeKey: 'software',
      leadAccountId: 'user_001',
      leadDisplayName: 'John Smith',
    },
    {
      jiraProjectId: 'proj_10003',
      jiraProjectKey: 'SUP',
      name: 'Customer Support',
      description: 'Customer support tickets',
      projectTypeKey: 'service_desk',
      leadAccountId: 'user_001',
      leadDisplayName: 'John Smith',
    },
  ];

  const projects: JiraProject[] = [];
  for (const projectData of projectsData) {
    let project = await jiraProjectRepo.findOne({
      where: { connectionId: jiraConnection.id, jiraProjectId: projectData.jiraProjectId },
    });

    if (!project) {
      project = jiraProjectRepo.create({
        connectionId: jiraConnection.id,
        tenantId,
        ...projectData,
        isActive: true,
        totalIssues: 0,
      });
      await jiraProjectRepo.save(project);
      console.log(`✓ Created Jira project: ${projectData.name}`);
    } else {
      console.log(`✓ Jira project already exists: ${projectData.name}`);
    }
    projects.push(project);
  }

  // Get project references
  const prodProject = projects.find((p) => p.jiraProjectKey === 'PROD');
  const engProject = projects.find((p) => p.jiraProjectKey === 'ENG');
  const supProject = projects.find((p) => p.jiraProjectKey === 'SUP');

  // ============================================
  // Jira Issues
  // ============================================
  const issuesData = [
    // Production incidents
    {
      projectId: prodProject!.id,
      jiraIssueId: 'issue_50001',
      jiraIssueKey: 'PROD-1234',
      summary: 'Payment gateway timeout causing checkout failures',
      description: 'Users reporting timeout errors. Impact: ~500 customers affected.',
      issueType: 'incident',
      status: 'resolved',
      priority: 'critical',
      assigneeAccountId: 'user_005',
      assigneeDisplayName: 'Alice Johnson',
      reporterAccountId: 'user_008',
      reporterDisplayName: 'Bob Wilson',
      jiraCreatedAt: new Date('2026-01-15 08:30:00'),
      jiraUpdatedAt: new Date('2026-01-15 14:20:00'),
      resolvedAt: new Date('2026-01-15 14:20:00'),
    },
    {
      projectId: prodProject!.id,
      jiraIssueId: 'issue_50002',
      jiraIssueKey: 'PROD-1256',
      summary: 'Database connection pool exhausted',
      description: 'Application servers unable to connect to database.',
      issueType: 'incident',
      status: 'resolved',
      priority: 'critical',
      assigneeAccountId: 'user_003',
      assigneeDisplayName: 'Charlie Brown',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      jiraCreatedAt: new Date('2026-01-28 10:15:00'),
      jiraUpdatedAt: new Date('2026-01-28 11:45:00'),
      resolvedAt: new Date('2026-01-28 11:45:00'),
    },
    {
      projectId: prodProject!.id,
      jiraIssueId: 'issue_50003',
      jiraIssueKey: 'PROD-1289',
      summary: 'API rate limit exceeded causing service degradation',
      description: 'Third-party API rate limits causing delayed responses.',
      issueType: 'incident',
      status: 'in_progress',
      priority: 'high',
      assigneeAccountId: 'user_006',
      assigneeDisplayName: 'Diana Prince',
      reporterAccountId: 'user_002',
      reporterDisplayName: 'Eve Davis',
      jiraCreatedAt: new Date('2026-02-01 14:22:00'),
      jiraUpdatedAt: new Date(),
    },
    // Engineering stories
    {
      projectId: engProject!.id,
      jiraIssueId: 'issue_60001',
      jiraIssueKey: 'ENG-567',
      summary: 'Implement real-time notifications system',
      description: 'Build WebSocket-based notification system.',
      issueType: 'story',
      status: 'in_progress',
      priority: 'medium',
      assigneeAccountId: 'user_004',
      assigneeDisplayName: 'Frank Miller',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      storyPoints: 8,
      jiraCreatedAt: new Date('2026-01-20 09:00:00'),
      jiraUpdatedAt: new Date(),
    },
    {
      projectId: engProject!.id,
      jiraIssueId: 'issue_60002',
      jiraIssueKey: 'ENG-589',
      summary: 'Upgrade authentication system to OAuth 2.0',
      description: 'Migrate from session-based auth to OAuth 2.0.',
      issueType: 'story',
      status: 'done',
      priority: 'high',
      assigneeAccountId: 'user_007',
      assigneeDisplayName: 'Grace Hopper',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      storyPoints: 13,
      jiraCreatedAt: new Date('2026-01-10 10:30:00'),
      jiraUpdatedAt: new Date('2026-01-25 15:45:00'),
      resolvedAt: new Date('2026-01-25 15:45:00'),
    },
    // More Production incidents
    {
      projectId: prodProject!.id,
      jiraIssueId: 'issue_50004',
      jiraIssueKey: 'PROD-1301',
      summary: 'Memory leak in application server causing crashes',
      description: 'Application servers consuming excessive memory and crashing every 4-6 hours.',
      issueType: 'incident',
      status: 'in_progress',
      priority: 'critical',
      assigneeAccountId: 'user_003',
      assigneeDisplayName: 'Charlie Brown',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      jiraCreatedAt: new Date('2026-02-03 06:15:00'),
      jiraUpdatedAt: new Date(),
    },
    {
      projectId: prodProject!.id,
      jiraIssueId: 'issue_50005',
      jiraIssueKey: 'PROD-1315',
      summary: 'SSL certificate expiration warning',
      description: 'Production SSL certificates expiring in 7 days. Need renewal.',
      issueType: 'task',
      status: 'open',
      priority: 'high',
      assigneeAccountId: 'user_006',
      assigneeDisplayName: 'Diana Prince',
      reporterAccountId: 'user_008',
      reporterDisplayName: 'Bob Wilson',
      jiraCreatedAt: new Date('2026-02-01 09:00:00'),
      jiraUpdatedAt: new Date('2026-02-01 09:00:00'),
    },
    {
      projectId: prodProject!.id,
      jiraIssueId: 'issue_50006',
      jiraIssueKey: 'PROD-1322',
      summary: 'Slow query performance on reports page',
      description: 'Dashboard reports taking 30+ seconds to load. Database optimization needed.',
      issueType: 'bug',
      status: 'resolved',
      priority: 'medium',
      assigneeAccountId: 'user_003',
      assigneeDisplayName: 'Charlie Brown',
      reporterAccountId: 'user_002',
      reporterDisplayName: 'Eve Davis',
      jiraCreatedAt: new Date('2026-01-28 14:30:00'),
      jiraUpdatedAt: new Date('2026-01-29 11:20:00'),
      resolvedAt: new Date('2026-01-29 11:20:00'),
    },
    // More Engineering stories
    {
      projectId: engProject!.id,
      jiraIssueId: 'issue_60003',
      jiraIssueKey: 'ENG-601',
      summary: 'Add multi-factor authentication support',
      description: 'Implement MFA using TOTP for enhanced security.',
      issueType: 'story',
      status: 'in_progress',
      priority: 'high',
      assigneeAccountId: 'user_007',
      assigneeDisplayName: 'Grace Hopper',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      storyPoints: 5,
      jiraCreatedAt: new Date('2026-01-25 10:00:00'),
      jiraUpdatedAt: new Date(),
    },
    {
      projectId: engProject!.id,
      jiraIssueId: 'issue_60004',
      jiraIssueKey: 'ENG-615',
      summary: 'Implement caching layer for API responses',
      description: 'Add Redis caching to reduce database load and improve response times.',
      issueType: 'story',
      status: 'open',
      priority: 'medium',
      assigneeAccountId: 'user_004',
      assigneeDisplayName: 'Frank Miller',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      storyPoints: 8,
      jiraCreatedAt: new Date('2026-02-01 09:30:00'),
      jiraUpdatedAt: new Date('2026-02-01 09:30:00'),
    },
    {
      projectId: engProject!.id,
      jiraIssueId: 'issue_60005',
      jiraIssueKey: 'ENG-623',
      summary: 'Upgrade frontend framework to latest version',
      description: 'Update React from v17 to v18 for better performance and new features.',
      issueType: 'task',
      status: 'done',
      priority: 'low',
      assigneeAccountId: 'user_004',
      assigneeDisplayName: 'Frank Miller',
      reporterAccountId: 'user_007',
      reporterDisplayName: 'Grace Hopper',
      storyPoints: 3,
      jiraCreatedAt: new Date('2026-01-05 11:00:00'),
      jiraUpdatedAt: new Date('2026-01-15 16:30:00'),
      resolvedAt: new Date('2026-01-15 16:30:00'),
    },
    {
      projectId: engProject!.id,
      jiraIssueId: 'issue_60006',
      jiraIssueKey: 'ENG-635',
      summary: 'Add automated backup system',
      description: 'Implement daily automated backups for production database.',
      issueType: 'story',
      status: 'in_progress',
      priority: 'high',
      assigneeAccountId: 'user_003',
      assigneeDisplayName: 'Charlie Brown',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      storyPoints: 5,
      jiraCreatedAt: new Date('2026-01-22 13:15:00'),
      jiraUpdatedAt: new Date(),
    },
    {
      projectId: engProject!.id,
      jiraIssueId: 'issue_60007',
      jiraIssueKey: 'ENG-642',
      summary: 'Implement CI/CD pipeline improvements',
      description: 'Add automated testing and deployment stages to pipeline.',
      issueType: 'task',
      status: 'done',
      priority: 'medium',
      assigneeAccountId: 'user_006',
      assigneeDisplayName: 'Diana Prince',
      reporterAccountId: 'user_001',
      reporterDisplayName: 'John Smith',
      jiraCreatedAt: new Date('2026-01-08 09:45:00'),
      jiraUpdatedAt: new Date('2026-01-18 14:20:00'),
      resolvedAt: new Date('2026-01-18 14:20:00'),
    },
    // Support tickets
    {
      projectId: supProject!.id,
      jiraIssueId: 'issue_70001',
      jiraIssueKey: 'SUP-2234',
      summary: 'Customer unable to access dashboard',
      description: 'Premium customer reporting 403 errors.',
      issueType: 'bug',
      status: 'resolved',
      priority: 'high',
      assigneeAccountId: 'user_009',
      assigneeDisplayName: 'Helen Keller',
      reporterAccountId: 'user_010',
      reporterDisplayName: 'Ian Malcolm',
      jiraCreatedAt: new Date('2026-01-30 11:20:00'),
      jiraUpdatedAt: new Date('2026-01-30 14:10:00'),
      resolvedAt: new Date('2026-01-30 14:10:00'),
    },
    {
      projectId: supProject!.id,
      jiraIssueId: 'issue_70002',
      jiraIssueKey: 'SUP-2267',
      summary: 'Export functionality not working for large datasets',
      description: 'CSV export times out for datasets > 10,000 rows.',
      issueType: 'bug',
      status: 'in_progress',
      priority: 'medium',
      assigneeAccountId: 'user_004',
      assigneeDisplayName: 'Frank Miller',
      reporterAccountId: 'user_010',
      reporterDisplayName: 'Ian Malcolm',
      jiraCreatedAt: new Date('2026-02-02 08:45:00'),
      jiraUpdatedAt: new Date(),
    },
    {
      projectId: supProject!.id,
      jiraIssueId: 'issue_70003',
      jiraIssueKey: 'SUP-2278',
      summary: 'Mobile app login issues on iOS devices',
      description: 'Users on iOS 17 unable to login to mobile app.',
      issueType: 'bug',
      status: 'open',
      priority: 'high',
      assigneeAccountId: 'user_009',
      assigneeDisplayName: 'Helen Keller',
      reporterAccountId: 'user_010',
      reporterDisplayName: 'Ian Malcolm',
      jiraCreatedAt: new Date('2026-02-03 10:15:00'),
      jiraUpdatedAt: new Date('2026-02-03 10:15:00'),
    },
    {
      projectId: supProject!.id,
      jiraIssueId: 'issue_70004',
      jiraIssueKey: 'SUP-2285',
      summary: 'Email notifications not being received',
      description: 'Multiple customers reporting missing notification emails.',
      issueType: 'bug',
      status: 'in_progress',
      priority: 'medium',
      assigneeAccountId: 'user_004',
      assigneeDisplayName: 'Frank Miller',
      reporterAccountId: 'user_010',
      reporterDisplayName: 'Ian Malcolm',
      jiraCreatedAt: new Date('2026-02-02 15:30:00'),
      jiraUpdatedAt: new Date(),
    },
    {
      projectId: supProject!.id,
      jiraIssueId: 'issue_70005',
      jiraIssueKey: 'SUP-2291',
      summary: 'Search functionality returning incorrect results',
      description: 'Product search not matching keywords properly.',
      issueType: 'bug',
      status: 'resolved',
      priority: 'low',
      assigneeAccountId: 'user_009',
      assigneeDisplayName: 'Helen Keller',
      reporterAccountId: 'user_010',
      reporterDisplayName: 'Ian Malcolm',
      jiraCreatedAt: new Date('2026-01-29 09:00:00'),
      jiraUpdatedAt: new Date('2026-01-31 12:45:00'),
      resolvedAt: new Date('2026-01-31 12:45:00'),
    },
    {
      projectId: supProject!.id,
      jiraIssueId: 'issue_70006',
      jiraIssueKey: 'SUP-2298',
      summary: 'User profile image upload failing',
      description: 'Profile image upload showing 500 error for images > 5MB.',
      issueType: 'bug',
      status: 'resolved',
      priority: 'low',
      assigneeAccountId: 'user_004',
      assigneeDisplayName: 'Frank Miller',
      reporterAccountId: 'user_010',
      reporterDisplayName: 'Ian Malcolm',
      jiraCreatedAt: new Date('2026-01-27 14:20:00'),
      jiraUpdatedAt: new Date('2026-01-28 10:30:00'),
      resolvedAt: new Date('2026-01-28 10:30:00'),
    },
    {
      projectId: supProject!.id,
      jiraIssueId: 'issue_70007',
      jiraIssueKey: 'SUP-2305',
      summary: 'Password reset link not working',
      description: 'Password reset emails contain expired links.',
      issueType: 'bug',
      status: 'open',
      priority: 'high',
      assigneeAccountId: 'user_009',
      assigneeDisplayName: 'Helen Keller',
      reporterAccountId: 'user_010',
      reporterDisplayName: 'Ian Malcolm',
      jiraCreatedAt: new Date('2026-02-03 08:00:00'),
      jiraUpdatedAt: new Date('2026-02-03 08:00:00'),
    },
  ];

  // Generate additional issues for more realistic dataset
  const additionalIssues: any[] = [];
  const priorities = ['critical', 'high', 'medium', 'low'];
  const statuses = ['open', 'in_progress', 'resolved', 'closed'];
  const issueTypes = ['bug', 'task', 'story', 'incident', 'epic'];
  const users = [
    { id: 'user_001', name: 'John Smith' },
    { id: 'user_002', name: 'Jane Doe' },
    { id: 'user_003', name: 'Alice Johnson' },
    { id: 'user_004', name: 'Bob Wilson' },
    { id: 'user_005', name: 'Charlie Brown' },
    { id: 'user_006', name: 'Diana Prince' },
    { id: 'user_007', name: 'Frank Miller' },
    { id: 'user_008', name: 'Helen Keller' },
  ];

  const issueTemplates = [
    { summary: 'API response time degradation', description: 'API endpoints showing increased latency' },
    { summary: 'Memory leak in background worker', description: 'Worker process consuming excessive memory' },
    { summary: 'Login authentication failing intermittently', description: 'Users reporting random login failures' },
    { summary: 'Email notifications not being delivered', description: 'Notification service queue backed up' },
    { summary: 'Data export feature timeout', description: 'Large exports timing out after 30s' },
    { summary: 'Search functionality returning incorrect results', description: 'Search index appears to be stale' },
    { summary: 'Mobile app crash on Android 13', description: 'App crashing on specific Android version' },
    { summary: 'Dashboard loading slowly', description: 'Dashboard taking 10+ seconds to load' },
    { summary: 'File upload failing for large files', description: 'Files over 50MB fail to upload' },
    { summary: 'Integration with third-party service broken', description: 'API changes from vendor breaking integration' },
    { summary: 'Report generation producing empty PDFs', description: 'PDF export functionality broken' },
    { summary: 'Cache invalidation not working properly', description: 'Stale data being served to users' },
    { summary: 'Database query optimization needed', description: 'Slow queries impacting performance' },
    { summary: 'Rate limiting not functioning correctly', description: 'Rate limits being bypassed' },
    { summary: 'Webhook delivery failures', description: 'Webhooks timing out or failing' },
    { summary: 'UI element alignment issues on mobile', description: 'Layout broken on small screens' },
    { summary: 'Data validation allowing invalid inputs', description: 'Form validation needs improvement' },
    { summary: 'Session timeout too aggressive', description: 'Users being logged out too quickly' },
    { summary: 'Backup process failing silently', description: 'Backup job completing without actual backup' },
    { summary: 'Analytics tracking not capturing events', description: 'Missing analytics data for user actions' },
  ];

  // Generate 980 more issues (total will be 1000)
  for (let i = 0; i < 980; i++) {
    const projectOptions = [prodProject, engProject, supProject];
    const project = projectOptions[i % 3];
    const projectPrefix = project!.jiraProjectKey;
    const template = issueTemplates[i % issueTemplates.length];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
    const assignee = users[Math.floor(Math.random() * users.length)];
    const reporter = users[Math.floor(Math.random() * users.length)];

    // Generate dates within last 90 days
    const daysAgo = Math.floor(Math.random() * 90);
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - daysAgo);

    const updatedDate = new Date(createdDate);
    updatedDate.setHours(updatedDate.getHours() + Math.floor(Math.random() * 48));

    const issue: any = {
      projectId: project!.id,
      jiraIssueId: `issue_${80000 + i}`,
      jiraIssueKey: `${projectPrefix}-${3000 + i}`,
      summary: `${template.summary} #${i + 1}`,
      description: template.description,
      issueType,
      status,
      priority,
      assigneeAccountId: assignee.id,
      assigneeDisplayName: assignee.name,
      reporterAccountId: reporter.id,
      reporterDisplayName: reporter.name,
      jiraCreatedAt: createdDate,
      jiraUpdatedAt: updatedDate,
    };

    // Add resolved date if status is resolved or closed
    if (status === 'resolved' || status === 'closed') {
      issue.resolvedAt = updatedDate;
    }

    additionalIssues.push(issue);
  }

  // Combine original and generated issues
  const allIssues = [...issuesData, ...additionalIssues];

  for (const issueData of allIssues) {
    // Make jiraIssueId unique per tenant
    const uniqueJiraIssueId = `${issueData.jiraIssueId}_t${tenantId}`;

    const existingIssue = await jiraIssueRepo.findOne({
      where: { jiraIssueId: uniqueJiraIssueId, tenantId },
    });

    if (!existingIssue) {
      const issue = jiraIssueRepo.create({
        ...issueData,
        jiraIssueId: uniqueJiraIssueId,
        tenantId,
      });
      await jiraIssueRepo.save(issue);
      console.log(`✓ Created Jira issue: ${issueData.jiraIssueKey}`);
    } else {
      console.log(`✓ Jira issue already exists: ${issueData.jiraIssueKey}`);
    }
  }

  console.log('✅ Jira data seeded successfully!\n');
}
