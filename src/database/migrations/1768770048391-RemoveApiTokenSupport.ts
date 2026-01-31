import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class RemoveApiTokenSupport1768770048391 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove authType enum column
        await queryRunner.dropColumn('jira_connections', 'authType');

        // Remove API token fields
        await queryRunner.dropColumn('jira_connections', 'apiToken');
        await queryRunner.dropColumn('jira_connections', 'userEmail');

        // Make OAuth fields non-nullable
        await queryRunner.changeColumn('jira_connections', 'oauthAccessToken', new TableColumn({
            name: 'oauthAccessToken',
            type: 'text',
            isNullable: false,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthRefreshToken', new TableColumn({
            name: 'oauthRefreshToken',
            type: 'text',
            isNullable: false,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthTokenExpiresAt', new TableColumn({
            name: 'oauthTokenExpiresAt',
            type: 'timestamp',
            isNullable: false,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthScope', new TableColumn({
            name: 'oauthScope',
            type: 'varchar',
            isNullable: false,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthMetadata', new TableColumn({
            name: 'oauthMetadata',
            type: 'json',
            isNullable: false,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Make OAuth fields nullable again
        await queryRunner.changeColumn('jira_connections', 'oauthMetadata', new TableColumn({
            name: 'oauthMetadata',
            type: 'json',
            isNullable: true,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthScope', new TableColumn({
            name: 'oauthScope',
            type: 'varchar',
            isNullable: true,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthTokenExpiresAt', new TableColumn({
            name: 'oauthTokenExpiresAt',
            type: 'timestamp',
            isNullable: true,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthRefreshToken', new TableColumn({
            name: 'oauthRefreshToken',
            type: 'text',
            isNullable: true,
        }));

        await queryRunner.changeColumn('jira_connections', 'oauthAccessToken', new TableColumn({
            name: 'oauthAccessToken',
            type: 'text',
            isNullable: true,
        }));

        // Add back API token fields
        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'userEmail',
            type: 'varchar',
            isNullable: true,
        }));

        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'apiToken',
            type: 'text',
            isNullable: true,
        }));

        // Add back authType column
        await queryRunner.addColumn('jira_connections', new TableColumn({
            name: 'authType',
            type: 'enum',
            enum: ['oauth', 'api_token'],
            default: "'api_token'",
        }));
    }

}
