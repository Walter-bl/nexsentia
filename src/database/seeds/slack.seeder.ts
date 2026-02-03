import { DataSource } from 'typeorm';
import { SlackConnection } from '../../modules/slack/entities/slack-connection.entity';
import { SlackChannel } from '../../modules/slack/entities/slack-channel.entity';
import { SlackMessage } from '../../modules/slack/entities/slack-message.entity';

export async function seedSlackData(dataSource: DataSource, tenantId: number): Promise<void> {
  const slackConnectionRepo = dataSource.getRepository(SlackConnection);
  const slackChannelRepo = dataSource.getRepository(SlackChannel);
  const slackMessageRepo = dataSource.getRepository(SlackMessage);

  console.log('\n💬 Seeding Slack integration data...');

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
      totalMessagesSynced: 15,
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

  for (const messageData of messagesData) {
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
