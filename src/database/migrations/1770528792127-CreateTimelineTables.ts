import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTimelineTables1770528792127 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create timeline_events table
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
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'eventDate',
            type: 'timestamp',
          },
          {
            name: 'impactLevel',
            type: 'enum',
            enum: ['high', 'medium', 'low'],
            default: "'medium'",
          },
          {
            name: 'category',
            type: 'varchar',
            length: '100',
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
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'timeline_events',
      new TableIndex({
        name: 'IDX_timeline_events_tenantId_eventDate',
        columnNames: ['tenantId', 'eventDate'],
      }),
    );

    await queryRunner.createIndex(
      'timeline_events',
      new TableIndex({
        name: 'IDX_timeline_events_tenantId_impactLevel',
        columnNames: ['tenantId', 'impactLevel'],
      }),
    );

    await queryRunner.createIndex(
      'timeline_events',
      new TableIndex({
        name: 'IDX_timeline_events_tenantId_category',
        columnNames: ['tenantId', 'category'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('timeline_events');
  }
}
