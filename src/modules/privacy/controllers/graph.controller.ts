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
import { GraphBuilderService } from '../services/graph-builder.service';
import { GraphQueryService } from '../services/graph-query.service';
import { CreateNodeDto, CreateEdgeDto, GraphQueryDto } from '../dto/graph-query.dto';

@Controller('api/v1/privacy/graph')
@UseGuards(JwtAuthGuard)
export class GraphController {
  constructor(
    private readonly builderService: GraphBuilderService,
    private readonly queryService: GraphQueryService,
  ) {}

  @Post('nodes')
  async createNode(
    @CurrentTenant() tenantId: number,
    @Body() createNodeDto: CreateNodeDto,
  ) {
    return await this.builderService.createOrUpdateNode(
      tenantId,
      createNodeDto.nodeType,
      createNodeDto.externalId,
      createNodeDto.sourceSystem,
      createNodeDto.displayName,
      createNodeDto.properties,
      createNodeDto.labels,
    );
  }

  @Post('edges')
  async createEdge(
    @CurrentTenant() tenantId: number,
    @Body() createEdgeDto: CreateEdgeDto,
  ) {
    return await this.builderService.createOrUpdateEdge(
      tenantId,
      createEdgeDto.fromNodeId,
      createEdgeDto.toNodeId,
      createEdgeDto.relationshipType,
      createEdgeDto.properties,
    );
  }

  @Get('nodes/:nodeId')
  async getNode(
    @CurrentTenant() tenantId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
  ) {
    return await this.queryService.getNode(tenantId, nodeId);
  }

  @Post('nodes/search')
  async searchNodes(
    @CurrentTenant() tenantId: number,
    @Body() query: GraphQueryDto,
  ) {
    return await this.queryService.findNodes({
      tenantId,
      nodeType: query.nodeType,
      relationshipType: query.relationshipType,
      depth: query.depth,
      limit: query.limit,
      filters: query.filters,
    });
  }

  @Get('nodes/:nodeId/neighbors')
  async getNeighbors(
    @CurrentTenant() tenantId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Query('relationshipType') relationshipType?: string,
  ) {
    return await this.queryService.getNeighbors(
      tenantId,
      nodeId,
      relationshipType,
    );
  }

  @Get('nodes/:nodeId/traverse')
  async traverse(
    @CurrentTenant() tenantId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Query('maxDepth', ParseIntPipe) maxDepth?: number,
    @Query('relationshipType') relationshipType?: string,
    @Query('direction') direction?: 'outgoing' | 'incoming' | 'both',
  ) {
    return await this.queryService.traverse(tenantId, nodeId, {
      maxDepth,
      relationshipType,
      direction,
    });
  }

  @Get('path/shortest')
  async findShortestPath(
    @CurrentTenant() tenantId: number,
    @Query('from', ParseIntPipe) fromNodeId: number,
    @Query('to', ParseIntPipe) toNodeId: number,
  ) {
    return await this.queryService.findShortestPath(
      tenantId,
      fromNodeId,
      toNodeId,
    );
  }

  @Get('path/all')
  async findAllPaths(
    @CurrentTenant() tenantId: number,
    @Query('from', ParseIntPipe) fromNodeId: number,
    @Query('to', ParseIntPipe) toNodeId: number,
    @Query('maxDepth', ParseIntPipe) maxDepth?: number,
  ) {
    return await this.queryService.findAllPaths(
      tenantId,
      fromNodeId,
      toNodeId,
      maxDepth,
    );
  }

  @Get('statistics')
  async getStatistics(
    @CurrentTenant() tenantId: number,
    @Query('sourceSystem') sourceSystem?: string,
  ) {
    return await this.queryService.getStatistics(tenantId, sourceSystem);
  }

  @Get('search')
  async searchGraph(
    @CurrentTenant() tenantId: number,
    @Query('q') searchText: string,
    @Query('nodeType') nodeType?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return await this.queryService.searchNodes(
      tenantId,
      searchText,
      nodeType,
      limit,
    );
  }

  @Post('build/jira')
  async buildFromJira(
    @CurrentTenant() tenantId: number,
    @Body() body: { issues: any[]; projects: any[] },
  ) {
    return await this.builderService.buildFromJiraData(
      tenantId,
      body.issues,
      body.projects,
    );
  }

  @Post('build/slack')
  async buildFromSlack(
    @CurrentTenant() tenantId: number,
    @Body() body: { messages: any[]; channels: any[]; users: any[] },
  ) {
    return await this.builderService.buildFromSlackData(
      tenantId,
      body.messages,
      body.channels,
      body.users,
    );
  }

  @Post('build/teams')
  async buildFromTeams(
    @CurrentTenant() tenantId: number,
    @Body() body: { messages: any[]; channels: any[]; users: any[] },
  ) {
    return await this.builderService.buildFromTeamsData(
      tenantId,
      body.messages,
      body.channels,
      body.users,
    );
  }

  @Post('build/servicenow')
  async buildFromServiceNow(
    @CurrentTenant() tenantId: number,
    @Body() body: { incidents: any[]; users: any[] },
  ) {
    return await this.builderService.buildFromServiceNowData(
      tenantId,
      body.incidents,
      body.users,
    );
  }
}
