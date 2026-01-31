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
import { MetricDefinitionService } from '../services/metric-definition.service';
import { MetricAggregationService } from '../services/metric-aggregation.service';
import { KpiValidationService } from '../services/kpi-validation.service';
import { CreateMetricDefinitionDto, CalculateMetricDto } from '../dto/metric.dto';

@Controller('api/v1/kpi/metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(
    private readonly definitionService: MetricDefinitionService,
    private readonly aggregationService: MetricAggregationService,
    private readonly validationService: KpiValidationService,
  ) {}

  @Post('initialize')
  async initializeDefaultMetrics(@CurrentTenant() tenantId: number) {
    await this.definitionService.initializeDefaultMetrics(tenantId);

    return {
      message: 'Default metrics initialized successfully',
    };
  }

  @Get()
  async getMetrics(
    @CurrentTenant() tenantId: number,
    @Query('category') category?: string,
  ) {
    return await this.definitionService.getMetrics(tenantId, category);
  }

  @Get(':metricKey')
  async getMetric(
    @CurrentTenant() tenantId: number,
    @Param('metricKey') metricKey: string,
  ) {
    return await this.definitionService.getMetricByKey(tenantId, metricKey);
  }

  @Post()
  async createMetric(
    @CurrentTenant() tenantId: number,
    @Body() createDto: CreateMetricDefinitionDto,
  ) {
    return await this.definitionService.createMetric({
      ...createDto,
      tenantId,
    });
  }

  @Post(':metricKey/calculate')
  async calculateMetric(
    @CurrentTenant() tenantId: number,
    @Param('metricKey') metricKey: string,
    @Body() calculateDto: CalculateMetricDto,
  ) {
    const metric = await this.definitionService.getMetricByKey(tenantId, metricKey);

    const context = {
      tenantId,
      periodStart: new Date(calculateDto.periodStart),
      periodEnd: new Date(calculateDto.periodEnd),
      granularity: calculateDto.granularity as any,
      filters: calculateDto.filters,
    };

    const result = await this.aggregationService.calculateMetric(metric, context);
    const metricValue = await this.aggregationService.storeMetricValue(metric, context, result);

    return {
      metricKey,
      value: result.value,
      period: {
        start: context.periodStart,
        end: context.periodEnd,
        granularity: context.granularity,
      },
      metadata: result.metadata,
      id: metricValue.id,
    };
  }

  @Get(':metricKey/values')
  async getMetricValues(
    @CurrentTenant() tenantId: number,
    @Param('metricKey') metricKey: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return await this.aggregationService.getMetricValues(
      tenantId,
      metricKey,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  @Get(':metricKey/validate')
  async validateMetric(
    @CurrentTenant() tenantId: number,
    @Param('metricKey') metricKey: string,
  ) {
    const metric = await this.definitionService.getMetricByKey(tenantId, metricKey);
    return this.validationService.validateMetricDefinition(metric);
  }
}
