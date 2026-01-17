import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveRoleAndPermissionsFromUsers1768651285566 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove the old role and permissions columns from users table
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`role\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`permissions\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the old columns if migration is reverted
        await queryRunner.query(`
            ALTER TABLE \`users\`
            ADD COLUMN \`role\` enum('super_admin', 'admin', 'manager', 'analyst', 'contributor', 'viewer', 'guest') NOT NULL DEFAULT 'analyst'
        `);
        await queryRunner.query(`
            ALTER TABLE \`users\`
            ADD COLUMN \`permissions\` text NULL
        `);
    }

}
