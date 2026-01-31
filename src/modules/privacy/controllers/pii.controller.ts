import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { PiiDetectionService } from '../services/pii-detection.service';
import { PiiAnonymizationService } from '../services/pii-anonymization.service';
import { PiiValidationService } from '../services/pii-validation.service';
import {
  ScanRequestDto,
  AnonymizeRequestDto,
  DetokenizeRequestDto,
} from '../dto/scan-request.dto';

@Controller('api/v1/privacy/pii')
@UseGuards(JwtAuthGuard)
export class PiiController {
  constructor(
    private readonly detectionService: PiiDetectionService,
    private readonly anonymizationService: PiiAnonymizationService,
    private readonly validationService: PiiValidationService,
  ) {}

  @Post('scan')
  async scanForPii(
    @CurrentTenant() tenantId: number,
    @Body() scanRequest: ScanRequestDto,
  ) {
    // This would typically fetch the data from the source system
    // For now, we'll return a placeholder
    return {
      message: 'PII scan endpoint - integrate with source systems to scan data',
      sourceType: scanRequest.sourceType,
      sourceId: scanRequest.sourceId,
    };
  }

  @Get('detections')
  async getDetections(
    @CurrentTenant() tenantId: number,
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
  ) {
    return await this.detectionService.getDetectionLogs(
      tenantId,
      sourceType,
      sourceId,
    );
  }

  @Get('statistics')
  async getStatistics(
    @CurrentTenant() tenantId: number,
    @Query('sourceType') sourceType?: string,
  ) {
    const detectionStats = await this.detectionService.getStatistics(
      tenantId,
      sourceType,
    );

    const anonymizationStats = await this.anonymizationService.getStatistics(
      tenantId,
    );

    return {
      detection: detectionStats,
      anonymization: anonymizationStats,
    };
  }

  @Post('anonymize')
  async anonymize(
    @CurrentTenant() tenantId: number,
    @Body() anonymizeRequest: AnonymizeRequestDto,
  ) {
    // This would fetch the value from the source, anonymize it, and update
    // For now, return a placeholder
    return {
      message: 'Anonymization endpoint - integrate with source systems',
      method: anonymizeRequest.method,
    };
  }

  @Post('tokenize')
  async tokenize(
    @CurrentTenant() tenantId: number,
    @Body() body: { value: string; piiType: string },
  ) {
    const token = await this.anonymizationService.tokenize(
      tenantId,
      body.value,
      body.piiType,
    );

    return {
      token,
      piiType: body.piiType,
    };
  }

  @Post('detokenize')
  async detokenize(
    @CurrentTenant() tenantId: number,
    @Body() body: DetokenizeRequestDto,
  ) {
    const value = await this.anonymizationService.detokenize(
      tenantId,
      body.tokenId,
    );

    return {
      tokenId: body.tokenId,
      value,
    };
  }

  @Post('hash')
  async hash(@Body() body: { value: string; salt?: string }) {
    const hash = this.anonymizationService.hash(body.value, body.salt);

    return {
      hash,
    };
  }

  @Post('mask')
  async mask(@Body() body: { value: string; piiType: string }) {
    const masked = this.anonymizationService.mask(body.value, body.piiType);

    return {
      original: body.value,
      masked,
      piiType: body.piiType,
    };
  }

  @Post('validate')
  async validate(
    @CurrentTenant() tenantId: number,
    @Body() body: { data: Record<string, any>; fieldsToCheck?: string[] },
  ) {
    const report = this.validationService.validateObject(
      body.data,
      body.fieldsToCheck,
    );

    this.validationService.logValidationResults(report);

    return report;
  }

  @Get('tokens')
  async getTokens(
    @CurrentTenant() tenantId: number,
    @Query('piiType') piiType?: string,
  ) {
    return await this.anonymizationService.getTokens(tenantId, piiType);
  }

  @Post('tokens/:tokenId/revoke')
  async revokeToken(
    @CurrentTenant() tenantId: number,
    @Param('tokenId') tokenId: string,
  ) {
    await this.anonymizationService.revokeToken(tenantId, tokenId);

    return {
      message: 'Token revoked successfully',
      tokenId,
    };
  }
}
