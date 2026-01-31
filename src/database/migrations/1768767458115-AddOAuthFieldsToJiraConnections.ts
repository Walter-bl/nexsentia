import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddOAuthFieldsToJiraConnections1768767458115 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add authType column
        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'authType',
            type: 'enum',
            enum: ['oauth', 'api_token'],
            default: "'api_token'",
        }));

        // Make existing auth fields nullable for OAuth connections
        await queryRunner.changeColumn('jira_connections', 'apiToken', new TableColumn({
            name: 'apiToken',
            type: 'text',
            isNullable: true,
        }));

        await queryRunner.changeColumn('jira_connections', 'userEmail', new TableColumn({
            name: 'userEmail',
            type: 'varchar',
            isNullable: true,
        }));

        // Add OAuth-specific fields
        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'oauthAccessToken',
            type: 'text',
            isNullable: true,
        }));

        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'oauthRefreshToken',
            type: 'text',
            isNullable: true,
        }));

        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'oauthTokenExpiresAt',
            type: 'timestamp',
            isNullable: true,
        }));

        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'oauthScope',
            type: 'varchar',
            isNullable: true,
        }));

        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'oauthMetadata',
            type: 'json',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove OAuth fields
        await queryRunner.dropColumn('jira_connections', 'oauthMetadata');
        await queryRunner.dropColumn('jira_connections', 'oauthScope');
        await queryRunner.dropColumn('jira_connections', 'oauthTokenExpiresAt');
        await queryRunner.dropColumn('jira_connections', 'oauthRefreshToken');
        await queryRunner.dropColumn('jira_connections', 'oauthAccessToken');

        // Revert apiToken and userEmail to non-nullable
        await queryRunner.changeColumn('jira_connections', 'userEmail', new TableColumn({
            name: 'userEmail',
            type: 'varchar',
            isNullable: false,
        }));

        await queryRunner.changeColumn('jira_connections', 'apiToken', new TableColumn({
            name: 'apiToken',
            type: 'text',
            isNullable: false,
        }));

        // Remove authType column
        await queryRunner.dropColumn('jira_connections', 'authType');
    }

}
