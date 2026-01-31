import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddDomainAndContactPhoneToTenants1768792527888 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add domain column
        await queryRunner.addColumn('tenants', new TableColumn({
            name: 'domain',
            type: 'varchar',
            isNullable: true,
        }));

        // Add contactPhone column
        await queryRunner.addColumn('tenants', new TableColumn({
            name: 'contactPhone',
            type: 'varchar',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove contactPhone column
        await queryRunner.dropColumn('tenants', 'contactPhone');

        // Remove domain column
        await queryRunner.dropColumn('tenants', 'domain');
    }

}
