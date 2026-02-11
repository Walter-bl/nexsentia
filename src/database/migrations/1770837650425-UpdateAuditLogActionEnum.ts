import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAuditLogActionEnum1770837650425 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update the action column to use VARCHAR instead of ENUM for flexibility
        // This allows any action value without needing to modify the schema
        await queryRunner.query(`
            ALTER TABLE \`audit_logs\`
            MODIFY COLUMN \`action\` VARCHAR(50) NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert to original ENUM (this will fail if there are values not in the enum)
        await queryRunner.query(`
            ALTER TABLE \`audit_logs\`
            MODIFY COLUMN \`action\` ENUM('create', 'read', 'update', 'delete', 'login', 'logout', 'failed_login', 'password_reset', 'email_verified', 'permission_changed', 'export', 'import', 'api_call') NOT NULL
        `);
    }

}
