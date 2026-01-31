import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceNowConnection } from '../entities/servicenow-connection.entity';
import { ServiceNowIncident } from '../entities/servicenow-incident.entity';
import { ServiceNowChange } from '../entities/servicenow-change.entity';
import { ServiceNowUser } from '../entities/servicenow-user.entity';
import { ServiceNowSyncHistory } from '../entities/servicenow-sync-history.entity';
import { ServiceNowApiClientService, ServiceNowApiConfig } from './servicenow-api-client.service';
import { ServiceNowOAuthService } from './servicenow-oauth.service';

@Injectable()
export class ServiceNowIngestionService {
  private readonly logger = new Logger(ServiceNowIngestionService.name);
  private readonly activeSyncs = new Map<number, boolean>();
  private readonly defaultSyncInterval: number;

  constructor(
    @InjectRepository(ServiceNowConnection)
    private readonly connectionRepository: Repository<ServiceNowConnection>,
    @InjectRepository(ServiceNowIncident)
    private readonly incidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(ServiceNowChange)
    private readonly changeRepository: Repository<ServiceNowChange>,
    @InjectRepository(ServiceNowUser)
    private readonly userRepository: Repository<ServiceNowUser>,
    @InjectRepository(ServiceNowSyncHistory)
    private readonly syncHistoryRepository: Repository<ServiceNowSyncHistory>,
    private readonly apiClient: ServiceNowApiClientService,
    private readonly oauthService: ServiceNowOAuthService,
    private readonly configService: ConfigService,
  ) {
    this.defaultSyncInterval = this.configService.get<number>('SERVICENOW_SYNC_INTERVAL_MINUTES', 30);
    this.logger.log(`ServiceNow sync default interval: ${this.defaultSyncInterval} minutes`);
  }

  /**
   * Scheduled sync job for all active ServiceNow connections
   */
  @Cron(process.env.SERVICENOW_SYNC_CRON_SCHEDULE || '0 */30 * * * *')
  async handleScheduledSync() {
    this.logger.log('Starting scheduled sync for all active ServiceNow connections');

    const activeConnections = await this.connectionRepository.find({
      where: { isActive: true },
    });

    for (const connection of activeConnections) {
      const syncSettings = connection.syncSettings || {};
      const syncInterval = syncSettings.syncInterval || this.defaultSyncInterval;

      const lastSync = connection.lastSuccessfulSyncAt || connection.lastSyncAt;

      if (lastSync) {
        const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
        if (minutesSinceLastSync < syncInterval) {
          this.logger.debug(
            `Skipping connection ${connection.id} - last successful sync was ${minutesSinceLastSync.toFixed(1)} minutes ago`,
          );
          continue;
        }
      }

      if (this.activeSyncs.get(connection.id)) {
        this.logger.warn(`Sync already in progress for connection ${connection.id}`);
        continue;
      }

      this.syncConnection(connection.id, connection.tenantId).catch((error) => {
        this.logger.error(
          `Background sync failed for connection ${connection.id}: ${error.message}`,
        );
      });
    }
  }

