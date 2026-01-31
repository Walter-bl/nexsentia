import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateKpiTables1769859203326 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create metric_definitions table
    await queryRunner.createTable(
      new Table({
        name: 'metric_definitions',
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
            name: 'metricKey',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'dataType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'aggregationType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'calculation',
            type: 'json',
          },
          {
            name: 'thresholds',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'displayConfig',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isCustom',
            type: 'boolean',
            default: false,
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

    await queryRunner.createIndex(
      'metric_definitions',
      new TableIndex({
        name: 'IDX_metric_definitions_tenant_key',
        columnNames: ['tenantId', 'metricKey'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'metric_definitions',
      new TableIndex({
        name: 'IDX_metric_definitions_category',
        columnNames: ['tenantId', 'category'],
      }),
    );

    // Create metric_values table
    await queryRunner.createTable(
      new Table({
        name: 'metric_values',
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
            name: 'metricDefinitionId',
            type: 'int',
          },
          {
            name: 'value',
            type: 'decimal',
            precision: 20,
            scale: 4,
          },
          {
            name: 'periodStart',
            type: 'timestamp',
          },
          {
            name: 'periodEnd',
            type: 'timestamp',
          },
          {
            name: 'granularity',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'breakdown',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'comparisonData',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['metricDefinitionId'],
            referencedTableName: 'metric_definitions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'metric_values',
      new TableIndex({
        name: 'IDX_metric_values_period',
        columnNames: ['tenantId', 'metricDefinitionId', 'periodStart', 'periodEnd'],
      }),
    );

    await queryRunner.createIndex(
      'metric_values',
      new TableIndex({
        name: 'IDX_metric_values_start',
        columnNames: ['tenantId', 'periodStart'],
      }),
    );

    // Create business_impacts table
    await queryRunner.createTable(
      new Table({
        name: 'business_impacts',
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
            name: 'sourceType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'sourceId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'impactType',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'estimatedRevenueLoss',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'actualRevenueLoss',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'customersAffected',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'usersAffected',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'durationMinutes',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'impactDate',
            type: 'timestamp',
          },
          {
            name: 'resolvedDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'severity',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'revenueMapping',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'lossEstimation',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isValidated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'validatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'validatedBy',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'validationNotes',
            type: 'text',
            isNullable: true,
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

    await queryRunner.createIndex(
      'business_impacts',
      new TableIndex({
        name: 'IDX_business_impacts_source',
        columnNames: ['tenantId', 'sourceType', 'sourceId'],
      }),
    );

    await queryRunner.createIndex(
      'business_impacts',
      new TableIndex({
        name: 'IDX_business_impacts_date',
        columnNames: ['tenantId', 'impactDate'],
      }),
    );

    // Create kpi_snapshots table
    await queryRunner.createTable(
      new Table({
        name: 'kpi_snapshots',
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
            name: 'snapshotDate',
            type: 'timestamp',
          },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'metrics',
            type: 'json',
          },
          {
            name: 'summary',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'kpi_snapshots',
      new TableIndex({
        name: 'IDX_kpi_snapshots_date',
        columnNames: ['tenantId', 'snapshotDate'],
      }),
    );

    await queryRunner.createIndex(
      'kpi_snapshots',
      new TableIndex({
        name: 'IDX_kpi_snapshots_category',
        columnNames: ['tenantId', 'category'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('kpi_snapshots', true);
    await queryRunner.dropTable('business_impacts', true);
    await queryRunner.dropTable('metric_values', true);
    await queryRunner.dropTable('metric_definitions', true);
  }
}
