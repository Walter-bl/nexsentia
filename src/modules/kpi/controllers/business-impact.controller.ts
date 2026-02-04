import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { BusinessImpactService } from '../services/business-impact.service';
import { KpiValidationService } from '../services/kpi-validation.service';
import { CreateBusinessImpactDto, ValidateImpactDto } from '../dto/metric.dto';

@Controller('kpi/business-impact')
@UseGuards(JwtAuthGuard)
export class BusinessImpactController {
  constructor(
    private readonly impactService: BusinessImpactService,
    private readonly validationService: KpiValidationService,
  ) {}

  @Post()
  async createImpact(
    @CurrentTenant() tenantId: number,
    @Body() createDto: CreateBusinessImpactDto,
  ) {
    return await this.impactService.mapRevenueImpact(
      tenantId,
      createDto.sourceType,
      createDto.sourceId,
      {
        affectedServices: createDto.revenueMapping?.affectedServices,
        revenuePerHour: createDto.revenueMapping?.revenuePerHour,
        customersAffected: createDto.customersAffected,
        durationMinutes: createDto.durationMinutes,
        recurringImpact: createDto.revenueMapping?.recurringRevenueImpact > 0,
      },
    );
  }

  @Post(':impactId/estimate-loss')
  async estimateLoss(
    @CurrentTenant() tenantId: number,
    @Param('impactId', ParseIntPipe) impactId: number,
    @Body() options?: {
      includeOpportunityCost?: boolean;
      includeReputationImpact?: boolean;
    },
  ) {
    return await this.impactService.estimateLoss(tenantId, impactId, options);
  }

  @Post(':impactId/validate')
  async validateImpact(
    @CurrentTenant() tenantId: number,
    @CurrentUser() user: any,
    @Param('impactId', ParseIntPipe) impactId: number,
    @Body() validateDto: ValidateImpactDto,
  ) {
    return await this.impactService.validateImpact(
      tenantId,
      impactId,
      user.id,
      validateDto.isValid,
      validateDto.notes,
      validateDto.actualRevenueLoss,
    );
  }

  @Get()
  async getImpacts(
    @CurrentTenant() tenantId: number,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('severity') severity?: string,
    @Query('sourceType') sourceType?: string,
    @Query('validated') validated?: string,
  ) {
    return await this.impactService.getImpacts(
      tenantId,
      new Date(periodStart),
      new Date(periodEnd),
      {
        severity,
        sourceType,
        validated: validated === 'true' ? true : validated === 'false' ? false : undefined,
      },
    );
  }

  @Get('total-loss')
  async getTotalRevenueLoss(
    @CurrentTenant() tenantId: number,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return await this.impactService.getTotalRevenueLoss(
      tenantId,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  @Get(':impactId/validate-data')
  async validateImpactData(
    @CurrentTenant() tenantId: number,
    @Param('impactId', ParseIntPipe) impactId: number,
  ) {
    const impacts = await this.impactService.getImpacts(
      tenantId,
      new Date('2000-01-01'),
      new Date(),
    );

    const impact = impacts.find(i => i.id === impactId);
    if (!impact) {
      return { error: 'Impact not found' };
    }

    return this.validationService.validateBusinessImpact(impact);
  }
}
