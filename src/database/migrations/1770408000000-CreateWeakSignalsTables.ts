import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateWeakSignalsTables1770408000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create weak_signals table
    await queryRunner.createTable(
      new Table({
        name: 'weak_signals',
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
            name: 'signalType',
            type: 'varchar',
            length: '50',
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
            name: 'severity',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'confidenceScore',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'new'",
            isNullable: false,
          },
          {
            name: 'sourceSignals',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'patternData',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'trendData',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'explainability',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'affectedEntities',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'detectedAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'validatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'validatedBy',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'escalatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'investigationNotes',
            type: 'text',
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

    // Create indexes for weak_signals
    // Note: tenantId and detectedAt indexes are created automatically by TypeORM from @Index() decorators

    await queryRunner.createIndex(
      'weak_signals',
      new TableIndex({
        name: 'IDX_weak_signals_tenant_status_detected',
        columnNames: ['tenantId', 'status', 'detectedAt'],
      }),
    );

    await queryRunner.createIndex(
      'weak_signals',
      new TableIndex({
        name: 'IDX_weak_signals_tenant_type_severity',
        columnNames: ['tenantId', 'signalType', 'severity'],
      }),
    );

    // Create hypotheses table
    await queryRunner.createTable(
      new Table({
        name: 'hypotheses',
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
            name: 'weakSignalId',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'hypothesisType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'hypothesis',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'confidence',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'generated'",
            isNullable: false,
          },
          {
            name: 'context',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'reasoning',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'supportingEvidence',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'contradictingEvidence',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'guardrails',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'validationSteps',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'predictedImpact',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'generatedAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'validatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'validatedBy',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'validationNotes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'validationResults',
            type: 'json',
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

    // Create foreign key for hypotheses -> weak_signals
    await queryRunner.createForeignKey(
      'hypotheses',
      new TableForeignKey({
        name: 'FK_hypotheses_weak_signal',
        columnNames: ['weakSignalId'],
        referencedTableName: 'weak_signals',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create indexes for hypotheses
    // Note: tenantId, weakSignalId, and generatedAt indexes are created automatically by TypeORM from @Index() decorators

    await queryRunner.createIndex(
      'hypotheses',
      new TableIndex({
        name: 'IDX_hypotheses_tenant_status_generated',
        columnNames: ['tenantId', 'status', 'generatedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('hypotheses', 'FK_hypotheses_weak_signal');

    // Drop tables
    await queryRunner.dropTable('hypotheses');
    await queryRunner.dropTable('weak_signals');
  }
}
