import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSlackTables1769060686347 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create slack_connections table
    await queryRunner.createTable(
      new Table({
        name: 'slack_connections',
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
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'teamId',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'teamName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'teamDomain',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'teamIcon',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'accessToken',
            type: 'text',
          },
          {
            name: 'tokenType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'scope',
            type: 'text',
          },
          {
            name: 'botUserId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'installingUserId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'oauthMetadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'syncSettings',
            type: 'json',
            isNullable: true,
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
            name: 'totalMessagesSynced',
            type: 'int',
            default: 0,
          },
          {
            name: 'failedSyncAttempts',
            type: 'int',
            default: 0,
          },
        ],
      }),
      true,
    );

    // Add foreign key to tenants
    await queryRunner.createForeignKey(
      'slack_connections',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create slack_channels table
    await queryRunner.createTable(
      new Table({
        name: 'slack_channels',
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
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'connectionId',
            type: 'int',
          },
          {
            name: 'slackChannelId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'topic',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'purpose',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isPrivate',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isArchived',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isGeneral',
            type: 'boolean',
            default: false,
          },
          {
            name: 'memberCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'creatorId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'slackCreatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastSyncedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'totalMessages',
            type: 'int',
            default: 0,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
        ],
      }),
      true,
    );

    // Add foreign keys and indexes for slack_channels
    await queryRunner.createForeignKey(
      'slack_channels',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'slack_channels',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'slack_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'slack_channels',
      new TableIndex({
        name: 'IDX_slack_channels_tenant_connection_channel',
        columnNames: ['tenantId', 'connectionId', 'slackChannelId'],
        isUnique: true,
      }),
    );

    // Create slack_users table
    await queryRunner.createTable(
      new Table({
        name: 'slack_users',
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
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'connectionId',
            type: 'int',
          },
          {
            name: 'slackUserId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'teamId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'realName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'avatarUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'statusText',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'statusEmoji',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'timezoneOffset',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'isBot',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isAdmin',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isOwner',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isPrimaryOwner',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isRestricted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isUltraRestricted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isDeleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'slackUpdatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastSyncedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add foreign keys and indexes for slack_users
    await queryRunner.createForeignKey(
      'slack_users',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'slack_users',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'slack_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'slack_users',
      new TableIndex({
        name: 'IDX_slack_users_tenant_connection_user',
        columnNames: ['tenantId', 'connectionId', 'slackUserId'],
        isUnique: true,
      }),
    );

    // Create slack_messages table
    await queryRunner.createTable(
      new Table({
        name: 'slack_messages',
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
          {
            name: 'tenantId',
            type: 'int',
          },
          {
            name: 'channelId',
            type: 'int',
          },
          {
            name: 'slackMessageTs',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'slackChannelId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'slackUserId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'text',
            type: 'text',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            default: "'message'",
          },
          {
            name: 'subtype',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'slackThreadTs',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'isThreadReply',
            type: 'boolean',
            default: false,
          },
          {
            name: 'replyCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'replyUsers',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'latestReplyAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'reactions',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'attachments',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'files',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isEdited',
            type: 'boolean',
            default: false,
          },
          {
            name: 'editedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isPinned',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isStarred',
            type: 'boolean',
            default: false,
          },
          {
            name: 'botId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'botUsername',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'slackCreatedAt',
            type: 'timestamp',
          },
          {
            name: 'lastSyncedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add foreign keys and indexes for slack_messages
    await queryRunner.createForeignKey(
      'slack_messages',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'slack_messages',
      new TableForeignKey({
        columnNames: ['channelId'],
        referencedTableName: 'slack_channels',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'slack_messages',
      new TableIndex({
        name: 'IDX_slack_messages_tenant_channel',
        columnNames: ['tenantId', 'channelId'],
      }),
    );

    await queryRunner.createIndex(
      'slack_messages',
      new TableIndex({
        name: 'IDX_slack_messages_ts',
        columnNames: ['slackMessageTs'],
      }),
    );

    await queryRunner.createIndex(
      'slack_messages',
      new TableIndex({
        name: 'IDX_slack_messages_user',
        columnNames: ['slackUserId'],
      }),
    );

    await queryRunner.createIndex(
      'slack_messages',
      new TableIndex({
        name: 'IDX_slack_messages_thread',
        columnNames: ['slackThreadTs'],
      }),
    );

    // Create slack_sync_history table
    await queryRunner.createTable(
      new Table({
        name: 'slack_sync_history',
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
            name: 'startedAt',
            type: 'timestamp',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'channelsProcessed',
            type: 'int',
            default: 0,
          },
          {
            name: 'messagesCreated',
            type: 'int',
            default: 0,
          },
          {
            name: 'messagesUpdated',
            type: 'int',
            default: 0,
          },
          {
            name: 'messagesFailed',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalMessagesProcessed',
            type: 'int',
            default: 0,
          },
          {
            name: 'usersProcessed',
            type: 'int',
            default: 0,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorDetails',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'syncStats',
            type: 'json',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add foreign keys and indexes for slack_sync_history
    await queryRunner.createForeignKey(
      'slack_sync_history',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'slack_sync_history',
      new TableForeignKey({
        columnNames: ['connectionId'],
        referencedTableName: 'slack_connections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'slack_sync_history',
      new TableIndex({
        name: 'IDX_slack_sync_history_tenant_connection',
        columnNames: ['tenantId', 'connectionId'],
      }),
    );

    await queryRunner.createIndex(
      'slack_sync_history',
      new TableIndex({
        name: 'IDX_slack_sync_history_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'slack_sync_history',
      new TableIndex({
        name: 'IDX_slack_sync_history_started',
        columnNames: ['startedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (children first)
    await queryRunner.dropTable('slack_sync_history');
    await queryRunner.dropTable('slack_messages');
    await queryRunner.dropTable('slack_users');
    await queryRunner.dropTable('slack_channels');
    await queryRunner.dropTable('slack_connections');
  }
}
