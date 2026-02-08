import { DataSource } from 'typeorm';
import { TeamsConnection } from '../../modules/teams/entities/teams-connection.entity';
import { TeamsChannel } from '../../modules/teams/entities/teams-channel.entity';
import { TeamsMessage } from '../../modules/teams/entities/teams-message.entity';

export async function seedTeamsData(dataSource: DataSource, tenantId: number): Promise<void> {
  const teamsConnectionRepo = dataSource.getRepository(TeamsConnection);
  const teamsChannelRepo = dataSource.getRepository(TeamsChannel);
  const teamsMessageRepo = dataSource.getRepository(TeamsMessage);

  console.log('\n📋 Seeding Teams integration data...');

  // Delete existing messages for this tenant to avoid duplicates
  await teamsMessageRepo.delete({ tenantId });
  console.log('  🗑️  Deleted existing Teams messages');

  // ============================================
  // Teams Connection
  // ============================================
  let teamsConnection = await teamsConnectionRepo.findOne({
    where: { tenantId, tenantIdMs: 'ms-tenant-demo-12345' },
  });

  if (!teamsConnection) {
    teamsConnection = teamsConnectionRepo.create({
      tenantId,
      name: 'Demo Teams Workspace',
      tenantIdMs: 'ms-tenant-demo-12345',
      accessToken: 'demo_teams_token_encrypted',
      refreshToken: 'demo_teams_refresh_encrypted',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      teamId: 'team_demo_001',
      teamName: 'Demo Company Team',
      isActive: true,
      lastSuccessfulSyncAt: new Date(),
    });
    await teamsConnectionRepo.save(teamsConnection);
    console.log('✓ Created Teams connection');
  } else {
    console.log('✓ Teams connection already exists');
  }

  // ============================================
  // Teams Channels
  // ============================================
  const channelsData = [
    {
      channelId: 'channel_general_001',
      teamId: 'team_demo_001',
      displayName: 'General',
      description: 'General team discussions',
      email: 'general@democompany.teams.ms',
      webUrl: 'https://teams.microsoft.com/l/channel/channel_general_001',
      membershipType: 'standard',
    },
    {
      channelId: 'channel_eng_002',
      teamId: 'team_demo_001',
      displayName: 'Engineering',
      description: 'Engineering team channel',
      email: 'engineering@democompany.teams.ms',
      webUrl: 'https://teams.microsoft.com/l/channel/channel_eng_002',
      membershipType: 'standard',
    },
    {
      channelId: 'channel_support_003',
      teamId: 'team_demo_001',
      displayName: 'Support',
      description: 'Customer support coordination',
      email: 'support@democompany.teams.ms',
      webUrl: 'https://teams.microsoft.com/l/channel/channel_support_003',
      membershipType: 'standard',
    },
  ];

  const channels: TeamsChannel[] = [];
  for (const channelData of channelsData) {
    let channel = await teamsChannelRepo.findOne({
      where: { connectionId: teamsConnection.id, channelId: channelData.channelId },
    });

    if (!channel) {
      channel = teamsChannelRepo.create({
        connectionId: teamsConnection.id,
        tenantId,
        ...channelData,
        isArchived: false,
      });
      await teamsChannelRepo.save(channel);
      console.log(`✓ Created Teams channel: ${channelData.displayName}`);
    } else {
      console.log(`✓ Teams channel already exists: ${channelData.displayName}`);
    }
    channels.push(channel);
  }

  // Get channel references
  const generalChannel = channels.find((c) => c.channelId === 'channel_general_001');
  const engineeringChannel = channels.find((c) => c.channelId === 'channel_eng_002');
  const supportChannel = channels.find((c) => c.channelId === 'channel_support_003');

  // ============================================
  // Teams Messages
  // ============================================

  // Generate additional messages for realistic dataset
  const users = ['user_teams_001', 'user_teams_002', 'user_teams_003', 'user_teams_004', 'user_teams_005', 'user_teams_006', 'user_teams_007', 'user_teams_008'];
  const importanceLevels = ['normal', 'normal', 'normal', 'normal', 'urgent'] as const; // More normal than urgent

  const messageTemplates = {
    engineering: [
      'PR merged: Enhanced logging for microservices',
      'Release candidate built successfully',
      'Load testing results: System handles 10k concurrent users',
      'New feature branch created for OAuth 2.0 migration',
      'Documentation updated for REST API v3',
      'Dependency vulnerability patched',
      'Database schema migration completed',
      'A/B test results show 15% improvement',
      'CI/CD pipeline optimization reduced build time',
      'Technical design doc ready for review',
      'Monitoring alerts configured for new service',
      'Kubernetes deployment manifests updated',
      'Code coverage increased to 85%',
      'API rate limiting implemented',
      'Microservice health check endpoints added',
      'Feature toggle system deployed',
      'Performance profiling completed',
      'GraphQL subscriptions now available',
      'Container image size reduced by 40%',
      'End-to-end tests passing in all environments',
    ],
    support: [
      'Customer ticket #XXX: Issue with password reset',
      'Escalation: Enterprise client reporting downtime',
      'Resolved: Mobile app crash on Android 12',
      'Known issue: Export button disabled for large datasets',
      'Workaround provided for IE11 compatibility',
      'Customer feedback: Dashboard UX improvements needed',
      'SLA breach alert: Priority 1 ticket aging',
      'Billing inquiry resolved',
      'Feature request: Dark mode for admin panel',
      'Customer success call scheduled',
      'Training session for new product features',
      'Bug fix deployed for email notification timing',
      'Customer reported data sync delay',
      'Premium support ticket: Integration assistance',
      'User reported login timeout issue',
      'Feedback collected from customer survey',
      'Account upgrade completed successfully',
      'Customer onboarding scheduled',
      'Issue reproduced in test environment',
      'Root cause analysis completed',
    ],
    general: [
      'Team standup starting in 5 minutes',
      'Monthly newsletter published',
      'New office hours effective next week',
      'Congratulations on the product launch!',
      'Team building event: Friday lunch',
      'Security training mandatory for all staff',
      'IT maintenance window this Saturday',
      'Employee recognition: Outstanding work this quarter',
      'Updated vacation policy available',
      'Quarterly goals presentation scheduled',
      'New starter guide updated',
      'Company town hall meeting notes shared',
      'Benefits enrollment period closing soon',
      'Office supplies order being placed',
      'Remote work policy clarification',
      'Team photo session next week',
      'Holiday schedule posted',
      'Parking lot construction notice',
      'New conference room booking system',
      'Department budget review meeting',
    ],
  };

  const additionalMessages = [];
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Generate 990 additional messages (1000 total - 10 existing)
  for (let i = 0; i < 990; i++) {
    const channelIndex = i % 3;
    let channel: TeamsChannel | undefined;
    let channelType: 'engineering' | 'support' | 'general';
    let teamsChannelId: string;

    if (channelIndex === 0) {
      channel = engineeringChannel;
      channelType = 'engineering';
      teamsChannelId = 'channel_eng_002';
    } else if (channelIndex === 1) {
      channel = supportChannel;
      channelType = 'support';
      teamsChannelId = 'channel_support_003';
    } else {
      channel = generalChannel;
      channelType = 'general';
      teamsChannelId = 'channel_general_001';
    }

    const templates = messageTemplates[channelType];
    let content = templates[Math.floor(Math.random() * templates.length)];

    // Add ticket number for support messages
    if (channelType === 'support' && content.includes('#XXX')) {
      const ticketNum = 3000 + i;
      content = content.replace('#XXX', `#${ticketNum}`);
    }

    const user = users[Math.floor(Math.random() * users.length)];
    const importance = importanceLevels[Math.floor(Math.random() * importanceLevels.length)];

    // Generate timestamp within last 90 days - with more activity in recent periods
    let daysAgo;
    const timeDistribution = Math.random();
    if (timeDistribution < 0.50) {
      // 50% of messages in last 30 days (recent, high engagement)
      daysAgo = Math.floor(Math.random() * 30);
    } else if (timeDistribution < 0.75) {
      // 25% of messages in 30-60 days ago (moderate engagement)
      daysAgo = Math.floor(Math.random() * 30) + 30;
    } else {
      // 25% of messages in 60-90 days ago (lower engagement)
      daysAgo = Math.floor(Math.random() * 30) + 60;
    }

    const hoursOffset = Math.floor(Math.random() * 24);
    const minutesOffset = Math.floor(Math.random() * 60);
    const messageDate = new Date(ninetyDaysAgo);
    messageDate.setDate(messageDate.getDate() + daysAgo);
    messageDate.setHours(hoursOffset);
    messageDate.setMinutes(minutesOffset);

    additionalMessages.push({
      channelId: channel!.id,
      messageId: `teams_msg_gen_${i + 1}`,
      teamId: 'team_demo_001',
      teamsChannelId,
      teamsUserId: user,
      content: `${content} [auto-generated #${i + 1}]`,
      contentType: 'html' as const,
      messageType: 'message' as const,
      importance,
      createdDateTime: messageDate,
      lastModifiedDateTime: messageDate,
    });
  }

  const messagesData = [
    {
      channelId: engineeringChannel!.id,
      messageId: 'teams_msg_001',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_eng_002',
      teamsUserId: 'user_teams_001',
      content: 'Code review needed for the new API endpoints. Link: https://dev.azure.com/demo/pr/123',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-02-01 09:30:00'),
      lastModifiedDateTime: new Date('2026-02-01 09:30:00'),
    },
    {
      channelId: engineeringChannel!.id,
      messageId: 'teams_msg_002',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_eng_002',
      teamsUserId: 'user_teams_002',
      content: 'Sprint retrospective notes uploaded to SharePoint. Great work team!',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-01-30 15:45:00'),
      lastModifiedDateTime: new Date('2026-01-30 15:45:00'),
    },
    {
      channelId: supportChannel!.id,
      messageId: 'teams_msg_003',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_support_003',
      teamsUserId: 'user_teams_003',
      content: 'Urgent: VIP customer (Acme Corp) reporting dashboard loading issues',
      contentType: 'html',
      messageType: 'message',
      importance: 'urgent',
      createdDateTime: new Date('2026-02-02 11:20:00'),
      lastModifiedDateTime: new Date('2026-02-02 11:20:00'),
    },
    {
      channelId: generalChannel!.id,
      messageId: 'teams_msg_004',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_general_001',
      teamsUserId: 'user_teams_001',
      content: 'Welcome to our new team members! Please introduce yourselves and let us know what you\'ll be working on.',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-02-01 10:00:00'),
      lastModifiedDateTime: new Date('2026-02-01 10:00:00'),
    },
    {
      channelId: engineeringChannel!.id,
      messageId: 'teams_msg_005',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_eng_002',
      teamsUserId: 'user_teams_002',
      content: 'Deployment pipeline update: All PRs now require at least 2 approvals before merge.',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-02-02 08:15:00'),
      lastModifiedDateTime: new Date('2026-02-02 08:15:00'),
    },
    {
      channelId: supportChannel!.id,
      messageId: 'teams_msg_006',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_support_003',
      teamsUserId: 'user_teams_004',
      content: 'Customer ticket #2267 resolved. Export functionality now handles large datasets correctly.',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-02-03 09:30:00'),
      lastModifiedDateTime: new Date('2026-02-03 09:30:00'),
    },
    {
      channelId: engineeringChannel!.id,
      messageId: 'teams_msg_007',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_eng_002',
      teamsUserId: 'user_teams_001',
      content: 'Tech debt sprint planning next Monday. Please add items to the backlog board by Friday.',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-01-28 14:00:00'),
      lastModifiedDateTime: new Date('2026-01-28 14:00:00'),
    },
    {
      channelId: generalChannel!.id,
      messageId: 'teams_msg_008',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_general_001',
      teamsUserId: 'user_teams_003',
      content: 'Company all-hands meeting this Friday at 3 PM. Calendar invites have been sent.',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-02-03 11:00:00'),
      lastModifiedDateTime: new Date('2026-02-03 11:00:00'),
    },
    {
      channelId: supportChannel!.id,
      messageId: 'teams_msg_009',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_support_003',
      teamsUserId: 'user_teams_003',
      content: 'iOS login issue identified - will be fixed in next app release v2.1.5',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-02-03 14:20:00'),
      lastModifiedDateTime: new Date('2026-02-03 14:20:00'),
    },
    {
      channelId: engineeringChannel!.id,
      messageId: 'teams_msg_010',
      teamId: 'team_demo_001',
      teamsChannelId: 'channel_eng_002',
      teamsUserId: 'user_teams_002',
      content: 'Performance metrics for Q1 look great! API latency down 35%, error rate down 60%.',
      contentType: 'html',
      messageType: 'message',
      importance: 'normal',
      createdDateTime: new Date('2026-01-31 16:30:00'),
      lastModifiedDateTime: new Date('2026-01-31 16:30:00'),
    },
  ];

  // Combine original messages with generated ones
  const allMessages = [...messagesData, ...additionalMessages];

  for (const messageData of allMessages) {
    let message = await teamsMessageRepo.findOne({
      where: { messageId: messageData.messageId },
    });

    if (!message) {
      message = teamsMessageRepo.create({
        ...messageData,
        connectionId: teamsConnection.id,
        tenantId,
      });
      await teamsMessageRepo.save(message);
      console.log(`✓ Created Teams message: ${messageData.messageId}`);
    } else {
      console.log(`✓ Teams message already exists: ${messageData.messageId}`);
    }
  }

  console.log('✅ Teams data seeded successfully!\n');
}
