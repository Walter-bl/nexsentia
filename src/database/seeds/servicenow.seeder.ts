import { DataSource } from 'typeorm';
import { ServiceNowConnection } from '../../modules/servicenow/entities/servicenow-connection.entity';
import { ServiceNowIncident } from '../../modules/servicenow/entities/servicenow-incident.entity';
import { refinedServiceNowIncidents } from './data/servicenow-refined.seed';

export async function seedServiceNowData(dataSource: DataSource, tenantId: number): Promise<void> {
  const serviceNowConnectionRepo = dataSource.getRepository(ServiceNowConnection);
  const serviceNowIncidentRepo = dataSource.getRepository(ServiceNowIncident);

  console.log('\n🎫 Seeding ServiceNow integration data...');

  // Delete existing incidents for this tenant to avoid duplicates
  await serviceNowIncidentRepo.delete({ tenantId });
  console.log('  🗑️  Deleted existing ServiceNow incidents');

  // ============================================
  // ServiceNow Connection
  // ============================================
  let serviceNowConnection = await serviceNowConnectionRepo.findOne({
    where: { tenantId, instanceUrl: 'https://democompany.service-now.com' },
  });

  if (!serviceNowConnection) {
    serviceNowConnection = serviceNowConnectionRepo.create({
      tenantId,
      name: 'Demo ServiceNow Instance',
      instanceUrl: 'https://democompany.service-now.com',
      accessToken: 'demo_sn_token_encrypted',
      refreshToken: 'demo_sn_refresh_encrypted',
      tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      instanceId: 'inst_demo_123',
      isActive: true,
      totalIncidentsSynced: 1000,
      lastSuccessfulSyncAt: new Date(),
    });
    await serviceNowConnectionRepo.save(serviceNowConnection);
    console.log('✓ Created ServiceNow connection');
  } else {
    console.log('✓ ServiceNow connection already exists');
  }

  // ============================================
  // ServiceNow Incidents
  // ============================================

  // Generate additional incidents for realistic dataset
  const priorities = [
    { name: '1 - Critical', value: 1, urgency: '1 - High', urgencyValue: 1, impact: '1 - High', impactValue: 1 },
    { name: '2 - High', value: 2, urgency: '2 - Medium', urgencyValue: 2, impact: '2 - Medium', impactValue: 2 },
    { name: '3 - Moderate', value: 3, urgency: '2 - Medium', urgencyValue: 2, impact: '2 - Medium', impactValue: 2 },
    { name: '4 - Low', value: 4, urgency: '3 - Low', urgencyValue: 3, impact: '3 - Low', impactValue: 3 },
  ];

  const states = [
    { name: 'New', value: 1, isResolved: false },
    { name: 'In Progress', value: 2, isResolved: false },
    { name: 'On Hold', value: 3, isResolved: false },
    { name: 'Resolved', value: 6, isResolved: true },
    { name: 'Closed', value: 7, isResolved: true },
  ];

  const categories = [
    { category: 'Infrastructure', subcategory: 'Server', group: 'group_infra_001', groupName: 'Infrastructure Team' },
    { category: 'Infrastructure', subcategory: 'Database', group: 'group_db_001', groupName: 'Database Team' },
    { category: 'Application', subcategory: 'Web App', group: 'group_app_001', groupName: 'Application Support' },
    { category: 'Application', subcategory: 'Mobile App', group: 'group_app_001', groupName: 'Application Support' },
    { category: 'Network', subcategory: 'LAN', group: 'group_network_001', groupName: 'Network Operations' },
    { category: 'Network', subcategory: 'WAN', group: 'group_network_001', groupName: 'Network Operations' },
    { category: 'Hardware', subcategory: 'Desktop', group: 'group_desktop_001', groupName: 'Desktop Support' },
    { category: 'Hardware', subcategory: 'Laptop', group: 'group_desktop_001', groupName: 'Desktop Support' },
    { category: 'Security', subcategory: 'Access Control', group: 'group_security_001', groupName: 'Security Team' },
  ];

  const users = [
    { id: 'user_sn_001', name: 'John Smith' },
    { id: 'user_sn_002', name: 'Jane Doe' },
    { id: 'user_sn_003', name: 'Mike Wilson' },
    { id: 'user_sn_004', name: 'Sarah Johnson' },
    { id: 'user_sn_005', name: 'David Lee' },
    { id: 'user_sn_006', name: 'Emily White' },
    { id: 'user_sn_007', name: 'Robert Green' },
    { id: 'user_sn_008', name: 'Lisa Chen' },
  ];

  const incidentTemplates = [
    { short: 'Server CPU utilization exceeding 95%', desc: 'Production web server showing sustained high CPU usage causing response delays.' },
    { short: 'Memory leak detected in application pool', desc: 'IIS application pool memory consumption growing continuously, requires periodic restart.' },
    { short: 'API endpoint returning 500 errors', desc: 'Critical API endpoint failing with internal server errors affecting customer transactions.' },
    { short: 'SSL certificate expiring in 7 days', desc: 'Production domain SSL certificate approaching expiration, renewal required urgently.' },
    { short: 'Database query performance degradation', desc: 'Reports generation taking 10x longer than baseline, indexes may need optimization.' },
    { short: 'Load balancer health check failures', desc: 'Backend servers intermittently failing health checks causing traffic distribution issues.' },
    { short: 'Disk space usage above 90% threshold', desc: 'Application log volume mounted on /var/log approaching capacity limit.' },
    { short: 'Authentication service timeout errors', desc: 'Users experiencing login delays and timeouts during peak hours.' },
    { short: 'Scheduled backup job not running', desc: 'Automated database backup scheduled task failed to execute for past 2 nights.' },
    { short: 'Network latency spike detected', desc: 'Inter-datacenter network latency increased from 20ms to 150ms baseline.' },
    { short: 'Web application session timeout issues', desc: 'Users being logged out prematurely, session state not persisting correctly.' },
    { short: 'Email delivery delays reported', desc: 'Outbound emails queuing up in mail server, average delivery time 45 minutes.' },
    { short: 'Mobile app push notifications failing', desc: 'Push notification service returning errors, users not receiving alerts.' },
    { short: 'Third-party API integration broken', desc: 'Payment gateway integration returning connection refused errors.' },
    { short: 'File upload functionality not working', desc: 'Users unable to upload documents, receiving client timeout errors.' },
    { short: 'Cache invalidation not working properly', desc: 'Stale data being served to users despite backend updates.' },
    { short: 'Microservice health endpoint down', desc: 'Order processing microservice health check endpoint returning 503 errors.' },
    { short: 'Container orchestration pod crashes', desc: 'Kubernetes pods in production namespace restarting repeatedly.' },
    { short: 'CDN origin server unreachable', desc: 'Content delivery network unable to reach origin server for cache refresh.' },
    { short: 'Background job queue backlog growing', desc: 'Async job processing queue depth increasing, workers not keeping up.' },
  ];

  const resolutionCodes = [
    'Service Restored',
    'Configuration Change',
    'Software Update',
    'Hardware Replacement',
    'Service Restart',
    'User Error',
    'Known Issue',
    'Patch Applied',
  ];

  const additionalIncidents: any[] = [];
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Generate 991 additional incidents (1000 total - 9 existing)
  // Strategy: Create 40% recent (0-30 days), 30% mid (30-60 days), 30% old (60-90 days)
  for (let i = 0; i < 991; i++) {
    const template = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
    const state = states[Math.floor(Math.random() * states.length)];
    const categoryInfo = categories[Math.floor(Math.random() * categories.length)];
    const assignedUser = users[Math.floor(Math.random() * users.length)];
    const caller = users[Math.floor(Math.random() * users.length)];

    // Generate timestamps - deterministic distribution across time periods
    let daysAgo;
    if (i < 400) {
      // First 400 incidents: 0-30 days ago (recent)
      daysAgo = Math.floor(Math.random() * 30);
    } else if (i < 700) {
      // Next 300 incidents: 30-60 days ago (mid)
      daysAgo = Math.floor(Math.random() * 30) + 30;
    } else {
      // Last 291 incidents: 60-90 days ago (old)
      daysAgo = Math.floor(Math.random() * 30) + 60;
    }
    const hoursOffset = Math.floor(Math.random() * 24);
    const minutesOffset = Math.floor(Math.random() * 60);
    const openedDate = new Date(ninetyDaysAgo);
    openedDate.setDate(openedDate.getDate() + daysAgo);
    openedDate.setHours(hoursOffset);
    openedDate.setMinutes(minutesOffset);

    // Adjust priority distribution based on age - recent incidents are less critical
    let adjustedPriority;
    if (daysAgo > 60) {
      // Older data (60-90 days ago) - worse metrics, more critical incidents
      const criticalChance = Math.random();
      if (criticalChance < 0.15) {
        adjustedPriority = priorities[0]; // 1 - Critical (15%)
      } else if (criticalChance < 0.35) {
        adjustedPriority = priorities[1]; // 2 - High (20%)
      } else if (criticalChance < 0.65) {
        adjustedPriority = priorities[2]; // 3 - Moderate (30%)
      } else {
        adjustedPriority = priorities[3]; // 4 - Low (35%)
      }
    } else if (daysAgo > 30) {
      // Mid-range data (30-60 days ago) - moderate metrics
      const criticalChance = Math.random();
      if (criticalChance < 0.08) {
        adjustedPriority = priorities[0]; // 1 - Critical (8%)
      } else if (criticalChance < 0.25) {
        adjustedPriority = priorities[1]; // 2 - High (17%)
      } else if (criticalChance < 0.60) {
        adjustedPriority = priorities[2]; // 3 - Moderate (35%)
      } else {
        adjustedPriority = priorities[3]; // 4 - Low (40%)
      }
    } else {
      // Recent data (0-30 days ago) - best metrics, fewer critical incidents
      const criticalChance = Math.random();
      if (criticalChance < 0.03) {
        adjustedPriority = priorities[0]; // 1 - Critical (3%)
      } else if (criticalChance < 0.12) {
        adjustedPriority = priorities[1]; // 2 - High (9%)
      } else if (criticalChance < 0.40) {
        adjustedPriority = priorities[2]; // 3 - Moderate (28%)
      } else {
        adjustedPriority = priorities[3]; // 4 - Low (60%)
      }
    }

    const incidentNum = 11000 + i;
    const incident: any = {
      sysId: `sys_inc_gen_${incidentNum}`,
      number: `INC00${incidentNum}`,
      shortDescription: `${template.short} [auto-gen #${i + 1}]`,
      description: template.desc,
      state: state.name,
      stateValue: state.value,
      priority: adjustedPriority.name,
      priorityValue: adjustedPriority.value,
      urgency: adjustedPriority.urgency,
      urgencyValue: adjustedPriority.urgencyValue,
      impact: adjustedPriority.impact,
      impactValue: adjustedPriority.impactValue,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      assignedTo: assignedUser.id,
      assignedToName: assignedUser.name,
      assignmentGroup: categoryInfo.group,
      assignmentGroupName: categoryInfo.groupName,
      caller: caller.id,
      callerName: caller.name,
      openedAt: openedDate,
      sysCreatedOn: openedDate,
      sysUpdatedOn: new Date(),
      sysCreatedBy: 'system',
      sysUpdatedBy: assignedUser.id,
    };

    // Add resolution data if resolved/closed - with better resolution times for recent incidents
    if (state.isResolved) {
      const resolutionCode = resolutionCodes[Math.floor(Math.random() * resolutionCodes.length)];

      // Resolution time based on age and priority - MUCH MORE EXTREME differences
      let resolutionMinutes;
      if (daysAgo > 60) {
        // Older incidents: 12-72 hours (VERY poor resolution times)
        resolutionMinutes = Math.floor(Math.random() * 60 * 60) + 720;
      } else if (daysAgo > 30) {
        // Mid-range incidents: 4-16 hours (moderate resolution times)
        resolutionMinutes = Math.floor(Math.random() * 12 * 60) + 240;
      } else {
        // Recent incidents: VERY fast resolution
        if (adjustedPriority.value === 1) {
          // Critical: 15min - 2 hours (excellent!)
          resolutionMinutes = Math.floor(Math.random() * 105) + 15;
        } else if (adjustedPriority.value === 2) {
          // High: 30min - 3 hours
          resolutionMinutes = Math.floor(Math.random() * 150) + 30;
        } else if (adjustedPriority.value === 3) {
          // Moderate: 1-4 hours
          resolutionMinutes = Math.floor(Math.random() * 180) + 60;
        } else {
          // Low: 1-5 hours
          resolutionMinutes = Math.floor(Math.random() * 240) + 60;
        }
      }

      const resolvedDate = new Date(openedDate.getTime() + resolutionMinutes * 60 * 1000);
      const closedDate = new Date(resolvedDate.getTime() + 30 * 60 * 1000); // 30 min after resolved

      incident.resolvedAt = resolvedDate;
      incident.closedAt = state.name === 'Closed' ? closedDate : null;
      incident.resolutionCode = resolutionCode;
      incident.resolutionNotes = `Incident resolved via ${resolutionCode}. System functioning normally.`;
    }

    additionalIncidents.push(incident);
  }

  const incidentsData = [
    {
      sysId: 'sys_inc_0010234',
      number: 'INC0010234',
      shortDescription: 'Email service outage affecting all users',
      description: 'Microsoft Exchange server unresponsive. Impact: 500+ users unable to send/receive emails.',
      state: 'Resolved',
      stateValue: 6,
      priority: '1 - Critical',
      priorityValue: 1,
      urgency: '1 - High',
      urgencyValue: 1,
      impact: '1 - High',
      impactValue: 1,
      category: 'Infrastructure',
      subcategory: 'Email',
      assignedTo: 'user_sn_001',
      assignedToName: 'John Smith',
      assignmentGroup: 'group_infra_001',
      assignmentGroupName: 'Infrastructure Team',
      caller: 'user_sn_caller_001',
      callerName: 'Jane Doe',
      openedAt: new Date('2026-01-18 07:15:00'),
      resolvedAt: new Date('2026-01-18 10:30:00'),
      closedAt: new Date('2026-01-18 11:00:00'),
      resolutionCode: 'Service Restored',
      resolutionNotes: 'Exchange server restarted. Root cause: memory leak.',
      sysCreatedOn: new Date('2026-01-18 07:15:00'),
      sysUpdatedOn: new Date('2026-01-18 11:00:00'),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_001',
    },
    {
      sysId: 'sys_inc_0010567',
      number: 'INC0010567',
      shortDescription: 'CRM system slow performance',
      description: 'Salesforce integration experiencing 5-10 second delays.',
      state: 'Resolved',
      stateValue: 6,
      priority: '2 - High',
      priorityValue: 2,
      urgency: '2 - Medium',
      urgencyValue: 2,
      impact: '2 - Medium',
      impactValue: 2,
      category: 'Application',
      subcategory: 'CRM',
      assignedTo: 'user_sn_002',
      assignedToName: 'Jane Doe',
      assignmentGroup: 'group_app_001',
      assignmentGroupName: 'Application Support',
      caller: 'user_sn_caller_002',
      callerName: 'Mike Wilson',
      openedAt: new Date('2026-01-25 13:45:00'),
      resolvedAt: new Date('2026-01-25 16:20:00'),
      closedAt: new Date('2026-01-25 16:45:00'),
      resolutionCode: 'Configuration Change',
      resolutionNotes: 'API rate limit increased with Salesforce.',
      sysCreatedOn: new Date('2026-01-25 13:45:00'),
      sysUpdatedOn: new Date('2026-01-25 16:45:00'),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_002',
    },
    {
      sysId: 'sys_inc_0010789',
      number: 'INC0010789',
      shortDescription: 'Production database connection failures',
      description: 'Application servers unable to connect to production database.',
      state: 'In Progress',
      stateValue: 2,
      priority: '1 - Critical',
      priorityValue: 1,
      urgency: '1 - High',
      urgencyValue: 1,
      impact: '1 - High',
      impactValue: 1,
      category: 'Infrastructure',
      subcategory: 'Database',
      assignedTo: 'user_sn_003',
      assignedToName: 'Mike Wilson',
      assignmentGroup: 'group_db_001',
      assignmentGroupName: 'Database Team',
      caller: 'user_sn_caller_003',
      callerName: 'Sarah Johnson',
      openedAt: new Date('2026-02-01 14:30:00'),
      sysCreatedOn: new Date('2026-02-01 14:30:00'),
      sysUpdatedOn: new Date(),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_003',
    },
    {
      sysId: 'sys_inc_0010891',
      number: 'INC0010891',
      shortDescription: 'VPN connectivity issues for remote workers',
      description: 'Multiple remote employees unable to connect to corporate VPN.',
      state: 'Resolved',
      stateValue: 6,
      priority: '3 - Moderate',
      priorityValue: 3,
      urgency: '2 - Medium',
      urgencyValue: 2,
      impact: '2 - Medium',
      impactValue: 2,
      category: 'Network',
      subcategory: 'VPN',
      assignedTo: 'user_sn_004',
      assignedToName: 'Sarah Johnson',
      assignmentGroup: 'group_network_001',
      assignmentGroupName: 'Network Operations',
      caller: 'user_sn_caller_004',
      callerName: 'Tom Brown',
      openedAt: new Date('2026-01-29 08:00:00'),
      resolvedAt: new Date('2026-01-29 09:45:00'),
      closedAt: new Date('2026-01-29 10:00:00'),
      resolutionCode: 'Software Update',
      resolutionNotes: 'VPN concentrator firmware updated.',
      sysCreatedOn: new Date('2026-01-29 08:00:00'),
      sysUpdatedOn: new Date('2026-01-29 10:00:00'),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_004',
    },
    {
      sysId: 'sys_inc_0010923',
      number: 'INC0010923',
      shortDescription: 'Printer queue stuck preventing document printing',
      description: 'HR department printers not responding. Print queue shows jobs pending but not processing.',
      state: 'Resolved',
      stateValue: 6,
      priority: '4 - Low',
      priorityValue: 4,
      urgency: '3 - Low',
      urgencyValue: 3,
      impact: '3 - Low',
      impactValue: 3,
      category: 'Hardware',
      subcategory: 'Printer',
      assignedTo: 'user_sn_005',
      assignedToName: 'David Lee',
      assignmentGroup: 'group_desktop_001',
      assignmentGroupName: 'Desktop Support',
      caller: 'user_sn_caller_005',
      callerName: 'Lisa Chen',
      openedAt: new Date('2026-02-01 10:30:00'),
      resolvedAt: new Date('2026-02-01 11:15:00'),
      closedAt: new Date('2026-02-01 11:30:00'),
      resolutionCode: 'Service Restart',
      resolutionNotes: 'Print spooler service restarted. Queue cleared.',
      sysCreatedOn: new Date('2026-02-01 10:30:00'),
      sysUpdatedOn: new Date('2026-02-01 11:30:00'),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_005',
    },
    {
      sysId: 'sys_inc_0010945',
      number: 'INC0010945',
      shortDescription: 'Mobile app crashes on Android 14',
      description: 'Users on Android 14 reporting app crashes immediately after login.',
      state: 'In Progress',
      stateValue: 2,
      priority: '2 - High',
      priorityValue: 2,
      urgency: '2 - Medium',
      urgencyValue: 2,
      impact: '2 - Medium',
      impactValue: 2,
      category: 'Application',
      subcategory: 'Mobile App',
      assignedTo: 'user_sn_002',
      assignedToName: 'Jane Doe',
      assignmentGroup: 'group_app_001',
      assignmentGroupName: 'Application Support',
      caller: 'user_sn_caller_006',
      callerName: 'Robert Green',
      openedAt: new Date('2026-02-03 13:00:00'),
      sysCreatedOn: new Date('2026-02-03 13:00:00'),
      sysUpdatedOn: new Date(),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_002',
    },
    {
      sysId: 'sys_inc_0010956',
      number: 'INC0010956',
      shortDescription: 'File share permissions incorrect for Finance team',
      description: 'Finance team members unable to access quarterly reports folder. Permission denied errors.',
      state: 'Resolved',
      stateValue: 6,
      priority: '3 - Moderate',
      priorityValue: 3,
      urgency: '2 - Medium',
      urgencyValue: 2,
      impact: '2 - Medium',
      impactValue: 2,
      category: 'Infrastructure',
      subcategory: 'File Server',
      assignedTo: 'user_sn_001',
      assignedToName: 'John Smith',
      assignmentGroup: 'group_infra_001',
      assignmentGroupName: 'Infrastructure Team',
      caller: 'user_sn_caller_007',
      callerName: 'Emily White',
      openedAt: new Date('2026-02-02 08:45:00'),
      resolvedAt: new Date('2026-02-02 09:30:00'),
      closedAt: new Date('2026-02-02 09:45:00'),
      resolutionCode: 'Configuration Change',
      resolutionNotes: 'Active Directory group permissions updated.',
      sysCreatedOn: new Date('2026-02-02 08:45:00'),
      sysUpdatedOn: new Date('2026-02-02 09:45:00'),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_001',
    },
    {
      sysId: 'sys_inc_0010967',
      number: 'INC0010967',
      shortDescription: 'Backup job failing for production database',
      description: 'Nightly backup job for main production database failing for past 3 days. Disk space issue suspected.',
      state: 'In Progress',
      stateValue: 2,
      priority: '2 - High',
      priorityValue: 2,
      urgency: '1 - High',
      urgencyValue: 1,
      impact: '1 - High',
      impactValue: 1,
      category: 'Infrastructure',
      subcategory: 'Backup',
      assignedTo: 'user_sn_003',
      assignedToName: 'Mike Wilson',
      assignmentGroup: 'group_db_001',
      assignmentGroupName: 'Database Team',
      caller: 'user_sn_caller_008',
      callerName: 'System Monitor',
      openedAt: new Date('2026-02-03 01:00:00'),
      sysCreatedOn: new Date('2026-02-03 01:00:00'),
      sysUpdatedOn: new Date(),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_003',
    },
    {
      sysId: 'sys_inc_0010978',
      number: 'INC0010978',
      shortDescription: 'Office WiFi intermittent disconnections',
      description: 'Multiple employees reporting frequent WiFi disconnections in Building A, 3rd floor.',
      state: 'Resolved',
      stateValue: 6,
      priority: '3 - Moderate',
      priorityValue: 3,
      urgency: '2 - Medium',
      urgencyValue: 2,
      impact: '2 - Medium',
      impactValue: 2,
      category: 'Network',
      subcategory: 'Wireless',
      assignedTo: 'user_sn_004',
      assignedToName: 'Sarah Johnson',
      assignmentGroup: 'group_network_001',
      assignmentGroupName: 'Network Operations',
      caller: 'user_sn_caller_009',
      callerName: 'Mark Davis',
      openedAt: new Date('2026-01-31 14:00:00'),
      resolvedAt: new Date('2026-01-31 16:20:00'),
      closedAt: new Date('2026-01-31 16:30:00'),
      resolutionCode: 'Hardware Replacement',
      resolutionNotes: 'Faulty access point replaced.',
      sysCreatedOn: new Date('2026-01-31 14:00:00'),
      sysUpdatedOn: new Date('2026-01-31 16:30:00'),
      sysCreatedBy: 'system',
      sysUpdatedBy: 'user_sn_004',
    },
  ];

  // Combine original incidents with generated ones
  // Convert refined incidents to database format
  const refinedIncidentsData = refinedServiceNowIncidents.map(incident => ({
    serviceNowConnectionId: serviceNowConnection!.id,
    number: incident.number,
    sysId: `sys_${incident.number}`,
    shortDescription: incident.shortDescription,
    description: incident.description,
    state: incident.incidentState,
    priority: incident.priority,
    urgency: incident.urgency,
    impact: incident.impact,
    category: incident.category,
    subcategory: incident.subcategory,
    assignmentGroup: incident.assignmentGroup,
    assignedTo: incident.assignedTo,
    caller: incident.caller,
    openedAt: new Date(incident.opened),
    updatedAt: new Date(incident.updated),
    resolvedAt: incident.resolved ? new Date(incident.resolved) : null,
    closedAt: incident.closed ? new Date(incident.closed) : null,
    resolutionCode: incident.resolutionCode,
    resolutionNotes: incident.resolutionNotes,
    closeNotes: incident.closeNotes,
    workNotes: incident.workNotes,
    escalation: incident.escalation,
    reopenCount: incident.reopenCount,
    businessService: incident.businessService,
  }));

  const allIncidents = [...refinedIncidentsData, ...incidentsData, ...additionalIncidents];

  for (const incidentData of allIncidents) {
    const existingIncident = await serviceNowIncidentRepo.findOne({
      where: { sysId: incidentData.sysId },
    });

    if (!existingIncident) {
      const incident = serviceNowIncidentRepo.create({
        ...incidentData,
        connectionId: serviceNowConnection.id,
        tenantId,
      });
      await serviceNowIncidentRepo.save(incident);
      console.log(`✓ Created ServiceNow incident: ${incidentData.number}`);
    } else {
      console.log(`✓ ServiceNow incident already exists: ${incidentData.number}`);
    }
  }

  console.log('✅ ServiceNow data seeded successfully!\n');
}
