import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRolePermissionsTable1768651262487 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`role_permissions\` (
                \`roleId\` int NOT NULL,
                \`permissionId\` int NOT NULL,
                INDEX \`IDX_role_permissions_roleId\` (\`roleId\`),
                INDEX \`IDX_role_permissions_permissionId\` (\`permissionId\`),
                PRIMARY KEY (\`roleId\`, \`permissionId\`),
                CONSTRAINT \`FK_role_permissions_roleId\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT \`FK_role_permissions_permissionId\` FOREIGN KEY (\`permissionId\`) REFERENCES \`permissions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`role_permissions\``);
    }

}