  /**
   * Sync a single ServiceNow connection
   */
  async syncConnection(
    connectionId: number,
    tenantId: number,
    syncType: 'full' | 'incremental' = 'incremental',
  ): Promise<ServiceNowSyncHistory> {
    if (this.activeSyncs.get(connectionId)) {
      throw new Error(`Sync already in progress for connection ${connectionId}`);
    }

    this.activeSyncs.set(connectionId, true);
    const startTime = Date.now();

    const syncHistory = this.syncHistoryRepository.create({
      tenantId,
      connectionId,
      syncType,
      status: 'in_progress',
      startedAt: new Date(),
    });
    await this.syncHistoryRepository.save(syncHistory);

    try {
      this.logger.log(`Starting ${syncType} sync for connection ${connectionId}`);

      const connection = await this.connectionRepository.findOne({
        where: { id: connectionId, tenantId },
      });

      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      connection.lastSyncAt = new Date();
      await this.connectionRepository.save(connection);

      // Ensure valid access token
      const accessToken = await this.oauthService.ensureValidToken(connection);

      const apiConfig: ServiceNowApiConfig = {
        instanceUrl: connection.instanceUrl,
        accessToken,
      };

      const syncSettings = connection.syncSettings || {};
      const tablesToSync = syncSettings.syncTables || ['incident', 'change_request', 'user'];

      let incidentStats = { processed: 0, created: 0, updated: 0 };
      let changeStats = { processed: 0, created: 0, updated: 0 };
      let userStats = { processed: 0 };

      // Sync users first (needed for reference lookups)
      if (tablesToSync.includes('user')) {
        userStats.processed = await this.syncUsers(tenantId, connection, apiConfig);
      }

      // Sync incidents
      if (tablesToSync.includes('incident')) {
        incidentStats = await this.syncIncidents(tenantId, connection, apiConfig, syncType);
      }

      // Sync change requests
      if (tablesToSync.includes('change_request')) {
        changeStats = await this.syncChanges(tenantId, connection, apiConfig, syncType);
      }

      const duration = (Date.now() - startTime) / 1000;
      syncHistory.status = 'completed';
      syncHistory.completedAt = new Date();
      syncHistory.incidentsProcessed = incidentStats.processed;
      syncHistory.incidentsCreated = incidentStats.created;
      syncHistory.incidentsUpdated = incidentStats.updated;
      syncHistory.changesProcessed = changeStats.processed;
      syncHistory.changesCreated = changeStats.created;
      syncHistory.changesUpdated = changeStats.updated;
      syncHistory.usersProcessed = userStats.processed;
      syncHistory.syncStats = {
        duration,
        tables: tablesToSync,
      };

      await this.syncHistoryRepository.save(syncHistory);

      connection.lastSuccessfulSyncAt = new Date();
      connection.totalIncidentsSynced = incidentStats.processed;
      connection.totalChangesSynced = changeStats.processed;
      connection.failedSyncAttempts = 0;
      connection.lastSyncError = undefined;
      await this.connectionRepository.save(connection);

      this.logger.log(
        `✅ Sync completed for connection ${connectionId} in ${duration.toFixed(2)}s\n` +
          `   📊 Incidents: ${incidentStats.processed} processed | ${incidentStats.created} created | ${incidentStats.updated} updated\n` +
          `   📊 Changes: ${changeStats.processed} processed | ${changeStats.created} created | ${changeStats.updated} updated\n` +
          `   👥 Users: ${userStats.processed}`,
      );

      return syncHistory;
    } catch (error) {
      this.logger.error(`Sync failed for connection ${connectionId}: ${error.message}`, error.stack);

      syncHistory.status = 'failed';
      syncHistory.completedAt = new Date();
      syncHistory.errorMessage = error.message;
      syncHistory.errorDetails = {
        stack: error.stack,
        name: error.name,
      };
      await this.syncHistoryRepository.save(syncHistory);

      const connection = await this.connectionRepository.findOne({
        where: { id: connectionId },
      });
      if (connection) {
        connection.lastSyncError = error.message;
        connection.failedSyncAttempts += 1;
        await this.connectionRepository.save(connection);
      }

      throw error;
    } finally {
      this.activeSyncs.delete(connectionId);
    }
  }

  /**
   * Sync users from ServiceNow
   */
  private async syncUsers(
    tenantId: number,
    connection: ServiceNowConnection,
    apiConfig: ServiceNowApiConfig,
  ): Promise<number> {
    this.logger.debug(`Syncing users for connection ${connection.id}`);

    const response = await this.apiClient.getUsers(apiConfig, {
      activeOnly: true,
      limit: 5000,
    });

    let userCount = 0;

    for (const snUser of response.result || []) {
      let user = await this.userRepository.findOne({
        where: {
          tenantId,
          connectionId: connection.id,
          sysId: snUser.sys_id,
        },
      });

      const userData = {
        sysId: snUser.sys_id,
        userName: snUser.user_name,
        firstName: snUser.first_name,
        lastName: snUser.last_name,
        email: snUser.email,
        title: snUser.title,
        department: snUser.department?.display_value,
        manager: snUser.manager?.value,
        managerName: snUser.manager?.display_value,
        phone: snUser.phone,
        mobilePhone: snUser.mobile_phone,
        location: snUser.location?.display_value,
        company: snUser.company?.display_value,
        isActive: snUser.active === 'true' || snUser.active === true,
        isAdmin: false,
        sysCreatedOn: snUser.sys_created_on ? new Date(snUser.sys_created_on) : undefined,
        sysUpdatedOn: snUser.sys_updated_on ? new Date(snUser.sys_updated_on) : undefined,
        lastSyncedAt: new Date(),
      };

      if (user) {
        Object.assign(user, userData);
      } else {
        user = this.userRepository.create({
          tenantId,
          connectionId: connection.id,
          ...userData,
        });
      }

      await this.userRepository.save(user);
      userCount++;
    }

    this.logger.log(`Synced ${userCount} users for connection ${connection.id}`);
    return userCount;
  }

