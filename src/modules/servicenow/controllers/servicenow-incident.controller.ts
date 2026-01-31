import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { ServiceNowIncident } from '../entities/servicenow-incident.entity';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

@Controller('servicenow/incidents')
export class ServiceNowIncidentController {
  constructor(
    @InjectRepository(ServiceNowIncident)
    private readonly incidentRepository: Repository<ServiceNowIncident>,
  ) {}

  /**
   * List incidents with filtering
   * GET /api/v1/servicenow/incidents
   */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query('connectionId', ParseIntPipe) connectionId?: number,
    @Query('state') state?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('category') category?: string,
    @Query('limit', ParseIntPipe) limit: number = 100,
    @Query('offset', ParseIntPipe) offset: number = 0,
  ) {
    const where: FindOptionsWhere<ServiceNowIncident> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (state) where.state = state;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (category) where.category = category;

    const [incidents, total] = await this.incidentRepository.findAndCount({
      where,
      order: { sysUpdatedOn: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      incidents,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get a single incident
   * GET /api/v1/servicenow/incidents/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentTenant() tenantId: number,
  ) {
    return this.incidentRepository.findOne({
      where: { id, tenantId },
    });
  }

  /**
   * Get incident statistics
   * GET /api/v1/servicenow/incidents/stats
   */
  @Get('stats/summary')
  async getStats(@CurrentTenant() tenantId: number) {
    const [totalIncidents, openIncidents, highPriority] = await Promise.all([
      this.incidentRepository.count({ where: { tenantId } }),
      this.incidentRepository.count({
        where: { tenantId, state: In(['New', 'In Progress', 'On Hold']) },
      }),
      this.incidentRepository.count({
        where: { tenantId, priorityValue: In([1, 2]) },
      }),
    ]);

    return {
      totalIncidents,
      openIncidents,
      highPriority,
    };
  }
}
