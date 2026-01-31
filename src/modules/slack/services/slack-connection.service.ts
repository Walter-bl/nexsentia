import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlackConnection } from '../entities/slack-connection.entity';
import { SlackIngestionService } from './slack-ingestion.service';

@Injectable()
export class SlackConnectionService {
  constructor(
    @InjectRepository(SlackConnection)
    private readonly connectionRepository: Repository<SlackConnection>,
    private readonly ingestionService: SlackIngestionService,
  ) {}

  /**
   * Get all connections for a tenant
   */
  async findAll(tenantId: number): Promise<SlackConnection[]> {
    return this.connectionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single connection
   */
  async findOne(id: number, tenantId: number): Promise<SlackConnection> {
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
    updateData: Partial<SlackConnection>,
  ): Promise<SlackConnection> {
    const connection = await this.findOne(id, tenantId);

    // Only allow updating certain fields
    const allowedUpdates = ['name', 'isActive', 'syncSettings'];
    const filteredData = Object.keys(updateData)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = (updateData as any)[key];
        return obj;
      }, {} as Record<string, any>);

    Object.assign(connection, filteredData);
    return this.connectionRepository.save(connection);
  }

  /**
   * Delete a connection
   */
  async remove(id: number, tenantId: number): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.connectionRepository.softDelete(connection.id);
  }

  /**
   * Trigger manual sync for a connection
   */
  async triggerSync(
    id: number,
    tenantId: number,
    syncType: 'full' | 'incremental' = 'incremental',
  ): Promise<any> {
    const connection = await this.findOne(id, tenantId);

    if (!connection.isActive) {
      throw new HttpException(
        'Cannot sync inactive connection',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Start sync in background
    const syncHistory = await this.ingestionService.syncConnection(
      connection.id,
      tenantId,
      syncType,
    );

    return syncHistory;
  }
}
