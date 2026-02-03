import { DataSource } from 'typeorm';
import { TeamsConnection } from '../../modules/teams/entities/teams-connection.entity';
import { TeamsChannel } from '../../modules/teams/entities/teams-channel.entity';
import { TeamsMessage } from '../../modules/teams/entities/teams-message.entity';

export async function seedTeamsData(dataSource: DataSource, tenantId: number): Promise<void> {
  const teamsConnectionRepo = dataSource.getRepository(TeamsConnection);
  const teamsChannelRepo = dataSource.getRepository(TeamsChannel);
  const teamsMessageRepo = dataSource.getRepository(TeamsMessage);

  console.log('\n📋 Seeding Teams integration data...');

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

  for (const messageData of messagesData) {
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
