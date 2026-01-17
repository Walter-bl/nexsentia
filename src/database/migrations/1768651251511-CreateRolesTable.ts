import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRolesTable1768651251511 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`roles\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deletedAt\` datetime(6) NULL,
                \`name\` varchar(255) NOT NULL,
                \`code\` varchar(255) NOT NULL,
                \`description\` varchar(500) NULL,
                \`isActive\` tinyint NOT NULL DEFAULT 1,
                \`isSystemRole\` tinyint NOT NULL DEFAULT 0,
                UNIQUE INDEX \`IDX_roles_name\` (\`name\`),
                UNIQUE INDEX \`IDX_roles_code\` (\`code\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`roles\``);
    }

}
