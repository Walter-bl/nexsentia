import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateJiraTables1768742251796 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create jira_connections table
        await queryRunner.createTable(
            new Table({
                name: 'jira_connections',
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
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'updatedAt',
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                        onUpdate: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'deletedAt',
                        type: 'datetime',
                        precision: 6,
                        isNullable: true,
                    },
                    {
                        name: 'tenantId',
                        type: 'int',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                    },
                    {
                        name: 'jiraInstanceUrl',
                        type: 'varchar',
                    },
                    {
                        name: 'jiraCloudId',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'jiraType',
                        type: 'enum',
                        enum: ['cloud', 'server', 'datacenter'],
                        default: "'cloud'",
                    },
                    {
                        name: 'apiToken',
                        type: 'text',
                    },
                    {
                        name: 'userEmail',
                        type: 'varchar',
                    },
                    {
                        name: 'isActive',
                        type: 'tinyint',
                        default: 1,
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
                        name: 'totalIssuesSynced',
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

        await queryRunner.createIndex(
            'jira_connections',
            new TableIndex({
                columnNames: ['tenantId', 'isActive'],
            }),
        );

        // Create jira_projects table
        await queryRunner.createTable(
            new Table({
                name: 'jira_projects',
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
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'updatedAt',
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                        onUpdate: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'deletedAt',
                        type: 'datetime',
                        precision: 6,
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
                        name: 'jiraProjectId',
                        type: 'varchar',
                    },
                    {
                        name: 'jiraProjectKey',
                        type: 'varchar',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'projectTypeKey',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'avatarUrl',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'leadAccountId',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'leadDisplayName',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'isActive',
                        type: 'tinyint',
                        default: 1,
                    },
                    {
                        name: 'metadata',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'lastSyncedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'totalIssues',
                        type: 'int',
                        default: 0,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'jira_projects',
            new TableIndex({
                columnNames: ['tenantId', 'connectionId'],
            }),
        );

        await queryRunner.createIndex(
            'jira_projects',
            new TableIndex({
                columnNames: ['jiraProjectId'],
            }),
        );

        await queryRunner.createForeignKey(
            'jira_projects',
            new TableForeignKey({
                columnNames: ['connectionId'],
                referencedTableName: 'jira_connections',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create jira_issues table
        await queryRunner.createTable(
            new Table({
                name: 'jira_issues',
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
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'updatedAt',
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                        onUpdate: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'deletedAt',
                        type: 'datetime',
                        precision: 6,
                        isNullable: true,
                    },
                    {
                        name: 'tenantId',
                        type: 'int',
                    },
                    {
                        name: 'projectId',
                        type: 'int',
                    },
                    {
                        name: 'jiraIssueId',
                        type: 'varchar',
                        isUnique: true,
                    },
                    {
                        name: 'jiraIssueKey',
                        type: 'varchar',
                    },
                    {
                        name: 'summary',
                        type: 'text',
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'issueType',
                        type: 'varchar',
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                    },
                    {
                        name: 'priority',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'resolution',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'reporterAccountId',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'reporterDisplayName',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'reporterEmail',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'assigneeAccountId',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'assigneeDisplayName',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'assigneeEmail',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'labels',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'components',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'parentIssueKey',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'storyPoints',
                        type: 'float',
                        isNullable: true,
                    },
                    {
                        name: 'timeEstimate',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'timeSpent',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'dueDate',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'jiraCreatedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'jiraUpdatedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'resolvedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'customFields',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'comments',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'attachments',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'changelog',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'metadata',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'lastSyncedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'jira_issues',
            new TableIndex({
                columnNames: ['tenantId', 'projectId'],
            }),
        );

        await queryRunner.createIndex(
            'jira_issues',
            new TableIndex({
                columnNames: ['jiraIssueKey'],
            }),
        );

        await queryRunner.createIndex(
            'jira_issues',
            new TableIndex({
                columnNames: ['status'],
            }),
        );

        await queryRunner.createIndex(
            'jira_issues',
            new TableIndex({
                columnNames: ['priority'],
            }),
        );

        await queryRunner.createIndex(
            'jira_issues',
            new TableIndex({
                columnNames: ['issueType'],
            }),
        );

        await queryRunner.createIndex(
            'jira_issues',
            new TableIndex({
                columnNames: ['createdAt'],
            }),
        );

        await queryRunner.createIndex(
            'jira_issues',
            new TableIndex({
                columnNames: ['updatedAt'],
            }),
        );

        await queryRunner.createForeignKey(
            'jira_issues',
            new TableForeignKey({
                columnNames: ['projectId'],
                referencedTableName: 'jira_projects',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create jira_sync_history table
        await queryRunner.createTable(
            new Table({
                name: 'jira_sync_history',
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
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'updatedAt',
                        type: 'datetime',
                        precision: 6,
                        default: 'CURRENT_TIMESTAMP(6)',
                        onUpdate: 'CURRENT_TIMESTAMP(6)',
                    },
                    {
                        name: 'deletedAt',
                        type: 'datetime',
                        precision: 6,
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
                        type: 'enum',
                        enum: ['full', 'incremental', 'webhook'],
                        default: "'incremental'",
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
                        default: "'pending'",
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
                        name: 'projectsProcessed',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'issuesCreated',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'issuesUpdated',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'issuesFailed',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'totalIssuesProcessed',
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

        await queryRunner.createIndex(
            'jira_sync_history',
            new TableIndex({
                columnNames: ['tenantId', 'connectionId'],
            }),
        );

        await queryRunner.createIndex(
            'jira_sync_history',
            new TableIndex({
                columnNames: ['status'],
            }),
        );

        await queryRunner.createIndex(
            'jira_sync_history',
            new TableIndex({
                columnNames: ['syncType'],
            }),
        );

        await queryRunner.createIndex(
            'jira_sync_history',
            new TableIndex({
                columnNames: ['createdAt'],
            }),
        );

        await queryRunner.createForeignKey(
            'jira_sync_history',
            new TableForeignKey({
                columnNames: ['connectionId'],
                referencedTableName: 'jira_connections',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('jira_sync_history');
        await queryRunner.dropTable('jira_issues');
        await queryRunner.dropTable('jira_projects');
        await queryRunner.dropTable('jira_connections');
    }

}
