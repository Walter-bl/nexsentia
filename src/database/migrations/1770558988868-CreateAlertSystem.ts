import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateAlertSystem1770558988868 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create alert_rules table
        await queryRunner.createTable(
            new Table({
                name: 'alert_rules',
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
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'ruleType',
                        type: 'enum',
                        enum: ['threshold', 'topic', 'pattern', 'anomaly'],
                    },
                    {
                        name: 'sourceType',
                        type: 'enum',
                        enum: ['weak_signal', 'metric', 'incident', 'action_item', 'timeline_event'],
                    },
                    {
                        name: 'thresholdConfig',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'topicConfig',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'patternConfig',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'anomalyConfig',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'alertSeverity',
                        type: 'enum',
                        enum: ['critical', 'high', 'medium', 'low'],
                        default: "'medium'",
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'deliveryChannels',
                        type: 'json',
                    },
                    {
                        name: 'cooldownMinutes',
                        type: 'int',
                        default: 60,
                    },
                    {
                        name: 'createdBy',
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
                    {
                        name: 'metadata',
                        type: 'json',
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        // Create indexes for alert_rules
        await queryRunner.createIndex(
            'alert_rules',
            new TableIndex({
                name: 'IDX_alert_rules_tenant_active',
                columnNames: ['tenantId', 'isActive'],
            }),
        );

        // Create foreign key for alert_rules.tenantId
        await queryRunner.createForeignKey(
            'alert_rules',
            new TableForeignKey({
                columnNames: ['tenantId'],
                referencedTableName: 'tenants',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create foreign key for alert_rules.createdBy
        await queryRunner.createForeignKey(
            'alert_rules',
            new TableForeignKey({
                columnNames: ['createdBy'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }),
        );

        // Create alert_subscriptions table
        await queryRunner.createTable(
            new Table({
                name: 'alert_subscriptions',
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
                        name: 'userId',
                        type: 'int',
                    },
                    {
                        name: 'ruleId',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'channels',
                        type: 'json',
                    },
                    {
                        name: 'preferences',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
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
                        name: 'metadata',
                        type: 'json',
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        // Create indexes for alert_subscriptions
        await queryRunner.createIndex(
            'alert_subscriptions',
            new TableIndex({
                name: 'IDX_alert_subscriptions_tenant_user_active',
                columnNames: ['tenantId', 'userId', 'isActive'],
            }),
        );

        await queryRunner.createIndex(
            'alert_subscriptions',
            new TableIndex({
                name: 'IDX_alert_subscriptions_rule_active',
                columnNames: ['ruleId', 'isActive'],
            }),
        );

        // Create foreign keys for alert_subscriptions
        await queryRunner.createForeignKey(
            'alert_subscriptions',
            new TableForeignKey({
                columnNames: ['tenantId'],
                referencedTableName: 'tenants',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'alert_subscriptions',
            new TableForeignKey({
                columnNames: ['userId'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'alert_subscriptions',
            new TableForeignKey({
                columnNames: ['ruleId'],
                referencedTableName: 'alert_rules',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create alert_history table
        await queryRunner.createTable(
            new Table({
                name: 'alert_history',
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
                        name: 'ruleId',
                        type: 'int',
                    },
                    {
                        name: 'userId',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                        length: '500',
                    },
                    {
                        name: 'message',
                        type: 'text',
                    },
                    {
                        name: 'severity',
                        type: 'enum',
                        enum: ['critical', 'high', 'medium', 'low'],
                    },
                    {
                        name: 'sourceType',
                        type: 'varchar',
                        length: '100',
                    },
                    {
                        name: 'sourceId',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'sourceData',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'deliveryChannels',
                        type: 'json',
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['pending', 'sent', 'failed', 'suppressed'],
                    },
                    {
                        name: 'deliveryStatus',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'suppressedUntil',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'suppressionReason',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'sentAt',
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

        // Create indexes for alert_history
        await queryRunner.createIndex(
            'alert_history',
            new TableIndex({
                name: 'IDX_alert_history_tenant_created',
                columnNames: ['tenantId', 'createdAt'],
            }),
        );

        await queryRunner.createIndex(
            'alert_history',
            new TableIndex({
                name: 'IDX_alert_history_rule_created',
                columnNames: ['ruleId', 'createdAt'],
            }),
        );

        await queryRunner.createIndex(
            'alert_history',
            new TableIndex({
                name: 'IDX_alert_history_user_status',
                columnNames: ['userId', 'status'],
            }),
        );

        // Create foreign keys for alert_history
        await queryRunner.createForeignKey(
            'alert_history',
            new TableForeignKey({
                columnNames: ['tenantId'],
                referencedTableName: 'tenants',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'alert_history',
            new TableForeignKey({
                columnNames: ['ruleId'],
                referencedTableName: 'alert_rules',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'alert_history',
            new TableForeignKey({
                columnNames: ['userId'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop alert_history table
        await queryRunner.dropTable('alert_history', true);

        // Drop alert_subscriptions table
        await queryRunner.dropTable('alert_subscriptions', true);

        // Drop alert_rules table
        await queryRunner.dropTable('alert_rules', true);
    }

}
