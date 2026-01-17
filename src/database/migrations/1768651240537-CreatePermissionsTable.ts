import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePermissionsTable1768651240537 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`permissions\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deletedAt\` datetime(6) NULL,
                \`name\` varchar(255) NOT NULL,
                \`code\` varchar(255) NOT NULL,
                \`description\` varchar(500) NULL,
                \`category\` varchar(100) NULL,
                \`isActive\` tinyint NOT NULL DEFAULT 1,
                UNIQUE INDEX \`IDX_permissions_name\` (\`name\`),
                UNIQUE INDEX \`IDX_permissions_code\` (\`code\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`permissions\``);
    }

}
