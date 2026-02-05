import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTimelineEventsTable1770284039713 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'timeline_events',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'tenantId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'eventDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'impactLevel',
            type: 'enum',
            enum: ['high', 'medium', 'low'],
            default: "'medium'",
            isNullable: false,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'sourceType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'sourceId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'aiAnalysis',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isResolved',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'resolvedBy',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'resolutionNotes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['tenantId'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'timeline_events',
      new TableIndex({
        name: 'IDX_timeline_events_tenant_event_date',
        columnNames: ['tenantId', 'eventDate'],
      }),
    );

    await queryRunner.createIndex(
      'timeline_events',
      new TableIndex({
        name: 'IDX_timeline_events_tenant_impact',
        columnNames: ['tenantId', 'impactLevel'],
      }),
    );

    await queryRunner.createIndex(
      'timeline_events',
      new TableIndex({
        name: 'IDX_timeline_events_tenant_category',
        columnNames: ['tenantId', 'category'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('timeline_events');
  }
}
