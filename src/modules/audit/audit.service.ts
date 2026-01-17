import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditAction } from '../../common/enums';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(createAuditLogDto);
    return await this.auditLogRepository.save(auditLog);
  }

  async log(
    tenantId: number,
    action: AuditAction,
    resource: string,
    options: {
      userId?: number;
      resourceId?: number;
      metadata?: Record<string, any>;
      changes?: { before?: Record<string, any>; after?: Record<string, any> };
      ipAddress?: string;
      userAgent?: string;
      httpMethod?: string;
      requestPath?: string;
      statusCode?: number;
      errorMessage?: string;
    } = {},
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      tenantId,
      action,
      resource,
      ...options,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  async findAll(tenantId: number, queryDto: QueryAuditLogDto) {
    const { page = 1, limit = 20, fromDate, toDate, userId, action, resource, resourceId } = queryDto;

    const where: FindOptionsWhere<AuditLog> = { tenantId };

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (resource) {
      where.resource = resource;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.createdAt = Between(new Date(fromDate), new Date());
    }

    const [items, total] = await this.auditLogRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByUser(tenantId: number, userId: number, limit: number = 50): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByResource(
    tenantId: number,
    resource: string,
    resourceId: number,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { tenantId, resource, resourceId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async deleteOldLogs(tenantId: number, daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .from(AuditLog)
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
