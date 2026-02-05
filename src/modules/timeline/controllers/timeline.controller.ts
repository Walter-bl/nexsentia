import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TimelineService } from '../services/timeline.service';
import { TimelineGeneratorService } from '../services/timeline-generator.service';
import { CreateTimelineEventDto, UpdateTimelineEventDto, TimelineQueryDto } from '../dto/timeline.dto';

@ApiTags('Timeline')
@Controller('timeline')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class TimelineController {
  constructor(
    private readonly timelineService: TimelineService,
    private readonly timelineGeneratorService: TimelineGeneratorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get timeline events generated from ingested data' })
  @ApiResponse({ status: 200, description: 'Timeline events retrieved successfully' })
  async getEvents(
    @CurrentTenant() tenantId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('impactLevel') impactLevel?: 'high' | 'medium' | 'low',
    @Query('category') category?: string,
    @Query('isResolved') isResolved?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const options: any = {};

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (impactLevel) options.impactLevel = impactLevel;
    if (category) options.category = category;
    if (isResolved !== undefined) options.isResolved = isResolved === 'true';

    const events = await this.timelineGeneratorService.generateTimelineEvents(tenantId, options);

    // Pagination
    const pageNum = page || 1;
    const limitNum = limit || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedEvents = events.slice(startIndex, endIndex);

    return {
      events: paginatedEvents,
      total: events.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(events.length / limitNum),
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get timeline statistics from generated events' })
  @ApiResponse({ status: 200, description: 'Timeline statistics retrieved successfully' })
  async getStatistics(
    @CurrentTenant() tenantId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.timelineGeneratorService.getStatistics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single timeline event' })
  @ApiResponse({ status: 200, description: 'Timeline event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Timeline event not found' })
  async getEvent(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.timelineService.getEvent(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new timeline event' })
  @ApiResponse({ status: 201, description: 'Timeline event created successfully' })
  async createEvent(
    @CurrentTenant() tenantId: number,
    @Body() dto: CreateTimelineEventDto,
  ) {
    return await this.timelineService.createEvent(tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a timeline event' })
  @ApiResponse({ status: 200, description: 'Timeline event updated successfully' })
  @ApiResponse({ status: 404, description: 'Timeline event not found' })
  async updateEvent(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimelineEventDto,
    @CurrentUser() user: any,
  ) {
    return await this.timelineService.updateEvent(tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a timeline event' })
  @ApiResponse({ status: 200, description: 'Timeline event deleted successfully' })
  @ApiResponse({ status: 404, description: 'Timeline event not found' })
  async deleteEvent(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.timelineService.deleteEvent(tenantId, id);
    return { message: 'Timeline event deleted successfully' };
  }

  @Post('auto-detect')
  @ApiOperation({ summary: 'Auto-detect and create timeline events from integration data' })
  @ApiResponse({ status: 200, description: 'Timeline events auto-detected successfully' })
  async autoDetectEvents(@CurrentTenant() tenantId: number) {
    const events = await this.timelineService.detectAndCreateEvents(tenantId);
    return {
      message: 'Auto-detection completed',
      eventsCreated: events.length,
      events,
    };
  }
}
