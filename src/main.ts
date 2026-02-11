import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bodyParser: true,
  });

  const configService = app.get(ConfigService);

  // Set server timeout to 5 minutes for slow operations
  const server = app.getHttpServer();
  server.setTimeout(300000); // 5 minutes
  server.keepAliveTimeout = 305000; // Slightly higher than setTimeout

  // Security
  app.use(helmet());

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGIN')?.split(',') || ['*'];
  app.enableCors({
    origin: corsOrigins,
    credentials: configService.get<boolean>('CORS_CREDENTIALS', true),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tenant-Id',
      'Accept',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  });

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', 'health', 'ping'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
      stopAtFirstError: false, // Return all validation errors, not just the first one
      exceptionFactory: (errors) => {
        // Custom exception factory for better error messages
        const messages = errors.map(error => {
          const constraints = error.constraints;
          return {
            field: error.property,
            errors: constraints ? Object.values(constraints) : ['Validation failed'],
          };
        });
        return new BadRequestException(messages);
      },
    }),
  );

  // Global exception filters
  app.useGlobalFilters(new ValidationExceptionFilter());

  // Swagger documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Nexsentia API')
      .setDescription('Organizational & Business Weak-Signal Detection Platform API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-Tenant-Id',
          in: 'header',
          description: 'Tenant identifier for multi-tenancy',
        },
        'TenantId',
      )
      .addTag('Authentication', 'Authentication and authorization endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Tenants', 'Multi-tenant management')
      .addTag('Roles', 'Role-based access control')
      .addTag('Audit', 'Audit log management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`
    ╔══════════════════════════════════════════════════╗
    ║                                                  ║
    ║           NEXSENTIA API STARTED                  ║
    ║                                                  ║
    ║   Application: http://localhost:${port}/${apiPrefix}      ║
    ║   Documentation: http://localhost:${port}/api/docs  ║
    ║   Environment: ${configService.get<string>('NODE_ENV')}                      ║
    ║                                                  ║
    ╚══════════════════════════════════════════════════╝
  `);
}

bootstrap();
