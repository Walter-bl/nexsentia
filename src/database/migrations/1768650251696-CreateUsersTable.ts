import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1768650251696 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`users\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deletedAt\` datetime(6) NULL,
                \`tenantId\` int NOT NULL,
                \`firstName\` varchar(255) NOT NULL,
                \`lastName\` varchar(255) NOT NULL,
                \`email\` varchar(255) NOT NULL,
                \`password\` varchar(255) NOT NULL,
                \`role\` enum('super_admin', 'admin', 'manager', 'analyst', 'contributor', 'viewer', 'guest') NOT NULL DEFAULT 'analyst',
                \`permissions\` text NULL,
                \`isActive\` tinyint NOT NULL DEFAULT 1,
                \`isEmailVerified\` tinyint NOT NULL DEFAULT 0,
                \`emailVerificationToken\` varchar(255) NULL,
                \`emailVerifiedAt\` timestamp NULL,
                \`passwordResetToken\` varchar(255) NULL,
                \`passwordResetExpiresAt\` timestamp NULL,
                \`lastLoginAt\` timestamp NULL,
                \`lastLoginIp\` varchar(255) NULL,
                \`preferences\` json NULL,
                \`profileImage\` varchar(500) NULL,
                INDEX \`IDX_users_email\` (\`email\`),
                UNIQUE INDEX \`IDX_users_email_tenantId\` (\`email\`, \`tenantId\`),
                PRIMARY KEY (\`id\`),
                CONSTRAINT \`FK_users_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}
