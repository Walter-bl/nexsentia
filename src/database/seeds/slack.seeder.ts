import { DataSource } from 'typeorm';
import { SlackConnection } from '../../modules/slack/entities/slack-connection.entity';
import { SlackChannel } from '../../modules/slack/entities/slack-channel.entity';
import { SlackMessage } from '../../modules/slack/entities/slack-message.entity';

export async function seedSlackData(dataSource: DataSource, tenantId: number): Promise<void> {
  const slackConnectionRepo = dataSource.getRepository(SlackConnection);
  const slackChannelRepo = dataSource.getRepository(SlackChannel);
  const slackMessageRepo = dataSource.getRepository(SlackMessage);

  console.log('\n💬 Seeding Slack integration data...');

  // Delete existing messages for this tenant to avoid duplicates
  await slackMessageRepo.delete({ tenantId });
  console.log('  🗑️  Deleted existing Slack messages');

  // ============================================
  // Slack Connection
  // ============================================
  let slackConnection = await slackConnectionRepo.findOne({
    where: { tenantId, teamId: 'T01234DEMO' },
  });

  if (!slackConnection) {
    slackConnection = slackConnectionRepo.create({
      tenantId,
      name: 'Demo Slack Workspace',
      teamId: 'T01234DEMO',
      teamName: 'Demo Company',
      teamDomain: 'democompany',
      accessToken: 'xoxb-demo-token-encrypted',
      tokenType: 'bot',
      scope: 'channels:read,channels:history,chat:write',
      botUserId: 'U01BOT123',
      installingUserId: 'U01USER123',
      isActive: true,
      totalMessagesSynced: 1000,
      lastSuccessfulSyncAt: new Date(),
    });
    await slackConnectionRepo.save(slackConnection);
    console.log('✓ Created Slack connection');
  } else {
    console.log('✓ Slack connection already exists');
  }

  // ============================================
  // Slack Channels
  // ============================================
  const channelsData = [
    {
      slackChannelId: 'C01GENERAL',
      name: 'general',
      isPrivate: false,
      topic: 'Company-wide announcements',
      purpose: 'General company communication',
      memberCount: 156,
      creatorId: 'U01USER123',
      isArchived: false,
    },
    {
      slackChannelId: 'C02ENGINEER',
      name: 'engineering',
      isPrivate: false,
      topic: 'Engineering team discussions',
      purpose: 'Technical discussions',
      memberCount: 42,
      creatorId: 'U01USER123',
      isArchived: false,
    },
    {
      slackChannelId: 'C03INCIDENT',
      name: 'incidents',
      isPrivate: false,
      topic: 'Production incident coordination',
      purpose: 'Real-time incident management',
      memberCount: 28,
      creatorId: 'U01USER123',
      isArchived: false,
    },
  ];

  const channels: SlackChannel[] = [];
  for (const channelData of channelsData) {
    let channel = await slackChannelRepo.findOne({
      where: { connectionId: slackConnection.id, slackChannelId: channelData.slackChannelId },
    });

    if (!channel) {
      channel = slackChannelRepo.create({
        connectionId: slackConnection.id,
        tenantId,
        ...channelData,
        isActive: true,
      });
      await slackChannelRepo.save(channel);
      console.log(`✓ Created Slack channel: #${channelData.name}`);
    } else {
      console.log(`✓ Slack channel already exists: #${channelData.name}`);
    }
    channels.push(channel);
  }

  // Get channel references
  const incidentChannel = channels.find((c) => c.slackChannelId === 'C03INCIDENT');
  const engineeringChannel = channels.find((c) => c.slackChannelId === 'C02ENGINEER');
  const generalChannel = channels.find((c) => c.slackChannelId === 'C01GENERAL');

  // ============================================
  // Slack Messages
  // ============================================

  // Generate additional messages for realistic dataset
  const users = ['U01USER001', 'U01USER002', 'U01USER003', 'U01USER004', 'U01USER005', 'U01USER006', 'U01USER007', 'U01USER008', 'U01USER009', 'U01USER010'];

  const messageTemplates = {
    incident: [
      '🚨 INCIDENT: Database connection timeout detected',
      '⚠️ High memory usage on production servers',
      'CDN experiencing intermittent connectivity issues',
      'API rate limits being hit on external service',
      '🔥 Critical: Authentication service down',
      'Load balancer health checks failing',
      'Redis cluster showing increased latency',
      'Elasticsearch indexing backlog building up',
      'S3 bucket permissions issue blocking uploads',
      '🚨 DDoS attack detected, mitigation in progress',
      'SSL certificate validation failing for subdomain',
      'Message queue processing delays detected',
      'Microservice dependency timeout increasing',
      'Database replication lag exceeding threshold',
      '✅ RESOLVED: Issue mitigated, monitoring closely',
      'Incident post-mortem scheduled for tomorrow',
      'Root cause identified: configuration drift',
      'Rollback completed successfully',
      'All systems nominal, closing incident',
      'Updated runbook based on this incident',
    ],
    engineering: [
      'PR ready for review: New feature implementation',
      'Code review completed, looks good to merge',
      'Unit tests passing, ready for QA',
      'Performance optimization showing 30% improvement',
      'Refactored authentication module for better maintainability',
      'Added integration tests for payment flow',
      'Documentation updated for new API endpoints',
      'Dependency updates merged, no breaking changes',
      'Fixed flaky test in CI pipeline',
      'Implemented caching layer for frequently accessed data',
      'Migration script tested on staging environment',
      'API versioning strategy finalized',
      'Microservice deployment successful',
      'Feature flag rollout at 25%',
      'Database index optimization completed',
      'WebSocket implementation ready for testing',
      'GraphQL schema updates deployed',
      'Kubernetes scaling policies updated',
      'Monitoring dashboards enhanced with new metrics',
      'Tech debt ticket created for legacy code cleanup',
    ],
    general: [
      'Team meeting in 15 minutes',
      'Great job on last sprint everyone! 🎉',
      'Reminder: Company all-hands tomorrow at 10 AM',
      'New team member starting next week',
      'Holiday schedule posted in the wiki',
      'Office will be closed for maintenance this weekend',
      'Q1 OKRs have been finalized',
      'Congratulations on the successful product launch!',
      'Team lunch scheduled for Friday',
      'Updated PTO policy documents available',
      'Security awareness training reminder',
      'New benefits enrollment period open',
      'Quarterly business review next Wednesday',
      'IT support tickets should be filed via portal',
      'Updated code of conduct posted',
      'Employee survey results shared',
      'New parking passes available',
      'Office renovation starting next month',
      'Team building event planning in progress',
      'Monthly newsletter published',
    ],
  };

  const additionalMessages = [];
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Generate 985 additional messages (1000 total - 15 existing)
  for (let i = 0; i < 985; i++) {
    const channelIndex = i % 3;
    let channel: SlackChannel | undefined;
    let channelType: 'incident' | 'engineering' | 'general';

    if (channelIndex === 0) {
      channel = incidentChannel;
      channelType = 'incident';
    } else if (channelIndex === 1) {
      channel = engineeringChannel;
      channelType = 'engineering';
    } else {
      channel = generalChannel;
      channelType = 'general';
    }

    const templates = messageTemplates[channelType];
    const text = templates[Math.floor(Math.random() * templates.length)];
    const user = users[Math.floor(Math.random() * users.length)];

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

    const tsValue = Math.floor(messageDate.getTime() / 1000) + (i * 0.001);

    // More replies and reactions for recent messages
    let replyCount;
    if (daysAgo < 30) {
      replyCount = Math.floor(Math.random() * 20) + 5; // 5-25 replies
    } else if (daysAgo < 60) {
      replyCount = Math.floor(Math.random() * 10) + 2; // 2-12 replies
    } else {
      replyCount = Math.floor(Math.random() * 5); // 0-5 replies
    }

    additionalMessages.push({
      channelId: channel!.id,
      slackMessageTs: `${tsValue.toFixed(6)}`,
      slackChannelId: channel!.slackChannelId,
      slackUserId: user,
      text: `${text} [auto-generated #${i + 1}]`,
      slackCreatedAt: messageDate,
      type: 'message',
      replyCount,
    });
  }

  const messagesData = [
    {
      channelId: incidentChannel!.id,
      slackMessageTs: '1737001800.000001',
      slackChannelId: 'C03INCIDENT',
      slackUserId: 'U01USER001',
      text: '🚨 INCIDENT: Payment gateway experiencing high latency. Investigating now.',
      slackCreatedAt: new Date('2026-01-15 08:30:00'),
      type: 'message',
      replyCount: 12,
    },
    {
      channelId: incidentChannel!.id,
      slackMessageTs: '1737002700.000002',
      slackChannelId: 'C03INCIDENT',
      slackUserId: 'U01USER002',
      text: 'Identified the issue - connection pool maxed out. Scaling up DB connections.',
      slackCreatedAt: new Date('2026-01-15 08:45:00'),
      type: 'message',
      slackThreadTs: '1737001800.000001',
      isThreadReply: true,
      replyCount: 0,
    },
    {
      channelId: incidentChannel!.id,
      slackMessageTs: '1737004500.000003',
      slackChannelId: 'C03INCIDENT',
      slackUserId: 'U01USER001',
      text: '✅ RESOLVED: Payment gateway latency back to normal. Total impact: 45 minutes.',
      slackCreatedAt: new Date('2026-01-15 09:15:00'),
      type: 'message',
      replyCount: 4,
    },
    {
      channelId: engineeringChannel!.id,
      slackMessageTs: '1738416600.000101',
      slackChannelId: 'C02ENGINEER',
      slackUserId: 'U01USER004',
      text: 'PR ready for review: Real-time notification system https://github.com/demo/pr/567',
      slackCreatedAt: new Date('2026-02-02 10:30:00'),
      type: 'message',
      replyCount: 6,
    },
    {
      channelId: engineeringChannel!.id,
      slackMessageTs: '1737869700.000102',
      slackChannelId: 'C02ENGINEER',
      slackUserId: 'U01USER005',
      text: 'Great work on the OAuth migration! Seeing much better performance.',
      slackCreatedAt: new Date('2026-01-26 09:15:00'),
      type: 'message',
      replyCount: 3,
    },
    {
      channelId: incidentChannel!.id,
      slackMessageTs: '1738495200.000004',
      slackChannelId: 'C03INCIDENT',
      slackUserId: 'U01USER003',
      text: '🚨 Memory leak detected in app servers. Investigating before it becomes critical.',
      slackCreatedAt: new Date('2026-02-03 06:20:00'),
      type: 'message',
      replyCount: 8,
    },
    {
      channelId: engineeringChannel!.id,
      slackMessageTs: '1738420800.000103',
      slackChannelId: 'C02ENGINEER',
      slackUserId: 'U01USER004',
      text: 'MFA implementation is ready for code review. Added TOTP support with QR codes.',
      slackCreatedAt: new Date('2026-02-02 11:40:00'),
      type: 'message',
      replyCount: 5,
    },
    {
      channelId: engineeringChannel!.id,
      slackMessageTs: '1738325400.000104',
      slackChannelId: 'C02ENGINEER',
      slackUserId: 'U01USER007',
      text: 'Daily standup in 10 minutes! Please post your updates here if you can\'t join.',
      slackCreatedAt: new Date('2026-02-01 09:10:00'),
      type: 'message',
      replyCount: 12,
    },
    {
      channelId: generalChannel!.id,
      slackMessageTs: '1738400000.000201',
      slackChannelId: 'C01GENERAL',
      slackUserId: 'U01USER001',
      text: '📣 Server maintenance scheduled for this Saturday 2-4 AM EST. All services will be temporarily unavailable.',
      slackCreatedAt: new Date('2026-02-02 06:00:00'),
      type: 'message',
      replyCount: 15,
    },
    {
      channelId: generalChannel!.id,
      slackMessageTs: '1738250000.000202',
      slackChannelId: 'C01GENERAL',
      slackUserId: 'U01USER006',
      text: 'Congratulations to the team for hitting 99.9% uptime last month! 🎉',
      slackCreatedAt: new Date('2026-01-31 12:20:00'),
      type: 'message',
      replyCount: 24,
    },
    {
      channelId: engineeringChannel!.id,
      slackMessageTs: '1737900000.000105',
      slackChannelId: 'C02ENGINEER',
      slackUserId: 'U01USER003',
      text: 'Database backup automation PR merged. We now have hourly backups with 30-day retention.',
      slackCreatedAt: new Date('2026-01-26 17:40:00'),
      type: 'message',
      replyCount: 7,
    },
    {
      channelId: incidentChannel!.id,
      slackMessageTs: '1738100000.000005',
      slackChannelId: 'C03INCIDENT',
      slackUserId: 'U01USER006',
      text: 'SSL cert renewal completed successfully. All services using new certificates.',
      slackCreatedAt: new Date('2026-01-28 19:20:00'),
      type: 'message',
      replyCount: 3,
    },
    {
      channelId: engineeringChannel!.id,
      slackMessageTs: '1738500000.000106',
      slackChannelId: 'C02ENGINEER',
      slackUserId: 'U01USER004',
      text: 'Redis caching implementation started. Should see 40-50% reduction in DB queries.',
      slackCreatedAt: new Date('2026-02-03 07:40:00'),
      type: 'message',
      replyCount: 9,
    },
    {
      channelId: generalChannel!.id,
      slackMessageTs: '1738450000.000203',
      slackChannelId: 'C01GENERAL',
      slackUserId: 'U01USER005',
      text: 'Reminder: Security training session tomorrow at 2 PM. Attendance is mandatory.',
      slackCreatedAt: new Date('2026-02-02 17:50:00'),
      type: 'message',
      replyCount: 18,
    },
    {
      channelId: engineeringChannel!.id,
      slackMessageTs: '1737800000.000107',
      slackChannelId: 'C02ENGINEER',
      slackUserId: 'U01USER006',
      text: 'CI/CD pipeline improvements deployed. Build times reduced from 12min to 6min! 🚀',
      slackCreatedAt: new Date('2026-01-25 14:00:00'),
      type: 'message',
      replyCount: 11,
    },
    {
      channelId: incidentChannel!.id,
      slackMessageTs: '1737950000.000006',
      slackChannelId: 'C03INCIDENT',
      slackUserId: 'U01USER002',
      text: 'Monitoring alert: API response times increased by 200ms. Investigating...',
      slackCreatedAt: new Date('2026-01-27 07:30:00'),
      type: 'message',
      replyCount: 6,
    },
    {
      channelId: generalChannel!.id,
      slackMessageTs: '1738300000.000204',
      slackChannelId: 'C01GENERAL',
      slackUserId: 'U01USER001',
      text: '🎂 Happy birthday to @user_007! Thanks for all your amazing work on the team!',
      slackCreatedAt: new Date('2026-02-01 02:00:00'),
      type: 'message',
      replyCount: 32,
    },
  ];

  // Combine original messages with generated ones
  const allMessages = [...messagesData, ...additionalMessages];

  for (const messageData of allMessages) {
    let message = await slackMessageRepo.findOne({
      where: { slackMessageTs: messageData.slackMessageTs },
    });

    if (!message) {
      message = slackMessageRepo.create({
        ...messageData,
        tenantId,
      });
      await slackMessageRepo.save(message);
      console.log(`✓ Created Slack message in #${messageData.slackChannelId}`);
    } else {
      console.log(`✓ Slack message already exists: ${messageData.slackMessageTs}`);
    }
  }

  console.log('✅ Slack data seeded successfully!\n');
}
