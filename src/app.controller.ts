import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from './common/decorators';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API Root / Health Check' })
  @ApiResponse({
    status: 200,
    description: 'API is running',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Nexsentia API is running' },
        version: { type: 'string', example: '1.0.0' },
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2024-01-18T12:00:00.000Z' },
        documentation: { type: 'string', example: '/api/docs' },
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
  @Get('health')
  @ApiOperation({ summary: 'Health Check Endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        uptime: { type: 'number', example: 12345.67 },
        timestamp: { type: 'string', example: '2024-01-18T12:00:00.000Z' },
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
  @Get('ping')
  @ApiOperation({ summary: 'Simple Ping Endpoint' })
  @ApiResponse({ status: 200, description: 'Returns pong' })
  ping() {
    return { message: 'pong' };
  }
}
