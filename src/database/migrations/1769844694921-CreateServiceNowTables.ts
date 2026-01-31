import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateServiceNowTables1769844694921 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create servicenow_connections table
    await queryRunner.createTable(
      new Table({
        name: 'servicenow_connections',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          { name: 'tenantId', type: 'int' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'instanceUrl', type: 'varchar', length: '500' },
          { name: 'accessToken', type: 'text' },
          { name: 'refreshToken', type: 'text', isNullable: true },
          { name: 'tokenExpiresAt', type: 'timestamp', isNullable: true },
          { name: 'instanceId', type: 'varchar', length: '255', isNullable: true },
          { name: 'oauthMetadata', type: 'json', isNullable: true },
          { name: 'syncSettings', type: 'json', isNullable: true },
          { name: 'lastSyncAt', type: 'timestamp', isNullable: true },
          { name: 'lastSuccessfulSyncAt', type: 'timestamp', isNullable: true },
          { name: 'totalIncidentsSynced', type: 'int', default: 0 },
          { name: 'totalChangesSynced', type: 'int', default: 0 },
          { name: 'lastSyncError', type: 'text', isNullable: true },
          { name: 'failedSyncAttempts', type: 'int', default: 0 },
          { name: 'isActive', type: 'boolean', default: true },
        ],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_connections',
      new TableIndex({
        name: 'IDX_servicenow_connections_tenant_instance',
        columnNames: ['tenantId', 'instanceUrl'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_connections',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create servicenow_incidents table
    await queryRunner.createTable(
      new Table({
        name: 'servicenow_incidents',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          { name: 'tenantId', type: 'int' },
          { name: 'connectionId', type: 'int' },
          { name: 'sysId', type: 'varchar', length: '255', isUnique: true },
          { name: 'number', type: 'varchar', length: '100' },
          { name: 'shortDescription', type: 'text', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'state', type: 'varchar', length: '50', isNullable: true },
          { name: 'stateValue', type: 'int', isNullable: true },
          { name: 'priority', type: 'varchar', length: '50', isNullable: true },
          { name: 'priorityValue', type: 'int', isNullable: true },
          { name: 'impact', type: 'varchar', length: '50', isNullable: true },
          { name: 'impactValue', type: 'int', isNullable: true },
          { name: 'urgency', type: 'varchar', length: '50', isNullable: true },
          { name: 'urgencyValue', type: 'int', isNullable: true },
          { name: 'assignedTo', type: 'varchar', length: '255', isNullable: true },
          { name: 'assignedToName', type: 'varchar', length: '255', isNullable: true },
          { name: 'assignmentGroup', type: 'varchar', length: '255', isNullable: true },
          { name: 'assignmentGroupName', type: 'varchar', length: '255', isNullable: true },
          { name: 'caller', type: 'varchar', length: '255', isNullable: true },
          { name: 'callerName', type: 'varchar', length: '255', isNullable: true },
          { name: 'category', type: 'varchar', length: '255', isNullable: true },
          { name: 'subcategory', type: 'varchar', length: '255', isNullable: true },
          { name: 'configurationItem', type: 'varchar', length: '255', isNullable: true },
          { name: 'configurationItemName', type: 'varchar', length: '255', isNullable: true },
          { name: 'openedAt', type: 'timestamp', isNullable: true },
          { name: 'resolvedAt', type: 'timestamp', isNullable: true },
          { name: 'closedAt', type: 'timestamp', isNullable: true },
          { name: 'resolutionCode', type: 'text', isNullable: true },
          { name: 'resolutionNotes', type: 'text', isNullable: true },
          { name: 'closeNotes', type: 'text', isNullable: true },
          { name: 'workNotes', type: 'text', isNullable: true },
          { name: 'comments', type: 'text', isNullable: true },
          { name: 'sysCreatedOn', type: 'timestamp', isNullable: true },
          { name: 'sysUpdatedOn', type: 'timestamp', isNullable: true },
          { name: 'sysCreatedBy', type: 'varchar', length: '255', isNullable: true },
          { name: 'sysUpdatedBy', type: 'varchar', length: '255', isNullable: true },
          { name: 'lastSyncedAt', type: 'timestamp', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
        ],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_incidents',
      new TableIndex({
        name: 'IDX_servicenow_incidents_tenant_connection_sys',
        columnNames: ['tenantId', 'connectionId', 'sysId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'servicenow_incidents',
      new TableIndex({
        name: 'IDX_servicenow_incidents_tenant_number',
        columnNames: ['tenantId', 'number'],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_incidents',
      new TableIndex({
        name: 'IDX_servicenow_incidents_tenant_assigned',
        columnNames: ['tenantId', 'assignedTo'],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_incidents',
      new TableIndex({
        name: 'IDX_servicenow_incidents_tenant_state',
        columnNames: ['tenantId', 'state'],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_incidents',
      new TableIndex({
        name: 'IDX_servicenow_incidents_tenant_priority',
        columnNames: ['tenantId', 'priority'],
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_incidents',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_incidents',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'servicenow_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create servicenow_changes table
    await queryRunner.createTable(
      new Table({
        name: 'servicenow_changes',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          { name: 'tenantId', type: 'int' },
          { name: 'connectionId', type: 'int' },
          { name: 'sysId', type: 'varchar', length: '255', isUnique: true },
          { name: 'number', type: 'varchar', length: '100' },
          { name: 'shortDescription', type: 'text', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'state', type: 'varchar', length: '50', isNullable: true },
          { name: 'stateValue', type: 'int', isNullable: true },
          { name: 'type', type: 'varchar', length: '50', isNullable: true },
          { name: 'risk', type: 'varchar', length: '50', isNullable: true },
          { name: 'riskValue', type: 'int', isNullable: true },
          { name: 'impact', type: 'varchar', length: '50', isNullable: true },
          { name: 'impactValue', type: 'int', isNullable: true },
          { name: 'assignedTo', type: 'varchar', length: '255', isNullable: true },
          { name: 'assignedToName', type: 'varchar', length: '255', isNullable: true },
          { name: 'assignmentGroup', type: 'varchar', length: '255', isNullable: true },
          { name: 'assignmentGroupName', type: 'varchar', length: '255', isNullable: true },
          { name: 'requestedBy', type: 'varchar', length: '255', isNullable: true },
          { name: 'requestedByName', type: 'varchar', length: '255', isNullable: true },
          { name: 'category', type: 'varchar', length: '255', isNullable: true },
          { name: 'startDate', type: 'timestamp', isNullable: true },
          { name: 'endDate', type: 'timestamp', isNullable: true },
          { name: 'plannedStartDate', type: 'timestamp', isNullable: true },
          { name: 'plannedEndDate', type: 'timestamp', isNullable: true },
          { name: 'implementationPlan', type: 'text', isNullable: true },
          { name: 'backoutPlan', type: 'text', isNullable: true },
          { name: 'testPlan', type: 'text', isNullable: true },
          { name: 'justification', type: 'text', isNullable: true },
          { name: 'workNotes', type: 'text', isNullable: true },
          { name: 'closeNotes', type: 'text', isNullable: true },
          { name: 'sysCreatedOn', type: 'timestamp', isNullable: true },
          { name: 'sysUpdatedOn', type: 'timestamp', isNullable: true },
          { name: 'sysCreatedBy', type: 'varchar', length: '255', isNullable: true },
          { name: 'sysUpdatedBy', type: 'varchar', length: '255', isNullable: true },
          { name: 'lastSyncedAt', type: 'timestamp', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
        ],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_changes',
      new TableIndex({
        name: 'IDX_servicenow_changes_tenant_connection_sys',
        columnNames: ['tenantId', 'connectionId', 'sysId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'servicenow_changes',
      new TableIndex({
        name: 'IDX_servicenow_changes_tenant_number',
        columnNames: ['tenantId', 'number'],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_changes',
      new TableIndex({
        name: 'IDX_servicenow_changes_tenant_assigned',
        columnNames: ['tenantId', 'assignedTo'],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_changes',
      new TableIndex({
        name: 'IDX_servicenow_changes_tenant_state',
        columnNames: ['tenantId', 'state'],
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_changes',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_changes',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'servicenow_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create servicenow_users table
    await queryRunner.createTable(
      new Table({
        name: 'servicenow_users',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          { name: 'tenantId', type: 'int' },
          { name: 'connectionId', type: 'int' },
          { name: 'sysId', type: 'varchar', length: '255', isUnique: true },
          { name: 'userName', type: 'varchar', length: '255' },
          { name: 'firstName', type: 'varchar', length: '255', isNullable: true },
          { name: 'lastName', type: 'varchar', length: '255', isNullable: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'title', type: 'varchar', length: '255', isNullable: true },
          { name: 'department', type: 'varchar', length: '255', isNullable: true },
          { name: 'manager', type: 'varchar', length: '255', isNullable: true },
          { name: 'managerName', type: 'varchar', length: '255', isNullable: true },
          { name: 'phone', type: 'varchar', length: '50', isNullable: true },
          { name: 'mobilePhone', type: 'varchar', length: '50', isNullable: true },
          { name: 'location', type: 'varchar', length: '255', isNullable: true },
          { name: 'company', type: 'varchar', length: '255', isNullable: true },
          { name: 'isActive', type: 'boolean', default: false },
          { name: 'isAdmin', type: 'boolean', default: false },
          { name: 'sysCreatedOn', type: 'timestamp', isNullable: true },
          { name: 'sysUpdatedOn', type: 'timestamp', isNullable: true },
          { name: 'lastSyncedAt', type: 'timestamp', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
        ],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_users',
      new TableIndex({
        name: 'IDX_servicenow_users_tenant_connection_sys',
        columnNames: ['tenantId', 'connectionId', 'sysId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'servicenow_users',
      new TableIndex({
        name: 'IDX_servicenow_users_tenant_username',
        columnNames: ['tenantId', 'userName'],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_users',
      new TableIndex({
        name: 'IDX_servicenow_users_tenant_email',
        columnNames: ['tenantId', 'email'],
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_users',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_users',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'servicenow_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create servicenow_sync_history table
    await queryRunner.createTable(
      new Table({
        name: 'servicenow_sync_history',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          { name: 'tenantId', type: 'int' },
          { name: 'connectionId', type: 'int' },
          { name: 'syncType', type: 'varchar', length: '50' },
          { name: 'status', type: 'varchar', length: '50' },
          { name: 'startedAt', type: 'timestamp' },
          { name: 'completedAt', type: 'timestamp', isNullable: true },
          { name: 'incidentsProcessed', type: 'int', default: 0 },
          { name: 'incidentsCreated', type: 'int', default: 0 },
          { name: 'incidentsUpdated', type: 'int', default: 0 },
          { name: 'changesProcessed', type: 'int', default: 0 },
          { name: 'changesCreated', type: 'int', default: 0 },
          { name: 'changesUpdated', type: 'int', default: 0 },
          { name: 'usersProcessed', type: 'int', default: 0 },
          { name: 'errorMessage', type: 'text', isNullable: true },
          { name: 'errorDetails', type: 'json', isNullable: true },
          { name: 'syncStats', type: 'json', isNullable: true },
        ],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_sync_history',
      new TableIndex({
        name: 'IDX_servicenow_sync_history_tenant_connection',
        columnNames: ['tenantId', 'connectionId'],
      }),
    );

    await queryRunner.createIndex(
      'servicenow_sync_history',
      new TableIndex({
        name: 'IDX_servicenow_sync_history_tenant_status',
        columnNames: ['tenantId', 'status'],
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_sync_history',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'servicenow_sync_history',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'servicenow_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('servicenow_sync_history');
    await queryRunner.dropTable('servicenow_users');
    await queryRunner.dropTable('servicenow_changes');
    await queryRunner.dropTable('servicenow_incidents');
    await queryRunner.dropTable('servicenow_connections');
  }
}
