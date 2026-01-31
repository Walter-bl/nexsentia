import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlackConnection } from './entities/slack-connection.entity';
import { SlackChannel } from './entities/slack-channel.entity';
import { SlackUser } from './entities/slack-user.entity';
import { SlackMessage } from './entities/slack-message.entity';
import { SlackSyncHistory } from './entities/slack-sync-history.entity';
import { SlackOAuthService } from './services/slack-oauth.service';
import { SlackApiClientService } from './services/slack-api-client.service';
import { SlackIngestionService } from './services/slack-ingestion.service';
import { SlackConnectionService } from './services/slack-connection.service';
import { SlackMessageService } from './services/slack-message.service';
import { SlackOAuthController } from './controllers/slack-oauth.controller';
import { SlackConnectionController } from './controllers/slack-connection.controller';
import { SlackMessageController } from './controllers/slack-message.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SlackConnection,
      SlackChannel,
      SlackUser,
      SlackMessage,
      SlackSyncHistory,
    ]),
  ],
  controllers: [
    SlackOAuthController,
    SlackConnectionController,
    SlackMessageController,
  ],
  providers: [
    SlackOAuthService,
    SlackApiClientService,
    SlackIngestionService,
    SlackConnectionService,
    SlackMessageService,
  ],
  exports: [
    SlackConnectionService,
    SlackMessageService,
    SlackIngestionService,
    SlackOAuthService,
  ],
})
export class SlackModule {}
