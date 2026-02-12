import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';

@Injectable()
export class AuditCleanupService {
  private readonly logger = new Logger(AuditCleanupService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {
    // Default retention is 365 days (1 year)
    this.retentionDays = this.configService.get<number>('AUDIT_LOG_RETENTION_DAYS', 365);
  }

  /**
   * Runs daily at 2:00 AM to clean up old audit logs
   * This helps maintain database performance and comply with data retention policies
   * DISABLED: Cron disabled to reduce server load
   */
  // @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleAuditLogCleanup() {
    this.logger.log('Starting scheduled audit log cleanup...');

    try {
      // Get all active tenants
      const tenants = await this.tenantRepository.find({
        where: { isActive: true },
        select: ['id', 'name'],
      });

      let totalDeleted = 0;

      // Clean up logs for each tenant
      for (const tenant of tenants) {
        try {
          const deleted = await this.auditService.deleteOldLogs(tenant.id, this.retentionDays);

          if (deleted > 0) {
            this.logger.log(
              `Deleted ${deleted} audit log(s) older than ${this.retentionDays} days for tenant: ${tenant.name} (ID: ${tenant.id})`,
            );
            totalDeleted += deleted;
          }
        } catch (error) {
          this.logger.error(
            `Failed to cleanup audit logs for tenant ${tenant.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Audit log cleanup completed. Total logs deleted: ${totalDeleted} across ${tenants.length} tenant(s)`,
      );
    } catch (error) {
      this.logger.error(`Audit log cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Manual cleanup method that can be called directly
   */
  async manualCleanup(tenantId?: number): Promise<{ deleted: number; message: string }> {
    this.logger.log(`Manual audit log cleanup initiated for tenant: ${tenantId || 'all'}`);

    try {
      if (tenantId) {
        const deleted = await this.auditService.deleteOldLogs(tenantId, this.retentionDays);
        return {
          deleted,
          message: `Deleted ${deleted} audit log(s) older than ${this.retentionDays} days`,
        };
      } else {
        const tenants = await this.tenantRepository.find({
          where: { isActive: true },
          select: ['id'],
        });

        let totalDeleted = 0;

        for (const tenant of tenants) {
          const deleted = await this.auditService.deleteOldLogs(tenant.id, this.retentionDays);
          totalDeleted += deleted;
        }

        return {
          deleted: totalDeleted,
          message: `Deleted ${totalDeleted} audit log(s) across ${tenants.length} tenant(s)`,
        };
      }
    } catch (error) {
      this.logger.error(`Manual cleanup failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
