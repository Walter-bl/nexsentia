import { DataSource } from 'typeorm';
import { OutlookConnection } from '../../modules/outlook/entities/outlook-connection.entity';
import { OutlookMailbox } from '../../modules/outlook/entities/outlook-mailbox.entity';
import { OutlookMessage } from '../../modules/outlook/entities/outlook-message.entity';

export async function seedOutlookData(dataSource: DataSource, tenantId: number): Promise<void> {
  const connectionRepo = dataSource.getRepository(OutlookConnection);
  const mailboxRepo = dataSource.getRepository(OutlookMailbox);
  const messageRepo = dataSource.getRepository(OutlookMessage);

  console.log('📮 Seeding Outlook data...');

  // Delete existing Outlook data for this tenant
  await messageRepo.delete({ tenantId });
  await mailboxRepo.delete({ tenantId });
  await connectionRepo.delete({ tenantId });
  console.log('  🗑️  Deleted existing Outlook data');

  // Create Outlook connection
  const connection = connectionRepo.create({
    tenantId,
    email: 'corporate@company.com',
    userId: 'outlook_user_001',
    isActive: true,
    scopes: ['Mail.Read', 'Mail.ReadWrite'],
    lastSyncedAt: new Date(),
  });
  await connectionRepo.save(connection);
  console.log('  ✅ Created Outlook connection');

  // Create mailboxes (folders)
  const inboxMailbox = mailboxRepo.create({
    tenantId,
    connectionId: connection.id,
    folderId: 'inbox_001',
    folderName: 'Inbox',
    folderType: 'mail',
    totalMessages: 0,
    unreadMessages: 0,
  });

  const sentMailbox = mailboxRepo.create({
    tenantId,
    connectionId: connection.id,
    folderId: 'sent_001',
    folderName: 'Sent Items',
    folderType: 'mail',
    totalMessages: 0,
    unreadMessages: 0,
  });

  await mailboxRepo.save([inboxMailbox, sentMailbox]);
  console.log('  ✅ Created Outlook mailboxes');

  // Generate email messages with ACCELERATION pattern (60-25-15 distribution)
  const now = new Date();
  const messages: any[] = [];

  // Email subjects related to corporate communications and incidents
  const subjectTemplates = [
    'RE: Escalation - production environment down',
    'FW: Incident report - authentication service failure',
    'Action Required: Critical vulnerability patch',
    'Urgent: Client escalation - data export issue',
    'RE: Service degradation in payment gateway',
    'Weekly status update - engineering team',
    'FW: Alert - high error rate in API service',
    'RE: Infrastructure maintenance window',
    'Quarterly business review meeting',
    'Urgent: Database backup failure notification',
    'RE: Release deployment - hotfix v2.3.1',
    'FW: Customer complaint escalation',
    'Team announcement: new process rollout',
    'RE: Code freeze for production release',
    'Security incident response update',
    'FW: Monitoring alert - disk space critical',
    'RE: Performance testing results',
    'Emergency maintenance notification',
    'FW: User access issues reported',
    'RE: Sprint retrospective action items',
  ];

  const senders = [
    { name: 'James Brown', email: 'james.brown@company.com' },
    { name: 'Patricia Miller', email: 'patricia.miller@company.com' },
    { name: 'Christopher Garcia', email: 'christopher.garcia@company.com' },
    { name: 'Jennifer Martinez', email: 'jennifer.martinez@company.com' },
    { name: 'Daniel Rodriguez', email: 'daniel.rodriguez@company.com' },
    { name: 'Maria Lopez', email: 'maria.lopez@company.com' },
    { name: 'Matthew Wilson', email: 'matthew.wilson@company.com' },
    { name: 'Barbara Moore', email: 'barbara.moore@company.com' },
    { name: 'Anthony Taylor', email: 'anthony.taylor@company.com' },
    { name: 'Susan Anderson', email: 'susan.anderson@company.com' },
  ];

  // Generate 1000 messages with 60-25-15 acceleration pattern
  for (let i = 0; i < 1000; i++) {
    let daysAgo: number;

    if (i < 600) {
      // 60% of messages in last 30 days (HIGH recent activity)
      daysAgo = Math.floor(Math.random() * 30);
    } else if (i < 850) {
      // 25% of messages in 30-60 days ago (MODERATE activity)
      daysAgo = Math.floor(Math.random() * 30) + 30;
    } else {
      // 15% of messages in 60-90 days ago (LOW baseline activity)
      daysAgo = Math.floor(Math.random() * 30) + 60;
    }

    const hoursOffset = Math.floor(Math.random() * 24);
    const minutesOffset = Math.floor(Math.random() * 60);

    const createdDate = new Date(now);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    createdDate.setHours(hoursOffset);
    createdDate.setMinutes(minutesOffset);

    const sender = senders[Math.floor(Math.random() * senders.length)];
    const subject = subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)]
      .replace('v2.3.1', `v2.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`);

    const importance = Math.random() > 0.7 ? 'high' : (Math.random() > 0.5 ? 'normal' : 'low');
    const hasAttachment = Math.random() > 0.7; // 30% has attachment
    const isRead = daysAgo > 7 || Math.random() > 0.3; // Older messages more likely read

    // Generate email body with corporate keywords
    const bodyKeywords = ['escalation', 'incident', 'outage', 'critical', 'urgent', 'failure', 'alert', 'issue', 'problem', 'downtime'];
    const hasIssueKeyword = Math.random() > 0.5; // 50% of emails mention issues
    const keyword = bodyKeywords[Math.floor(Math.random() * bodyKeywords.length)];

    let bodyText = `Dear team,\n\n`;
    if (hasIssueKeyword) {
      bodyText += `This is regarding the ${keyword} we're currently facing: `;
    }
    bodyText += `${subject.replace('RE: ', '').replace('FW: ', '')}\n\n`;
    bodyText += `Please review at your earliest convenience and take appropriate action.\n\n`;
    bodyText += `Best regards,\n${sender.name}\n${sender.email}`;

    const receivedDate = new Date(createdDate);
    const sentDate = Math.random() > 0.8 ? new Date(receivedDate.getTime() - 60000) : undefined;

    messages.push({
      tenantId,
      mailboxId: Math.random() > 0.75 ? sentMailbox.id : inboxMailbox.id, // 75% inbox, 25% sent
      outlookMessageId: `outlook_msg_${i + 1}_${Date.now()}`,
      conversationId: `conv_${Math.floor(i / 4)}_${Date.now()}`, // Group every 4 messages into conversations
      subject,
      bodyText,
      bodyHtml: `<html><body>${bodyText.replace(/\n/g, '<br>')}</body></html>`,
      bodyPreview: bodyText.substring(0, 120),
      fromEmail: sender.email,
      fromName: sender.name,
      toRecipients: [
        { email: 'corporate@company.com', name: 'Corporate Team' },
      ],
      ccRecipients: Math.random() > 0.7 ? [
        { email: 'manager@company.com', name: 'Team Manager' },
      ] : undefined,
      categories: importance === 'high' ? ['Red Category'] : [],
      isRead,
      isFlagged: Math.random() > 0.85, // 15% flagged
      isImportant: importance === 'high',
      isDraft: false,
      importance,
      hasAttachment,
      attachments: hasAttachment ? [
        {
          id: `att_outlook_${i}`,
          name: `report_${i}.xlsx`,
          contentType: 'application/vnd.ms-excel',
          size: Math.floor(Math.random() * 2000000) + 20000,
          isInline: false,
        },
      ] : undefined,
      internetMessageId: `<msg${i}@company.com>`,
      webLink: `https://outlook.office.com/mail/id/${i}`,
      sizeBytes: Math.floor(Math.random() * 60000) + 8000,
      outlookCreatedAt: createdDate,
      outlookReceivedAt: receivedDate,
      outlookSentAt: sentDate,
      lastModifiedAt: createdDate,
      lastSyncedAt: new Date(),
      metadata: {
        priority: importance === 'high' ? 'urgent' : 'normal',
        category: hasIssueKeyword ? 'incident' : 'general',
      },
    });
  }

  // Save messages in batches
  console.log(`  📨 Creating ${messages.length} Outlook messages...`);
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await messageRepo.save(batch);
    console.log(`  ✅ Saved ${Math.min(i + 100, messages.length)}/${messages.length} messages`);
  }

  // Update mailbox counts
  inboxMailbox.totalMessages = await messageRepo.count({ where: { mailboxId: inboxMailbox.id } });
  inboxMailbox.unreadMessages = await messageRepo.count({ where: { mailboxId: inboxMailbox.id, isRead: false } });
  sentMailbox.totalMessages = await messageRepo.count({ where: { mailboxId: sentMailbox.id } });
  sentMailbox.unreadMessages = await messageRepo.count({ where: { mailboxId: sentMailbox.id, isRead: false } });
  await mailboxRepo.save([inboxMailbox, sentMailbox]);

  console.log(`  ✅ Outlook seeding complete (${messages.length} messages, ${inboxMailbox.unreadMessages} unread)`);
  console.log('');
}
