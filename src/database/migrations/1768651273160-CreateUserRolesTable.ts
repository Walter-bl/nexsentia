import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserRolesTable1768651273160 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`user_roles\` (
                \`userId\` int NOT NULL,
                \`roleId\` int NOT NULL,
                INDEX \`IDX_user_roles_userId\` (\`userId\`),
                INDEX \`IDX_user_roles_roleId\` (\`roleId\`),
                PRIMARY KEY (\`userId\`, \`roleId\`),
                CONSTRAINT \`FK_user_roles_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT \`FK_user_roles_roleId\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`user_roles\``);
    }

}
