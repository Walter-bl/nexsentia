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
    tenantIdOrOptions: number | {
      userId?: number;
      tenantId?: number;
      resourceId?: number;
      action?: string;
      resource?: string;
      metadata?: Record<string, any>;
      changes?: { before?: Record<string, any>; after?: Record<string, any> };
      ipAddress?: string;
      userAgent?: string;
      httpMethod?: string;
      requestPath?: string;
      statusCode?: number;
      errorMessage?: string;
    },
    action?: AuditAction,
    resource?: string,
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
    // Support both signatures:
    // 1. log(tenantId, action, resource, options) - old signature
    // 2. log(options) - new signature from interceptor

    let auditData: any;

    if (typeof tenantIdOrOptions === 'number') {
      // Old signature: log(tenantId, action, resource, options)
      auditData = {
        tenantId: tenantIdOrOptions,
        action,
        resource,
        ...options,
      };
    } else {
      // New signature: log(options)
      auditData = tenantIdOrOptions;
    }

    const auditLog = this.auditLogRepository.create(auditData);
    const savedLog = await this.auditLogRepository.save(auditLog);
    // Ensure we return a single AuditLog, not an array
    return Array.isArray(savedLog) ? savedLog[0] : savedLog;
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

  async exportToCsv(tenantId: number, queryDto: QueryAuditLogDto): Promise<string> {
    const { fromDate, toDate, userId, action, resource, resourceId } = queryDto;

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

    const logs = await this.auditLogRepository.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    // CSV Headers
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'User Email',
      'Action',
      'Resource',
      'Resource ID',
      'HTTP Method',
      'Request Path',
      'Status Code',
      'IP Address',
      'User Agent',
      'Error Message',
    ];

    // Build CSV rows
    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.userId || '',
      log.user?.email || '',
      log.action,
      log.resource,
      log.resourceId || '',
      log.httpMethod || '',
      log.requestPath || '',
      log.statusCode || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.errorMessage || '',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => this.escapeCsvCell(cell.toString())).join(',')),
    ].join('\n');

    return csvContent;
  }

  private escapeCsvCell(cell: string): string {
    // Escape double quotes and wrap in quotes if contains comma, newline, or quote
    if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }
}