  /**
   * Sync incidents from ServiceNow
   */
  private async syncIncidents(
    tenantId: number,
    connection: ServiceNowConnection,
    apiConfig: ServiceNowApiConfig,
    syncType: 'full' | 'incremental',
  ): Promise<{ processed: number; created: number; updated: number }> {
    this.logger.debug(`Syncing incidents for connection ${connection.id}`);

    const options: any = {
      limit: 1000,
    };

    if (syncType === 'incremental' && connection.lastSuccessfulSyncAt) {
      options.updatedAfter = connection.lastSuccessfulSyncAt;
      this.logger.log(`Fetching incremental updates since ${connection.lastSuccessfulSyncAt.toISOString()}`);
    }

    const response = await this.apiClient.getIncidents(apiConfig, options);

    const stats = { processed: 0, created: 0, updated: 0 };

    for (const snIncident of response.result || []) {
      const existingIncident = await this.incidentRepository.findOne({
        where: { sysId: snIncident.sys_id },
      });

      const incidentData = {
        sysId: snIncident.sys_id,
        number: snIncident.number,
        shortDescription: snIncident.short_description,
        description: snIncident.description,
        state: snIncident.state?.display_value,
        stateValue: parseInt(snIncident.state?.value) || undefined,
        priority: snIncident.priority?.display_value,
        priorityValue: parseInt(snIncident.priority?.value) || undefined,
        impact: snIncident.impact?.display_value,
        impactValue: parseInt(snIncident.impact?.value) || undefined,
        urgency: snIncident.urgency?.display_value,
        urgencyValue: parseInt(snIncident.urgency?.value) || undefined,
        assignedTo: snIncident.assigned_to?.value,
        assignedToName: snIncident.assigned_to?.display_value,
        assignmentGroup: snIncident.assignment_group?.value,
        assignmentGroupName: snIncident.assignment_group?.display_value,
        caller: snIncident.caller_id?.value,
        callerName: snIncident.caller_id?.display_value,
        category: snIncident.category,
        subcategory: snIncident.subcategory,
        configurationItem: snIncident.cmdb_ci?.value,
        configurationItemName: snIncident.cmdb_ci?.display_value,
        openedAt: snIncident.opened_at ? new Date(snIncident.opened_at) : undefined,
        resolvedAt: snIncident.resolved_at ? new Date(snIncident.resolved_at) : undefined,
        closedAt: snIncident.closed_at ? new Date(snIncident.closed_at) : undefined,
        resolutionCode: snIncident.close_code,
        resolutionNotes: snIncident.resolution_notes,
        closeNotes: snIncident.close_notes,
        workNotes: snIncident.work_notes,
        comments: snIncident.comments,
        sysCreatedOn: snIncident.sys_created_on ? new Date(snIncident.sys_created_on) : undefined,
        sysUpdatedOn: snIncident.sys_updated_on ? new Date(snIncident.sys_updated_on) : undefined,
        sysCreatedBy: snIncident.sys_created_by,
        sysUpdatedBy: snIncident.sys_updated_by,
        lastSyncedAt: new Date(),
        metadata: {
          location: snIncident.location?.display_value,
          businessService: snIncident.business_service?.display_value,
          company: snIncident.company?.display_value,
          contactType: snIncident.contact_type,
          reopenCount: parseInt(snIncident.reopen_count) || 0,
        },
      };

      if (existingIncident) {
        Object.assign(existingIncident, incidentData);
        await this.incidentRepository.save(existingIncident);
        stats.updated++;
      } else {
        const incident = this.incidentRepository.create({
          tenantId,
          connectionId: connection.id,
          ...incidentData,
        });
        await this.incidentRepository.save(incident);
        stats.created++;
      }

      stats.processed++;
    }

    this.logger.log(
      `Synced ${stats.processed} incidents (${stats.created} created, ${stats.updated} updated)`,
    );
    return stats;
  }

