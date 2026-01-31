import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsConnection } from './entities/teams-connection.entity';
import { TeamsChannel } from './entities/teams-channel.entity';
import { TeamsUser } from './entities/teams-user.entity';
import { TeamsMessage } from './entities/teams-message.entity';
import { TeamsSyncHistory } from './entities/teams-sync-history.entity';
import { TeamsOAuthService } from './services/teams-oauth.service';
import { TeamsApiClientService } from './services/teams-api-client.service';
import { TeamsIngestionService } from './services/teams-ingestion.service';
import { TeamsConnectionService } from './services/teams-connection.service';
import { TeamsMessageService } from './services/teams-message.service';
import { TeamsOAuthController } from './controllers/teams-oauth.controller';
import { TeamsConnectionController } from './controllers/teams-connection.controller';
import { TeamsMessageController } from './controllers/teams-message.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeamsConnection,
      TeamsChannel,
      TeamsUser,
      TeamsMessage,
      TeamsSyncHistory,
    ]),
  ],
  controllers: [
    TeamsOAuthController,
    TeamsConnectionController,
    TeamsMessageController,
  ],
  providers: [
    TeamsOAuthService,
    TeamsApiClientService,
    TeamsIngestionService,
    TeamsConnectionService,
    TeamsMessageService,
  ],
  exports: [
    TeamsConnectionService,
    TeamsMessageService,
    TeamsIngestionService,
    TeamsOAuthService,
  ],
})
export class TeamsModule {}
