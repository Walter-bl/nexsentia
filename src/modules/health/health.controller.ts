import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators';

@ApiTags('Health')
@Controller({ path: '' })
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API Root / Health Check' })
  @ApiResponse({
    status: 200,
    description: 'API is running',
    schema: {
      example: {
        message: 'Nexsentia API is running',
        version: '1.0.0',
        status: 'healthy',
        timestamp: '2024-01-18T12:00:00.000Z',
        documentation: '/api/docs',
      },
    },
  })
  getRoot() {
    return {
      message: 'Nexsentia API is running',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      documentation: '/api/docs',
    };
  }

  @Public()
  @Get('/health')
  @ApiOperation({ summary: 'Health Check Endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      example: {
        status: 'ok',
        uptime: 12345.67,
        timestamp: '2024-01-18T12:00:00.000Z',
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('/ping')
  @ApiOperation({ summary: 'Simple Ping Endpoint' })
  @ApiResponse({ status: 200, description: 'Returns pong', schema: { example: { message: 'pong' } } })
  ping() {
    return { message: 'pong' };
  }
}
