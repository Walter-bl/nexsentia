import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { ServiceNowConnection } from './entities/servicenow-connection.entity';
import { ServiceNowIncident } from './entities/servicenow-incident.entity';
import { ServiceNowChange } from './entities/servicenow-change.entity';
import { ServiceNowUser } from './entities/servicenow-user.entity';
import { ServiceNowSyncHistory } from './entities/servicenow-sync-history.entity';

// Services
import { ServiceNowOAuthService } from './services/servicenow-oauth.service';
import { ServiceNowApiClientService } from './services/servicenow-api-client.service';
import { ServiceNowIngestionService } from './services/servicenow-ingestion.service';
import { ServiceNowConnectionService } from './services/servicenow-connection.service';

// Controllers
import { ServiceNowOAuthController } from './controllers/servicenow-oauth.controller';
import { ServiceNowConnectionController } from './controllers/servicenow-connection.controller';
import { ServiceNowIncidentController } from './controllers/servicenow-incident.controller';
import { ServiceNowChangeController } from './controllers/servicenow-change.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceNowConnection,
      ServiceNowIncident,
      ServiceNowChange,
      ServiceNowUser,
      ServiceNowSyncHistory,
    ]),
  ],
  controllers: [
    ServiceNowOAuthController,
    ServiceNowConnectionController,
    ServiceNowIncidentController,
    ServiceNowChangeController,
  ],
  providers: [
    ServiceNowOAuthService,
    ServiceNowApiClientService,
    ServiceNowIngestionService,
    ServiceNowConnectionService,
  ],
  exports: [
    ServiceNowOAuthService,
    ServiceNowApiClientService,
    ServiceNowIngestionService,
    ServiceNowConnectionService,
  ],
})
export class ServiceNowModule {}
