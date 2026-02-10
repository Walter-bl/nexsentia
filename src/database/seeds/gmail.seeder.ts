import { DataSource } from 'typeorm';
import { GmailConnection } from '../../modules/gmail/entities/gmail-connection.entity';
import { GmailMailbox } from '../../modules/gmail/entities/gmail-mailbox.entity';
import { GmailMessage } from '../../modules/gmail/entities/gmail-message.entity';

export async function seedGmailData(dataSource: DataSource, tenantId: number): Promise<void> {
  const connectionRepo = dataSource.getRepository(GmailConnection);
  const mailboxRepo = dataSource.getRepository(GmailMailbox);
  const messageRepo = dataSource.getRepository(GmailMessage);

  console.log('📧 Seeding Gmail data...');

  // Delete existing Gmail data for this tenant
  await messageRepo.delete({ tenantId });
  await mailboxRepo.delete({ tenantId });
  await connectionRepo.delete({ tenantId });
  console.log('  🗑️  Deleted existing Gmail data');

  // Create Gmail connection
  const connection = connectionRepo.create({
    tenantId,
    email: 'demo@company.com',
    userId: 'gmail_user_001',
    isActive: true,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    lastSyncedAt: new Date(),
  });
  await connectionRepo.save(connection);
  console.log('  ✅ Created Gmail connection');

  // Create mailboxes (labels)
  const inboxMailbox = mailboxRepo.create({
    tenantId,
    connectionId: connection.id,
    labelId: 'INBOX',
    labelName: 'INBOX',
    labelType: 'system',
    totalMessages: 0,
    unreadMessages: 0,
  });

  const sentMailbox = mailboxRepo.create({
    tenantId,
    connectionId: connection.id,
    labelId: 'SENT',
    labelName: 'SENT',
    labelType: 'system',
    totalMessages: 0,
    unreadMessages: 0,
  });

  await mailboxRepo.save([inboxMailbox, sentMailbox]);
  console.log('  ✅ Created Gmail mailboxes');

  // Generate email messages with ACCELERATION pattern (60-25-15 distribution)
  const now = new Date();
  const messages: any[] = [];

  // Email subjects related to issues, incidents, and communication
  const subjectTemplates = [
    'RE: Production incident - database connection timeout',
    'Urgent: API gateway errors in region us-east-1',
    'FW: Customer complaint about slow page load',
    'Bug report: Login form validation failing',
    'Critical: Payment processing service down',
    'RE: Memory leak in background worker process',
    'Team meeting notes - sprint retrospective',
    'Q1 roadmap planning discussion',
    'RE: Code review requested for PR #',
    'Deploy status: rollback completed',
    'FW: Security vulnerability discovered',
    'Performance degradation in search service',
    'RE: Data sync failed for tenant',
    'Customer feedback: feature request for export',
    'Daily standup summary',
    'RE: Integration test failures on CI',
    'Hotfix deployed to staging environment',
    'FW: Monitoring alert - high CPU usage',
    'RE: Design review meeting tomorrow',
    'Sprint planning - next iteration',
  ];

  const senders = [
    { name: 'John Smith', email: 'john.smith@company.com' },
    { name: 'Sarah Johnson', email: 'sarah.johnson@company.com' },
    { name: 'Mike Chen', email: 'mike.chen@company.com' },
    { name: 'Emily Davis', email: 'emily.davis@company.com' },
    { name: 'David Wilson', email: 'david.wilson@company.com' },
    { name: 'Lisa Anderson', email: 'lisa.anderson@company.com' },
    { name: 'Tom Martinez', email: 'tom.martinez@company.com' },
    { name: 'Jessica Lee', email: 'jessica.lee@company.com' },
    { name: 'Robert Taylor', email: 'robert.taylor@company.com' },
    { name: 'Amanda White', email: 'amanda.white@company.com' },
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
      .replace('#', String(Math.floor(Math.random() * 500) + 1));

    const isImportant = Math.random() > 0.7; // 30% important
    const hasAttachment = Math.random() > 0.75; // 25% has attachment
    const isRead = daysAgo > 7 || Math.random() > 0.3; // Older messages more likely read

    // Generate email body with issues and keywords
    const bodyKeywords = ['issue', 'problem', 'error', 'bug', 'critical', 'urgent', 'incident', 'failure', 'down', 'slow'];
    const hasIssueKeyword = Math.random() > 0.6; // 40% of emails mention issues
    const keyword = bodyKeywords[Math.floor(Math.random() * bodyKeywords.length)];

    let bodyText = `Hi team,\n\n`;
    if (hasIssueKeyword) {
      bodyText += `I wanted to follow up on the ${keyword} we discussed earlier. `;
    }
    bodyText += `${subject.replace('RE: ', '').replace('FW: ', '')}\n\n`;
    bodyText += `Please review and let me know your thoughts.\n\nBest regards,\n${sender.name}`;

    messages.push({
      tenantId,
      mailboxId: Math.random() > 0.8 ? sentMailbox.id : inboxMailbox.id, // 80% inbox, 20% sent
      gmailMessageId: `msg_${i + 1}_${Date.now()}`,
      gmailThreadId: `thread_${Math.floor(i / 3)}_${Date.now()}`, // Group every 3 messages into threads
      subject,
      bodyText,
      bodyHtml: bodyText.replace(/\n/g, '<br>'),
      snippet: bodyText.substring(0, 100),
      fromEmail: sender.email,
      fromName: sender.name,
      toRecipients: [
        { email: 'demo@company.com', name: 'Demo User' },
      ],
      labels: ['INBOX', 'UNREAD'].filter(() => Math.random() > 0.5),
      isRead,
      isStarred: Math.random() > 0.9, // 10% starred
      isImportant,
      isDraft: false,
      isSent: Math.random() > 0.8,
      isTrash: false,
      isSpam: false,
      hasAttachment,
      attachments: hasAttachment ? [
        {
          partId: `part_${i}`,
          filename: `document_${i}.pdf`,
          mimeType: 'application/pdf',
          size: Math.floor(Math.random() * 1000000) + 10000,
          attachmentId: `att_${i}`,
        },
      ] : undefined,
      sizeBytes: Math.floor(Math.random() * 50000) + 5000,
      gmailCreatedAt: createdDate,
      lastSyncedAt: new Date(),
      metadata: {
        priority: isImportant ? 'high' : 'normal',
        category: hasIssueKeyword ? 'incident' : 'general',
      },
    });
  }

  // Save messages in batches
  console.log(`  📨 Creating ${messages.length} Gmail messages...`);
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

  console.log(`  ✅ Gmail seeding complete (${messages.length} messages, ${inboxMailbox.unreadMessages} unread)`);
  console.log('');
}
