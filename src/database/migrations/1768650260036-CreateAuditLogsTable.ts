import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditLogsTable1768650260036 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`audit_logs\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deletedAt\` datetime(6) NULL,
                \`tenantId\` int NOT NULL,
                \`userId\` int NULL,
                \`action\` enum('create', 'read', 'update', 'delete', 'login', 'logout', 'failed_login', 'password_reset', 'email_verified', 'permission_changed', 'export', 'import', 'api_call') NOT NULL,
                \`resource\` varchar(255) NOT NULL,
                \`resourceId\` int NULL,
                \`metadata\` json NULL,
                \`changes\` json NULL,
                \`ipAddress\` varchar(255) NULL,
                \`userAgent\` text NULL,
                \`method\` varchar(10) NULL,
                \`path\` varchar(500) NULL,
                \`statusCode\` int NULL,
                \`errorMessage\` text NULL,
                INDEX \`IDX_audit_logs_tenantId\` (\`tenantId\`),
                INDEX \`IDX_audit_logs_userId\` (\`userId\`),
                INDEX \`IDX_audit_logs_action\` (\`action\`),
                INDEX \`IDX_audit_logs_resource\` (\`resource\`),
                INDEX \`IDX_audit_logs_createdAt\` (\`createdAt\`),
                PRIMARY KEY (\`id\`),
                CONSTRAINT \`FK_audit_logs_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT \`FK_audit_logs_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`audit_logs\``);
    }

}
