import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateDetectionRunsTable1770409000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'weak_signal_detection_runs',
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
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'running'",
            isNullable: false,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'signalsDetected',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'hypothesesGenerated',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'daysAnalyzed',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'detectionSummary',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'durationMs',
            type: 'integer',
            isNullable: true,
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
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'weak_signal_detection_runs',
      new TableIndex({
        name: 'IDX_detection_runs_tenant_status_started',
        columnNames: ['tenantId', 'status', 'startedAt'],
      }),
    );

    await queryRunner.createIndex(
      'weak_signal_detection_runs',
      new TableIndex({
        name: 'IDX_detection_runs_tenant_completed',
        columnNames: ['tenantId', 'completedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('weak_signal_detection_runs');
  }
}
