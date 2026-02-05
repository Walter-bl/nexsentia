import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { PrivacyDashboardService } from '../services/privacy-dashboard.service';

@Controller('privacy/dashboard')
@UseGuards(JwtAuthGuard)
export class PrivacyDashboardController {
  constructor(
    private readonly privacyDashboardService: PrivacyDashboardService,
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
}
