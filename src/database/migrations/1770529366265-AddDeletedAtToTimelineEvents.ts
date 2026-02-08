import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDeletedAtToTimelineEvents1770529366265 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'timeline_events',
      new TableColumn({
        name: 'deletedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('timeline_events', 'deletedAt');
  }
}
