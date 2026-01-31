import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceNowConnection } from '../entities/servicenow-connection.entity';
import { ServiceNowSyncHistory } from '../entities/servicenow-sync-history.entity';
import { ServiceNowIngestionService } from './servicenow-ingestion.service';

@Injectable()
export class ServiceNowConnectionService {
  constructor(
    @InjectRepository(ServiceNowConnection)
    private readonly connectionRepository: Repository<ServiceNowConnection>,
    @InjectRepository(ServiceNowSyncHistory)
    private readonly syncHistoryRepository: Repository<ServiceNowSyncHistory>,
    private readonly ingestionService: ServiceNowIngestionService,
  ) {}

  /**
   * Find all connections for a tenant
   */
  async findAll(tenantId: number): Promise<ServiceNowConnection[]> {
    return this.connectionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find a single connection
   */
  async findOne(id: number, tenantId: number): Promise<ServiceNowConnection> {
    const connection = await this.connectionRepository.findOne({
      where: { id, tenantId },
    });

    if (!connection) {
      throw new HttpException('Connection not found', HttpStatus.NOT_FOUND);
    }

    return connection;
  }

  /**
   * Update a connection
   */
  async update(
    id: number,
    tenantId: number,
    updateData: Partial<ServiceNowConnection>,
  ): Promise<ServiceNowConnection> {
    const connection = await this.findOne(id, tenantId);

    // Don't allow updating sensitive fields
    delete updateData.accessToken;
    delete updateData.refreshToken;
    delete updateData.tenantId;

    Object.assign(connection, updateData);
    return this.connectionRepository.save(connection);
  }

  /**
   * Delete a connection
   */
  async remove(id: number, tenantId: number): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.connectionRepository.remove(connection);
  }

  /**
   * Trigger manual sync
   */
  async triggerSync(
    id: number,
    tenantId: number,
    syncType: 'full' | 'incremental' = 'incremental',
  ): Promise<ServiceNowSyncHistory> {
    const connection = await this.findOne(id, tenantId);

    if (!connection.isActive) {
      throw new HttpException(
        'Connection is not active',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.ingestionService.syncConnection(id, tenantId, syncType);
  }

  /**
   * Get sync history for a connection
   */
  async getSyncHistory(
    id: number,
    tenantId: number,
    limit: number = 50,
  ): Promise<ServiceNowSyncHistory[]> {
    await this.findOne(id, tenantId); // Verify connection exists

    return this.syncHistoryRepository.find({
      where: { connectionId: id, tenantId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }
}
