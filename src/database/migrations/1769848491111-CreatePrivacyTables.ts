import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePrivacyTables1769848491111 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create pii_detection_logs table
    await queryRunner.createTable(
      new Table({
        name: 'pii_detection_logs',
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
            name: 'fieldName',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'piiType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'originalValue',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'detectedPattern',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'confidenceScore',
            type: 'float',
            default: 1.0,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isAnonymized',
            type: 'boolean',
            default: false,
          },
          {
            name: 'anonymizationMethod',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'detectedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'pii_detection_logs',
      new TableIndex({
        name: 'IDX_pii_detection_logs_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'pii_detection_logs',
      new TableIndex({
        name: 'IDX_pii_detection_logs_source',
        columnNames: ['tenantId', 'sourceType', 'sourceId'],
      }),
    );

    await queryRunner.createIndex(
      'pii_detection_logs',
      new TableIndex({
        name: 'IDX_pii_detection_logs_detected_at',
        columnNames: ['tenantId', 'detectedAt'],
      }),
    );

    // Create anonymization_mappings table
    await queryRunner.createTable(
      new Table({
        name: 'anonymization_mappings',
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
            name: 'tokenId',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'originalValueHash',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'encryptedValue',
            type: 'text',
          },
          {
            name: 'piiType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'method',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'lastAccessedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'anonymization_mappings',
      new TableIndex({
        name: 'IDX_anonymization_mappings_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'anonymization_mappings',
      new TableIndex({
        name: 'IDX_anonymization_mappings_token',
        columnNames: ['tenantId', 'tokenId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'anonymization_mappings',
      new TableIndex({
        name: 'IDX_anonymization_mappings_hash',
        columnNames: ['tenantId', 'originalValueHash'],
      }),
    );

    // Create graph_nodes table
    await queryRunner.createTable(
      new Table({
        name: 'graph_nodes',
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
            name: 'nodeType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'externalId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'sourceSystem',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'properties',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'labels',
            type: 'json',
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

    await queryRunner.createIndex(
      'graph_nodes',
      new TableIndex({
        name: 'IDX_graph_nodes_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'graph_nodes',
      new TableIndex({
        name: 'IDX_graph_nodes_external_id',
        columnNames: ['tenantId', 'nodeType', 'externalId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'graph_nodes',
      new TableIndex({
        name: 'IDX_graph_nodes_type',
        columnNames: ['tenantId', 'nodeType'],
      }),
    );

    // Create graph_edges table
    await queryRunner.createTable(
      new Table({
        name: 'graph_edges',
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
            name: 'fromNodeId',
            type: 'int',
          },
          {
            name: 'toNodeId',
            type: 'int',
          },
          {
            name: 'relationshipType',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'properties',
            type: 'json',
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
        ],
        foreignKeys: [
          {
            columnNames: ['fromNodeId'],
            referencedTableName: 'graph_nodes',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['toNodeId'],
            referencedTableName: 'graph_nodes',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'graph_edges',
      new TableIndex({
        name: 'IDX_graph_edges_tenant',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'graph_edges',
      new TableIndex({
        name: 'IDX_graph_edges_from_to',
        columnNames: ['tenantId', 'fromNodeId', 'toNodeId', 'relationshipType'],
      }),
    );

    await queryRunner.createIndex(
      'graph_edges',
      new TableIndex({
        name: 'IDX_graph_edges_relationship',
        columnNames: ['tenantId', 'relationshipType'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.dropTable('graph_edges', true);
    await queryRunner.dropTable('graph_nodes', true);
    await queryRunner.dropTable('anonymization_mappings', true);
    await queryRunner.dropTable('pii_detection_logs', true);
  }
}
