import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTeamsTables1769067865296 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teams_connections table
    await queryRunner.createTable(
      new Table({
        name: 'teams_connections',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tenantIdMs',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'accessToken',
            type: 'text',
          },
          {
            name: 'refreshToken',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tokenExpiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'teamId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'teamName',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'oauthMetadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'syncSettings',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'lastSyncAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastSuccessfulSyncAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastSyncError',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'syncStats',
            type: 'json',
            isNullable: true,
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
        ],
      }),
      true,
    );

    // Add foreign key for tenantId
    await queryRunner.createForeignKey(
      'teams_connections',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add indexes
    await queryRunner.createIndex(
      'teams_connections',
      new TableIndex({
        name: 'IDX_teams_connections_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_connections',
      new TableIndex({
        name: 'IDX_teams_connections_tenant_team',
        columnNames: ['tenantId', 'teamId'],
        isUnique: true,
      }),
    );

    // Create teams_channels table
    await queryRunner.createTable(
      new Table({
        name: 'teams_channels',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'connectionId',
            type: 'int',
          },
          {
            name: 'channelId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'teamId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'webUrl',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'membershipType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isArchived',
            type: 'boolean',
            default: false,
          },
          {
            name: 'lastMessageAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'messageCount',
            type: 'int',
            isNullable: true,
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
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'teams_channels',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'teams_channels',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'teams_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add indexes
    await queryRunner.createIndex(
      'teams_channels',
      new TableIndex({
        name: 'IDX_teams_channels_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_channels',
      new TableIndex({
        name: 'IDX_teams_channels_tenant_connection_channel',
        columnNames: ['tenantId', 'connectionId', 'channelId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'teams_channels',
      new TableIndex({
        name: 'IDX_teams_channels_channel_id',
        columnNames: ['channelId'],
      }),
    );

    // Create teams_users table
    await queryRunner.createTable(
      new Table({
        name: 'teams_users',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'connectionId',
            type: 'int',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'userPrincipalName',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'jobTitle',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'department',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'officeLocation',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'mobilePhone',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'businessPhones',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'profile',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'roles',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isGuest',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isDeleted',
            type: 'boolean',
            default: false,
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
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'teams_users',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'teams_users',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'teams_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add indexes
    await queryRunner.createIndex(
      'teams_users',
      new TableIndex({
        name: 'IDX_teams_users_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_users',
      new TableIndex({
        name: 'IDX_teams_users_tenant_connection_user',
        columnNames: ['tenantId', 'connectionId', 'userId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'teams_users',
      new TableIndex({
        name: 'IDX_teams_users_user_id',
        columnNames: ['userId'],
      }),
    );

    // Create teams_messages table
    await queryRunner.createTable(
      new Table({
        name: 'teams_messages',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'connectionId',
            type: 'int',
          },
          {
            name: 'channelId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'messageId',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'teamId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'teamsChannelId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'teamsUserId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'contentType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'subject',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'messageType',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'replyToId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'importance',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'webUrl',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reactions',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'mentions',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'attachments',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isDeleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdDateTime',
            type: 'timestamp',
          },
          {
            name: 'lastModifiedDateTime',
            type: 'timestamp',
            isNullable: true,
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
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'teams_messages',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'teams_messages',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'teams_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'teams_messages',
      new TableForeignKey({
        columnNames: ['channelId'],
        referencedTableName: 'teams_channels',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'teams_messages',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'teams_users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Add indexes
    await queryRunner.createIndex(
      'teams_messages',
      new TableIndex({
        name: 'IDX_teams_messages_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_messages',
      new TableIndex({
        name: 'IDX_teams_messages_tenant_channel',
        columnNames: ['tenantId', 'channelId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_messages',
      new TableIndex({
        name: 'IDX_teams_messages_message_id',
        columnNames: ['messageId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_messages',
      new TableIndex({
        name: 'IDX_teams_messages_user_id',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_messages',
      new TableIndex({
        name: 'IDX_teams_messages_reply_to',
        columnNames: ['replyToId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_messages',
      new TableIndex({
        name: 'IDX_teams_messages_created_date',
        columnNames: ['createdDateTime'],
      }),
    );

    // Create teams_sync_history table
    await queryRunner.createTable(
      new Table({
        name: 'teams_sync_history',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'connectionId',
            type: 'int',
          },
          {
            name: 'syncType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'stats',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'teamIds',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorDetails',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'duration',
            type: 'float',
            isNullable: true,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
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
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'teams_sync_history',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'teams_sync_history',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'teams_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add indexes
    await queryRunner.createIndex(
      'teams_sync_history',
      new TableIndex({
        name: 'IDX_teams_sync_history_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_sync_history',
      new TableIndex({
        name: 'IDX_teams_sync_history_connection',
        columnNames: ['connectionId'],
      }),
    );

    await queryRunner.createIndex(
      'teams_sync_history',
      new TableIndex({
        name: 'IDX_teams_sync_history_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'teams_sync_history',
      new TableIndex({
        name: 'IDX_teams_sync_history_started',
        columnNames: ['startedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.dropTable('teams_sync_history', true);
    await queryRunner.dropTable('teams_messages', true);
    await queryRunner.dropTable('teams_users', true);
    await queryRunner.dropTable('teams_channels', true);
    await queryRunner.dropTable('teams_connections', true);
  }
}
