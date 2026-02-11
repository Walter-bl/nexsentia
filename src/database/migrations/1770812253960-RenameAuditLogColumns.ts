import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameAuditLogColumns1770812253960 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rename 'method' column to 'httpMethod'
        await queryRunner.query(`
            ALTER TABLE \`audit_logs\`
            CHANGE COLUMN \`method\` \`httpMethod\` varchar(10) NULL
        `);

        // Rename 'path' column to 'requestPath'
        await queryRunner.query(`
            ALTER TABLE \`audit_logs\`
            CHANGE COLUMN \`path\` \`requestPath\` varchar(500) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: rename 'httpMethod' back to 'method'
        await queryRunner.query(`
            ALTER TABLE \`audit_logs\`
            CHANGE COLUMN \`httpMethod\` \`method\` varchar(10) NULL
        `);

        // Revert: rename 'requestPath' back to 'path'
        await queryRunner.query(`
            ALTER TABLE \`audit_logs\`
            CHANGE COLUMN \`requestPath\` \`path\` varchar(500) NULL
        `);
    }

}
