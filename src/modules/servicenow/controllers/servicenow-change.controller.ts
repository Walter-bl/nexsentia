import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { ServiceNowChange } from '../entities/servicenow-change.entity';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

@Controller('servicenow/changes')
export class ServiceNowChangeController {
  constructor(
    @InjectRepository(ServiceNowChange)
    private readonly changeRepository: Repository<ServiceNowChange>,
  ) {}

  /**
   * List change requests with filtering
   * GET /api/v1/servicenow/changes
   */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query('connectionId', ParseIntPipe) connectionId?: number,
    @Query('state') state?: string,
    @Query('type') type?: string,
    @Query('risk') risk?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('limit', ParseIntPipe) limit: number = 100,
    @Query('offset', ParseIntPipe) offset: number = 0,
  ) {
    const where: FindOptionsWhere<ServiceNowChange> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (state) where.state = state;
    if (type) where.type = type;
    if (risk) where.risk = risk;
    if (assignedTo) where.assignedTo = assignedTo;

    const [changes, total] = await this.changeRepository.findAndCount({
      where,
      order: { sysUpdatedOn: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      changes,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get a single change request
   * GET /api/v1/servicenow/changes/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ) {
    return this.changeRepository.findOne({
      where: { id, tenantId },
    });
  }

  /**
   * Get change request statistics
   * GET /api/v1/servicenow/changes/stats
   */
  @Get('stats/summary')
  async getStats(@CurrentTenant() tenantId: number) {
    const [totalChanges, inProgress, highRisk] = await Promise.all([
      this.changeRepository.count({ where: { tenantId } }),
      this.changeRepository.count({
        where: { tenantId, state: In(['Assess', 'Authorize', 'Scheduled', 'Implement']) },
      }),
      this.changeRepository.count({
        where: { tenantId, risk: 'High' },
      }),
    ]);

    return {
      totalChanges,
      inProgress,
      highRisk,
    };
  }
}
