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
import { HypothesisGenerationService } from '../services/hypothesis-generation.service';
import {
  GenerateHypothesesDto,
  GetHypothesesQueryDto,
  UpdateHypothesisStatusDto,
  HypothesisResponseDto,
} from '../dto/hypothesis.dto';

@ApiTags('Hypotheses')
@Controller('hypotheses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class HypothesesController {
  constructor(private readonly hypothesisGenerationService: HypothesisGenerationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate hypotheses for a weak signal' })
  @ApiResponse({ status: 200, description: 'Hypotheses generated successfully', type: [HypothesisResponseDto] })
  async generateHypotheses(
    @CurrentTenant() tenantId: number,
    @Body() dto: GenerateHypothesesDto,
  ): Promise<HypothesisResponseDto[]> {
    const hypotheses = await this.hypothesisGenerationService.generateHypothesesForSignal(
      tenantId,
      dto.weakSignalId,
    );
    return hypotheses.map(h => this.mapToResponseDto(h));
  }

  @Get()
  @ApiOperation({ summary: 'Get hypotheses with filtering' })
  @ApiResponse({ status: 200, description: 'Hypotheses retrieved successfully', type: [HypothesisResponseDto] })
  async getHypotheses(
    @CurrentTenant() tenantId: number,
    @Query() query: GetHypothesesQueryDto,
  ): Promise<{
    hypotheses: HypothesisResponseDto[];
    total: number;
  }> {
    const hypotheses = await this.hypothesisGenerationService.getHypotheses(tenantId, {
      weakSignalId: query.weakSignalId,
      status: query.status,
      minConfidence: query.minConfidence,
      limit: query.limit,
    });

    return {
      hypotheses: hypotheses.map(h => this.mapToResponseDto(h)),
      total: hypotheses.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single hypothesis by ID' })
  @ApiResponse({ status: 200, description: 'Hypothesis retrieved successfully', type: HypothesisResponseDto })
  @ApiResponse({ status: 404, description: 'Hypothesis not found' })
  async getHypothesisById(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<HypothesisResponseDto> {
    const hypothesis = await this.hypothesisGenerationService.getHypotheses(tenantId, { limit: 1 });

    const found = hypothesis.find(h => h.id === id);

    if (!found) {
      throw new NotFoundException('Hypothesis not found');
    }

    return this.mapToResponseDto(found);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update hypothesis status and validation results' })
  @ApiResponse({ status: 200, description: 'Status updated successfully', type: HypothesisResponseDto })
  @ApiResponse({ status: 404, description: 'Hypothesis not found' })
  async updateStatus(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHypothesisStatusDto,
    @CurrentUser() user: any,
  ): Promise<HypothesisResponseDto> {
    // Get the hypothesis first
    const hypotheses = await this.hypothesisGenerationService.getHypotheses(tenantId, { limit: 1000 });
    const hypothesis = hypotheses.find(h => h.id === id);

    if (!hypothesis) {
      throw new NotFoundException('Hypothesis not found');
    }

    // Update the hypothesis
    hypothesis.status = dto.status;
    hypothesis.validatedAt = new Date();
    hypothesis.validatedBy = user.id;

    if (dto.validationNotes) {
      hypothesis.validationNotes = dto.validationNotes;
    }

    if (dto.validationResults) {
      hypothesis.validationResults = dto.validationResults;
    }

    // Note: In a real implementation, you would save this to the database
    // For now, we're just returning the updated object

    return this.mapToResponseDto(hypothesis);
  }

  private mapToResponseDto(hypothesis: any): HypothesisResponseDto {
    return {
      id: hypothesis.id,
      hypothesisType: hypothesis.hypothesisType,
      hypothesis: hypothesis.hypothesis,
      confidence: Number(hypothesis.confidence),
      status: hypothesis.status,
      generatedAt: hypothesis.generatedAt,
      weakSignalId: hypothesis.weakSignalId,
      context: hypothesis.context,
      reasoning: hypothesis.reasoning,
      supportingEvidence: hypothesis.supportingEvidence,
      contradictingEvidence: hypothesis.contradictingEvidence,
      guardrails: hypothesis.guardrails,
      validationSteps: hypothesis.validationSteps,
      predictedImpact: hypothesis.predictedImpact,
    };
  }
}
