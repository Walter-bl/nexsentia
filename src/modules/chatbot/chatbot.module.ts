import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { ChatbotController } from './controllers/chatbot.controller';

// Services
import { ChatbotService } from './services/chatbot.service';
import { OpenAIService } from './services/openai.service';
import { ContextRetrievalService } from './services/context-retrieval.service';

// Entities
import { Conversation } from './entities/conversation.entity';
import { WeakSignal } from '../weak-signals/entities/weak-signal.entity';
import { JiraIssue } from '../jira/entities/jira-issue.entity';
import { ServiceNowIncident } from '../servicenow/entities/servicenow-incident.entity';
import { SlackMessage } from '../slack/entities/slack-message.entity';
import { TeamsMessage } from '../teams/entities/teams-message.entity';
import { GmailMessage } from '../gmail/entities/gmail-message.entity';
import { OutlookMessage } from '../outlook/entities/outlook-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      WeakSignal,
      JiraIssue,
      ServiceNowIncident,
      SlackMessage,
      TeamsMessage,
      GmailMessage,
      OutlookMessage,
    ]),
    ConfigModule,
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, OpenAIService, ContextRetrievalService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
