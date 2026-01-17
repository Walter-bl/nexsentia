import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenantsTable1768650243589 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`tenants\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deletedAt\` datetime(6) NULL,
                \`name\` varchar(255) NOT NULL,
                \`slug\` varchar(255) NOT NULL,
                \`contactEmail\` varchar(255) NOT NULL,
                \`isActive\` tinyint NOT NULL DEFAULT 1,
                \`settings\` json NULL,
                \`subscriptionTier\` enum('free', 'starter', 'professional', 'enterprise') NOT NULL DEFAULT 'free',
                \`subscriptionExpiresAt\` timestamp NULL,
                UNIQUE INDEX \`IDX_tenants_name\` (\`name\`),
                UNIQUE INDEX \`IDX_tenants_slug\` (\`slug\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`tenants\``);
    }

}
