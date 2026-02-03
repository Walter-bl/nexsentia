import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUniqueConstraintsFromTenants1770116769957 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check and drop unique index on name column if it exists
        const nameIndexExists = await queryRunner.query(`
            SELECT COUNT(*) as count
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
            AND table_name = 'tenants'
            AND index_name = 'IDX_tenants_name'
        `);

        if (nameIndexExists[0].count > 0) {
            await queryRunner.query(`DROP INDEX \`IDX_tenants_name\` ON \`tenants\``);
        }

        // Check and drop unique index on slug column if it exists
        const slugIndexExists = await queryRunner.query(`
            SELECT COUNT(*) as count
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
            AND table_name = 'tenants'
            AND index_name = 'IDX_tenants_slug'
        `);

        if (slugIndexExists[0].count > 0) {
            await queryRunner.query(`DROP INDEX \`IDX_tenants_slug\` ON \`tenants\``);
        }

        // Recreate non-unique indexes for performance
        await queryRunner.query(`CREATE INDEX \`IDX_tenants_name\` ON \`tenants\` (\`name\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_tenants_slug\` ON \`tenants\` (\`slug\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop non-unique indexes
        await queryRunner.query(`DROP INDEX \`IDX_tenants_slug\` ON \`tenants\``);
        await queryRunner.query(`DROP INDEX \`IDX_tenants_name\` ON \`tenants\``);

        // Recreate unique indexes
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_tenants_slug\` ON \`tenants\` (\`slug\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_tenants_name\` ON \`tenants\` (\`name\`)`);
    }

}
