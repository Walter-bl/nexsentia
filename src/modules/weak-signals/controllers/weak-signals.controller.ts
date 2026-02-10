import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { WeakSignalDetectionService } from '../services/weak-signal-detection.service';
import { WeakSignalSchedulerService } from '../services/weak-signal-scheduler.service';
import { HypothesisGenerationService } from '../services/hypothesis-generation.service';
import {
  DetectWeakSignalsDto,
  GetWeakSignalsQueryDto,
  UpdateWeakSignalStatusDto,
  WeakSignalResponseDto,
  WeakSignalStatisticsDto,
} from '../dto/weak-signal.dto';

@ApiTags('Weak Signals')
@Controller('weak-signals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class WeakSignalsController {
  constructor(
    private readonly weakSignalDetectionService: WeakSignalDetectionService,
    private readonly schedulerService: WeakSignalSchedulerService,
    private readonly hypothesisService: HypothesisGenerationService,
  ) {}

  @Post('detect')
  @ApiOperation({ summary: 'Trigger weak signal detection' })
  @ApiResponse({ status: 200, description: 'Weak signals detected successfully', type: [WeakSignalResponseDto] })
  async detectWeakSignals(
    @CurrentTenant() tenantId: number,
    @Body() dto: DetectWeakSignalsDto,
  ): Promise<WeakSignalResponseDto[]> {
    const signals = await this.weakSignalDetectionService.detectWeakSignals(tenantId, dto.daysBack);
    return signals.map(signal => this.mapToResponseDto(signal));
  }

  @Get()
  @ApiOperation({ summary: 'Get weak signals with filtering' })
  @ApiResponse({ status: 200, description: 'Weak signals retrieved successfully', type: [WeakSignalResponseDto] })
  async getWeakSignals(
    @CurrentTenant() tenantId: number,
    @Query() query: GetWeakSignalsQueryDto,
  ): Promise<{
    signals: WeakSignalResponseDto[];
    total: number;
  }> {
    const signals = await this.weakSignalDetectionService.getWeakSignals(tenantId, {
      signalType: query.signalType,
      severity: query.severity,
      status: query.status,
      minConfidence: query.minConfidence,
      limit: query.limit,
    });

    return {
      signals: signals.map(signal => this.mapToResponseDto(signal)),
      total: signals.length,
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get weak signal statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully', type: WeakSignalStatisticsDto })
  async getStatistics(@CurrentTenant() tenantId: number): Promise<WeakSignalStatisticsDto> {
    return await this.weakSignalDetectionService.getStatistics(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single weak signal by ID with associated hypotheses' })
  @ApiResponse({ status: 200, description: 'Weak signal retrieved successfully', type: WeakSignalResponseDto })
  @ApiResponse({ status: 404, description: 'Weak signal not found' })
  async getWeakSignalById(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<any> {
    const signal = await this.weakSignalDetectionService.getWeakSignalById(tenantId, id);

    if (!signal) {
      throw new NotFoundException('Weak signal not found');
    }

    // Get associated hypotheses
    const hypotheses = await this.hypothesisService.getHypothesesBySignal(tenantId, id);

    return {
      ...this.mapToResponseDto(signal),
      hypotheses: hypotheses.map(h => ({
        id: h.id,
        hypothesisType: h.hypothesisType,
        hypothesis: h.hypothesis,
        confidence: Number(h.confidence),
        status: h.status,
        reasoning: h.reasoning,
        supportingEvidence: h.supportingEvidence,
        guardrails: h.guardrails,
        validationSteps: h.validationSteps,
        predictedImpact: h.predictedImpact,
        generatedAt: h.generatedAt,
      })),
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update weak signal status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully', type: WeakSignalResponseDto })
  @ApiResponse({ status: 404, description: 'Weak signal not found' })
  async updateStatus(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWeakSignalStatusDto,
    @CurrentUser() user: any,
  ): Promise<WeakSignalResponseDto> {
    const signal = await this.weakSignalDetectionService.updateWeakSignalStatus(
      tenantId,
      id,
      dto.status,
      user.id,
      dto.notes,
    );

    return this.mapToResponseDto(signal);
  }

  @Post('detection-runs/trigger')
  @ApiOperation({ summary: 'Manually trigger weak signal detection with deduplication' })
  @ApiResponse({ status: 200, description: 'Detection triggered successfully' })
  async triggerDetection(@CurrentTenant() tenantId: number): Promise<{
    detectionRun: any;
    skipped: boolean;
    message: string;
  }> {
    const detectionRun = await this.schedulerService.runDetectionForTenant(tenantId);

    if (!detectionRun) {
      return {
        detectionRun: null,
        skipped: true,
        message: 'Detection skipped - no run available',
      };
    }

    // Check if this was a recent run that was skipped
    const now = new Date();
    const timeSinceCompletion = detectionRun.completedAt
      ? now.getTime() - detectionRun.completedAt.getTime()
      : 0;
    const skipped = timeSinceCompletion > 0 && timeSinceCompletion < 6 * 60 * 60 * 1000; // 6 hours

    return {
      detectionRun,
      skipped,
      message: skipped
        ? 'Detection skipped - recent run found within deduplication window'
        : 'Detection completed successfully',
    };
  }

  @Get('detection-runs')
  @ApiOperation({ summary: 'Get recent detection runs' })
  @ApiResponse({ status: 200, description: 'Detection runs retrieved successfully' })
  async getDetectionRuns(
    @CurrentTenant() tenantId: number,
    @Query('limit') limit?: number,
  ): Promise<any[]> {
    return this.schedulerService.getRecentRuns(tenantId, limit || 10);
  }

  @Get('detection-runs/stats')
  @ApiOperation({ summary: 'Get detection run statistics' })
  @ApiResponse({ status: 200, description: 'Detection statistics retrieved successfully' })
  async getDetectionStats(@CurrentTenant() tenantId: number): Promise<any> {
    return this.schedulerService.getDetectionStats(tenantId);
  }

  @Post('regenerate')
  @ApiOperation({ summary: 'Delete all existing signals and regenerate from scratch' })
  @ApiResponse({ status: 200, description: 'Signals regenerated successfully' })
  async regenerateSignals(
    @CurrentTenant() tenantId: number,
    @Body() dto: DetectWeakSignalsDto,
  ): Promise<{
    deleted: number;
    generated: number;
    signals: WeakSignalResponseDto[];
  }> {
    const deleted = await this.weakSignalDetectionService.deleteAllSignals(tenantId);
    const signals = await this.weakSignalDetectionService.detectWeakSignals(tenantId, dto.daysBack);

    return {
      deleted,
      generated: signals.length,
      signals: signals.map(signal => this.mapToResponseDto(signal)),
    };
  }

  private mapToResponseDto(signal: any): WeakSignalResponseDto {
    return {
      id: signal.id,
      signalType: signal.signalType,
      title: signal.title,
      description: signal.description,
      severity: signal.severity,
      confidenceScore: Number(signal.confidenceScore),
      status: signal.status,
      detectedAt: signal.detectedAt,
      category: signal.category,
      affectedEntities: signal.affectedEntities,
      explainability: signal.explainability,
      patternData: signal.patternData,
      trendData: signal.trendData,
      sourceSignals: signal.sourceSignals,
      metadata: signal.metadata,
    };
  }
}
