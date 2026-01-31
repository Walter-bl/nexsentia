import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JiraIssueService } from '../services/jira-issue.service';
import { QueryJiraIssueDto } from '../dto/query-jira-issue.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { UserRole } from '../../../common/enums';

@ApiTags('Jira Issues')
@Controller('jira/issues')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class JiraIssueController {
  constructor(private readonly issueService: JiraIssueService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.ANALYST)
  @ApiOperation({ summary: 'Get all Jira issues with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'List of Jira issues' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query() query: QueryJiraIssueDto,
  ) {
    return await this.issueService.findAll(tenantId, query);
  }

  @Get('key/:issueKey')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.ANALYST)
  @ApiOperation({ summary: 'Get issue by Jira key' })
  @ApiParam({ name: 'issueKey', description: 'Jira issue key (e.g., PROJ-123)' })
  @ApiResponse({ status: 200, description: 'Issue found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  async findByKey(
    @CurrentTenant() tenantId: number,
    @Param('issueKey') issueKey: string,
  ) {
    return await this.issueService.findByKey(tenantId, issueKey);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.ANALYST)
  @ApiOperation({ summary: 'Get issue by ID' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  @ApiResponse({ status: 200, description: 'Issue found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  async findOne(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.issueService.findOne(tenantId, id);
  }
}
