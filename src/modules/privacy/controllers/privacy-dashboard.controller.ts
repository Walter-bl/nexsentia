import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { PrivacyDashboardService } from '../services/privacy-dashboard.service';
import { DataAnonymizationCronService } from '../services/data-anonymization-cron.service';

@Controller('privacy/dashboard')
@UseGuards(JwtAuthGuard)
export class PrivacyDashboardController {
  constructor(
    private readonly privacyDashboardService: PrivacyDashboardService,
    private readonly anonymizationCronService: DataAnonymizationCronService,
  ) {}

  /**
   * GET /api/v1/privacy/dashboard
   * Get complete privacy dashboard overview
   */
  @Get()
  async getPrivacyDashboard(@CurrentTenant() tenantId: number) {
    return await this.privacyDashboardService.getPrivacyDashboard(tenantId);
  }

  /**
   * GET /api/v1/privacy/dashboard/architecture
   * Get privacy-first architecture metrics
   */
  @Get('architecture')
  async getPrivacyArchitecture(@CurrentTenant() tenantId: number) {
    return await this.privacyDashboardService.getPrivacyArchitecture(tenantId);
  }

  /**
   * GET /api/v1/privacy/dashboard/data-sources
   * Get connected data sources with privacy statistics
   */
  @Get('data-sources')
  async getDataSources(@CurrentTenant() tenantId: number) {
    return await this.privacyDashboardService.getDataSources(tenantId);
  }

  /**
   * GET /api/v1/privacy/dashboard/guarantees
   * Get privacy guarantees and features
   */
  @Get('guarantees')
  async getPrivacyGuarantees(@CurrentTenant() tenantId: number) {
    return await this.privacyDashboardService.getPrivacyGuarantees(tenantId);
  }

  /**
   * GET /api/v1/privacy/dashboard/compliance
   * Get compliance status (SOC2, GDPR, CCPA, etc.)
   */
  @Get('compliance')
  async getComplianceStatus(@CurrentTenant() tenantId: number) {
    return await this.privacyDashboardService.getComplianceStatus(tenantId);
  }

  /**
   * POST /api/v1/privacy/dashboard/anonymize
   * Manually trigger data anonymization for ingestion data only
   * NOTE: Does NOT anonymize user accounts, only integration data (Jira, ServiceNow, Slack, Teams)
   */
  @Post('anonymize')
  async triggerAnonymization() {
    const result = await this.anonymizationCronService.anonymizeAllData();
    return {
      success: true,
      message: 'Ingestion data anonymization completed successfully',
      stats: result,
      totalAnonymized: Object.values(result).reduce((sum, count) => sum + count, 0),
    };
  }
}
