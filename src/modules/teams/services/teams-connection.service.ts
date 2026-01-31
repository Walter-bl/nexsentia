import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamsConnection } from '../entities/teams-connection.entity';

@Injectable()
export class TeamsConnectionService {
  constructor(
    @InjectRepository(TeamsConnection)
    private readonly connectionRepository: Repository<TeamsConnection>,
  ) {}

  /**
   * Find all connections for a tenant
   */
  async findAll(tenantId: number): Promise<TeamsConnection[]> {
    return this.connectionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find a single connection
   */
  async findOne(id: number, tenantId: number): Promise<TeamsConnection> {
    const connection = await this.connectionRepository.findOne({
      where: { id, tenantId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    return connection;
  }

  /**
   * Update a connection
   */
  async update(
    id: number,
    tenantId: number,
    updateData: Partial<TeamsConnection>,
  ): Promise<TeamsConnection> {
    const connection = await this.findOne(id, tenantId);

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
  async delete(id: number, tenantId: number): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.connectionRepository.remove(connection);
  }

  /**
   * Get sync history for a connection
   */
  async getSyncHistory(id: number, tenantId: number, limit: number = 10): Promise<any[]> {
    const connection = await this.findOne(id, tenantId);

    // This would typically query a sync history repository
    // For now, return basic sync info from the connection
    return [
      {
        lastSyncAt: connection.lastSyncAt,
        lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
        lastSyncError: connection.lastSyncError,
        syncStats: connection.syncStats,
      },
    ];
  }
}
