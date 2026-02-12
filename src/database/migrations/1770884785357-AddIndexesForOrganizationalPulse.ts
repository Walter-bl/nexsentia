import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesForOrganizationalPulse1770884785357 implements MigrationInterface {
    name = 'AddIndexesForOrganizationalPulse1770884785357';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Helper function to safely create index (check if exists first)
        const createIndexIfNotExists = async (indexName: string, tableName: string, columns: string) => {
            const result = await queryRunner.query(`
                SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = '${tableName}'
                AND INDEX_NAME = '${indexName}'
            `);

            if (result[0].count === 0) {
                await queryRunner.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`);
            }
        };

        // Jira Issues - index on tenantId + jiraCreatedAt for date range queries
        await createIndexIfNotExists(
            'IDX_jira_issues_tenant_created',
            'jira_issues',
            '`tenantId`, `jiraCreatedAt`'
        );

        // ServiceNow Incidents - index on tenantId + openedAt for date range queries
        await createIndexIfNotExists(
            'IDX_servicenow_incidents_tenant_opened',
            'servicenow_incidents',
            '`tenantId`, `openedAt`'
        );

        // Slack Messages - index on tenantId + slackCreatedAt for date range queries
        await createIndexIfNotExists(
            'IDX_slack_messages_tenant_created',
            'slack_messages',
            '`tenantId`, `slackCreatedAt`'
        );

        // Teams Messages - index on tenantId + createdDateTime for date range queries
        await createIndexIfNotExists(
            'IDX_teams_messages_tenant_created',
            'teams_messages',
            '`tenantId`, `createdDateTime`'
        );

        // Weak Signals - index on tenantId + category + detectedAt for filtered date range queries
        await createIndexIfNotExists(
            'IDX_weak_signals_tenant_category_detected',
            'weak_signals',
            '`tenantId`, `category`, `detectedAt`'
        );

        // Weak Signals - index on tenantId + detectedAt for date range queries without category filter
        await createIndexIfNotExists(
            'IDX_weak_signals_tenant_detected',
            'weak_signals',
            '`tenantId`, `detectedAt`'
        );

        // Business Impacts - index on tenantId + impactDate for date range queries
        await createIndexIfNotExists(
            'IDX_business_impacts_tenant_date',
            'business_impacts',
            '`tenantId`, `impactDate`'
        );

        // Metric Definitions - index on tenantId + category + isActive for filtered queries
        await createIndexIfNotExists(
            'IDX_metric_definitions_tenant_category_active',
            'metric_definitions',
            '`tenantId`, `category`, `isActive`'
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Helper function to safely drop index
        const dropIndexIfExists = async (indexName: string, tableName: string) => {
            const result = await queryRunner.query(`
                SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = '${tableName}'
                AND INDEX_NAME = '${indexName}'
            `);

            if (result[0].count > 0) {
                await queryRunner.query(`DROP INDEX \`${indexName}\` ON \`${tableName}\``);
            }
        };

        await dropIndexIfExists('IDX_jira_issues_tenant_created', 'jira_issues');
        await dropIndexIfExists('IDX_servicenow_incidents_tenant_opened', 'servicenow_incidents');
        await dropIndexIfExists('IDX_slack_messages_tenant_created', 'slack_messages');
        await dropIndexIfExists('IDX_teams_messages_tenant_created', 'teams_messages');
        await dropIndexIfExists('IDX_weak_signals_tenant_category_detected', 'weak_signals');
        await dropIndexIfExists('IDX_weak_signals_tenant_detected', 'weak_signals');
        await dropIndexIfExists('IDX_business_impacts_tenant_date', 'business_impacts');
        await dropIndexIfExists('IDX_metric_definitions_tenant_category_active', 'metric_definitions');
    }
}
