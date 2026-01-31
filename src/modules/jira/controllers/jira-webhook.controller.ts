import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { JiraWebhookService } from '../services/jira-webhook.service';
import { JiraWebhookDto } from '../dto/jira-webhook.dto';
import { Public } from '../../../common/decorators';

@ApiTags('Jira Webhooks')
@Controller('jira/webhooks')
export class JiraWebhookController {
  private readonly logger = new Logger(JiraWebhookController.name);

  constructor(private readonly webhookService: JiraWebhookService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive webhook from Jira',
    description: 'Public endpoint for receiving real-time updates from Jira. Configure this URL in your Jira webhook settings.'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid webhook data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async handleWebhook(@Body() webhookData: JiraWebhookDto) {
    this.logger.log(`Received Jira webhook: ${webhookData.webhookEvent}`);

    try {
      await this.webhookService.processWebhook(webhookData);
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }
}
