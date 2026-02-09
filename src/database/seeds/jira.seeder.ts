import { DataSource } from 'typeorm';
import { JiraConnection } from '../../modules/jira/entities/jira-connection.entity';
import { JiraProject } from '../../modules/jira/entities/jira-project.entity';
import { JiraIssue } from '../../modules/jira/entities/jira-issue.entity';
import { refinedJiraIssues } from './data/jira-refined.seed';

export async function seedJiraData(dataSource: DataSource, tenantId: number): Promise<void> {
  const jiraConnectionRepo = dataSource.getRepository(JiraConnection);
  const jiraProjectRepo = dataSource.getRepository(JiraProject);
  const jiraIssueRepo = dataSource.getRepository(JiraIssue);

  console.log('\n📊 Seeding Jira integration data...');

  // Delete existing issues for this tenant to avoid duplicates
  await jiraIssueRepo.delete({ tenantId });
  console.log('  🗑️  Deleted existing Jira issues');

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
      name: 'Production',
      description: 'Production issues and incidents',
      projectTypeKey: 'software',
      leadAccountId: 'user_001',
      leadDisplayName: 'Sarah Martinez',
    },
    {
      jiraProjectId: 'proj_10002',
      jiraProjectKey: 'PLATFORM',
      name: 'Platform',
      description: 'Platform engineering and features',
      projectTypeKey: 'software',
      leadAccountId: 'user_001',
      leadDisplayName: 'Mike Chen',
    },
    {
      jiraProjectId: 'proj_10003',
      jiraProjectKey: 'OPS',
      name: 'Operations',
      description: 'DevOps and infrastructure tasks',
      projectTypeKey: 'software',
      leadAccountId: 'user_001',
      leadDisplayName: 'DevOps Team',
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
  const platformProject = projects.find((p) => p.jiraProjectKey === 'PLATFORM' || p.jiraProjectKey === 'ENG');
  const opsProject = projects.find((p) => p.jiraProjectKey === 'OPS' || p.jiraProjectKey === 'SUP');

  // ============================================
  // Jira Issues - Using Refined Dataset
  // ============================================
  // Map project keys to database IDs
  const projectKeyToId: Record<string, number> = {
    'PROD': prodProject!.id,
    'PLATFORM': platformProject!.id,
    'OPS': opsProject!.id,
  };

  // Convert refined issues to database format
  const issuesData = refinedJiraIssues.map(issue => ({
    projectId: projectKeyToId[issue.project],
    jiraIssueId: issue.key,
    jiraIssueKey: issue.key,
    summary: issue.summary,
    description: issue.description,
    issueType: issue.type.toLowerCase(),
    status: issue.status.toLowerCase().replace(' ', '_'),
    priority: issue.priority.toLowerCase(),
    assigneeAccountId: issue.assignee,
    assigneeDisplayName: issue.assignee.split('@')[0].replace('.', ' '),
    reporterAccountId: issue.reporter,
    reporterDisplayName: issue.reporter.split('@')[0].replace('.', ' '),
    jiraCreatedAt: new Date(issue.created),
    jiraUpdatedAt: new Date(issue.updated),
    resolvedAt: issue.resolved ? new Date(issue.resolved) : undefined,
    storyPoints: issue.storyPoints || undefined,
    labels: issue.labels,
    components: issue.components?.map((comp, idx) => ({ id: `comp_${idx}`, name: comp })),
  }));

  // Generate additional Jira issues to create trend acceleration
  // Strategy: Create MORE issues in recent 30 days to trigger acceleration detection
  const additionalJiraIssues = [];
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const issueSummaries = [
    'API endpoint performance degradation',
    'Memory leak in background worker',
    'Database connection timeout',
    'Cache invalidation issue',
    'Session management bug',
    'File upload failing for large files',
    'Email notification delay',
    'Search results incorrect',
    'Payment processing error',
    'User authentication timeout',
    'Dashboard loading slowly',
    'Export functionality broken',
    'Mobile app crash on startup',
    'Push notification not sent',
    'Data sync delay detected',
  ];

  const issueTypes = ['bug', 'bug', 'bug', 'story', 'task'];
  const statuses = ['open', 'open', 'in_progress', 'in_progress', 'done', 'done'];
  const priorities = ['low', 'low', 'medium', 'medium', 'high', 'critical'];

  // Generate 100 additional issues with ACCELERATION pattern
  for (let i = 0; i < 100; i++) {
    let daysAgo;
    // CREATE ACCELERATION: 60% in last 30 days (MORE recent activity)
    if (i < 60) {
      // 60 issues in last 30 days (HIGH activity)
      daysAgo = Math.floor(Math.random() * 30);
    } else if (i < 85) {
      // 25 issues in 30-60 days ago (MODERATE activity)
      daysAgo = Math.floor(Math.random() * 30) + 30;
    } else {
      // 15 issues in 60-90 days ago (LOW baseline activity)
      daysAgo = Math.floor(Math.random() * 30) + 60;
    }

    const hoursOffset = Math.floor(Math.random() * 24);
    const minutesOffset = Math.floor(Math.random() * 60);
    const createdDate = new Date(ninetyDaysAgo);
    createdDate.setDate(createdDate.getDate() + daysAgo);
    createdDate.setHours(hoursOffset);
    createdDate.setMinutes(minutesOffset);

    const summary = issueSummaries[Math.floor(Math.random() * issueSummaries.length)];
    const type = issueTypes[Math.floor(Math.random() * issueTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];

    const project = i % 3 === 0 ? prodProject : i % 3 === 1 ? platformProject : opsProject;

    additionalJiraIssues.push({
      projectId: project!.id,
      jiraIssueId: `issue_gen_${50100 + i}`,
      jiraIssueKey: `GEN-${1000 + i}`,
      summary: `${summary} [auto-gen #${i + 1}]`,
      description: `Auto-generated issue for testing: ${summary}`,
      issueType: type,
      status: status,
      priority: priority,
      assigneeAccountId: `user_00${(i % 5) + 1}`,
      assigneeDisplayName: `Developer ${(i % 5) + 1}`,
      reporterAccountId: 'user_001',
      reporterDisplayName: 'System Reporter',
      jiraCreatedAt: createdDate,
      jiraUpdatedAt: new Date(),
      resolvedAt: status === 'done' ? new Date(createdDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) : undefined,
      storyPoints: type === 'story' ? Math.floor(Math.random() * 8) + 1 : undefined,
    });
  }

  // Original demo issues for backward compatibility
  const originalDemoIssues = [
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
      projectId: platformProject!.id,
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
      projectId: platformProject!.id,
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
      projectId: platformProject!.id,
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
      projectId: platformProject!.id,
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
      projectId: platformProject!.id,
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
      projectId: platformProject!.id,
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
      projectId: platformProject!.id,
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
      projectId: opsProject!.id,
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
      projectId: opsProject!.id,
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
      projectId: opsProject!.id,
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
      projectId: opsProject!.id,
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
      projectId: opsProject!.id,
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
      projectId: opsProject!.id,
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
      projectId: opsProject!.id,
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

  // Combine refined issues, original demo issues, and additional generated issues
  const allIssuesData = [...issuesData, ...originalDemoIssues, ...additionalJiraIssues];

  // Create issues in database
  for (const issueData of allIssuesData) {
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