  /**
   * Sync change requests from ServiceNow
   */
  private async syncChanges(
    tenantId: number,
    connection: ServiceNowConnection,
    apiConfig: ServiceNowApiConfig,
    syncType: 'full' | 'incremental',
  ): Promise<{ processed: number; created: number; updated: number }> {
    this.logger.debug(`Syncing change requests for connection ${connection.id}`);

    const options: any = {
      limit: 1000,
    };

    if (syncType === 'incremental' && connection.lastSuccessfulSyncAt) {
      options.updatedAfter = connection.lastSuccessfulSyncAt;
    }

    const response = await this.apiClient.getChangeRequests(apiConfig, options);

    const stats = { processed: 0, created: 0, updated: 0 };

    for (const snChange of response.result || []) {
      const existingChange = await this.changeRepository.findOne({
        where: { sysId: snChange.sys_id },
      });

      const changeData = {
        sysId: snChange.sys_id,
        number: snChange.number,
        shortDescription: snChange.short_description,
        description: snChange.description,
        state: snChange.state?.display_value,
        stateValue: parseInt(snChange.state?.value) || undefined,
        type: snChange.type?.display_value,
        risk: snChange.risk?.display_value,
        riskValue: parseInt(snChange.risk?.value) || undefined,
        impact: snChange.impact?.display_value,
        impactValue: parseInt(snChange.impact?.value) || undefined,
        assignedTo: snChange.assigned_to?.value,
        assignedToName: snChange.assigned_to?.display_value,
        assignmentGroup: snChange.assignment_group?.value,
        assignmentGroupName: snChange.assignment_group?.display_value,
        requestedBy: snChange.requested_by?.value,
        requestedByName: snChange.requested_by?.display_value,
        category: snChange.category,
        startDate: snChange.start_date ? new Date(snChange.start_date) : undefined,
        endDate: snChange.end_date ? new Date(snChange.end_date) : undefined,
        plannedStartDate: snChange.planned_start_date ? new Date(snChange.planned_start_date) : undefined,
        plannedEndDate: snChange.planned_end_date ? new Date(snChange.planned_end_date) : undefined,
        implementationPlan: snChange.implementation_plan,
        backoutPlan: snChange.backout_plan,
        testPlan: snChange.test_plan,
        justification: snChange.justification,
        workNotes: snChange.work_notes,
        closeNotes: snChange.close_notes,
        sysCreatedOn: snChange.sys_created_on ? new Date(snChange.sys_created_on) : undefined,
        sysUpdatedOn: snChange.sys_updated_on ? new Date(snChange.sys_updated_on) : undefined,
        sysCreatedBy: snChange.sys_created_by,
        sysUpdatedBy: snChange.sys_updated_by,
        lastSyncedAt: new Date(),
        metadata: {
          approvalStatus: snChange.approval,
          conflictStatus: snChange.conflict_status,
          cabRequired: snChange.cab_required === 'true' || snChange.cab_required === true,
          onHold: snChange.on_hold === 'true' || snChange.on_hold === true,
        },
      };

      if (existingChange) {
        Object.assign(existingChange, changeData);
        await this.changeRepository.save(existingChange);
        stats.updated++;
      } else {
        const change = this.changeRepository.create({
          tenantId,
          connectionId: connection.id,
          ...changeData,
        });
        await this.changeRepository.save(change);
        stats.created++;
      }

      stats.processed++;
    }

    this.logger.log(
      `Synced ${stats.processed} changes (${stats.created} created, ${stats.updated} updated)`,
    );
    return stats;
  }
}
