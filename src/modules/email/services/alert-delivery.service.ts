import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import axios from 'axios';
import { AlertHistory } from '../entities/alert-history.entity';
import { AlertSubscription } from '../entities/alert-subscription.entity';
import { AlertRule } from '../entities/alert-rule.entity';
import { User } from '../../users/entities/user.entity';
import { AlertRateLimiterService } from './alert-rate-limiter.service';

interface AlertPayload {
  tenantId: number;
  ruleId: number;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sourceType: string;
  sourceId?: string;
  sourceData?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface DeliveryResult {
  success: boolean;
  alertHistory: AlertHistory;
  deliveryStatus: {
    email?: { sent: boolean; error?: string; messageId?: string };
    slack?: { sent: boolean; error?: string; messageTs?: string };
  };
}

@Injectable()
export class AlertDeliveryService {
  private readonly logger = new Logger(AlertDeliveryService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly appUrl: string;

  constructor(
    @InjectRepository(AlertHistory)
    private readonly historyRepository: Repository<AlertHistory>,
    @InjectRepository(AlertSubscription)
    private readonly subscriptionRepository: Repository<AlertSubscription>,
    @InjectRepository(AlertRule)
    private readonly ruleRepository: Repository<AlertRule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly rateLimiter: AlertRateLimiterService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@nexsentia.com';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'Nexsentia Alerts';
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3001';

    this.resend = new Resend(apiKey);
  }

  /**
   * Deliver an alert to all subscribed users
   */
  async deliverAlert(payload: AlertPayload): Promise<DeliveryResult[]> {
    this.logger.log(`Delivering alert for rule ${payload.ruleId}: ${payload.title}`);

    // Get all active subscriptions for this rule
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        tenantId: payload.tenantId,
        ruleId: payload.ruleId,
        isActive: true,
      },
      relations: ['user'],
    });

    if (subscriptions.length === 0) {
      this.logger.warn(`No active subscriptions found for rule ${payload.ruleId}`);
      return [];
    }

    const results: DeliveryResult[] = [];

    for (const subscription of subscriptions) {
      try {
        const result = await this.deliverToUser(payload, subscription);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to deliver alert to user ${subscription.userId}:`,
          error,
        );
      }
    }

    return results;
  }

  /**
   * Deliver alert to a specific user based on their subscription
   */
  private async deliverToUser(
    payload: AlertPayload,
    subscription: AlertSubscription,
  ): Promise<DeliveryResult> {
    const user = subscription.user;

    // Check rate limiting
    const rateLimitCheck = await this.rateLimiter.checkRateLimit(
      payload.tenantId,
      payload.ruleId,
      user.id,
      payload.sourceId,
    );

    if (!rateLimitCheck.allowed) {
      // Create suppressed alert history
      const alertHistory = await this.createAlertHistory(
        payload,
        user.id,
        'suppressed',
        [],
      );

      alertHistory.suppressedUntil = rateLimitCheck.suppressedUntil;
      alertHistory.suppressionReason = rateLimitCheck.reason;
      await this.historyRepository.save(alertHistory);

      this.logger.log(
        `Alert suppressed for user ${user.id}: ${rateLimitCheck.reason}`,
      );

      return {
        success: false,
        alertHistory,
        deliveryStatus: {},
      };
    }

    // Determine which channels to use
    const channels = this.getActiveChannels(subscription);

    const deliveryStatus: any = {};
    let overallSuccess = false;

    // Send via Email
    if (channels.includes('email')) {
      const emailResult = await this.sendEmailAlert(payload, user, subscription);
      deliveryStatus.email = emailResult;
      if (emailResult.sent) overallSuccess = true;
    }

    // Send via Slack
    if (channels.includes('slack')) {
      const slackResult = await this.sendSlackAlert(payload, subscription);
      deliveryStatus.slack = slackResult;
      if (slackResult.sent) overallSuccess = true;
    }

    // Create alert history
    const alertHistory = await this.createAlertHistory(
      payload,
      user.id,
      overallSuccess ? 'sent' : 'failed',
      channels,
    );

    alertHistory.deliveryStatus = deliveryStatus;
    alertHistory.sentAt = overallSuccess ? new Date() : undefined;
    await this.historyRepository.save(alertHistory);

    return {
      success: overallSuccess,
      alertHistory,
      deliveryStatus,
    };
  }

  /**
   * Send alert via email
   */
  private async sendEmailAlert(
    payload: AlertPayload,
    user: User,
    subscription: AlertSubscription,
  ): Promise<{ sent: boolean; error?: string; messageId?: string }> {
    try {
      const emailAddress =
        subscription.channels.email?.address || user.email;

      const html = this.getAlertEmailTemplate(payload, user);

      const response = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: emailAddress,
        subject: payload.title,
        html,
      });

      this.logger.log(`Alert email sent to ${emailAddress}`);

      return {
        sent: true,
        messageId: response.data?.id || 'unknown',
      };
    } catch (error: any) {
      this.logger.error(`Failed to send alert email:`, error);
      return {
        sent: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Send alert via Slack
   */
  private async sendSlackAlert(
    payload: AlertPayload,
    subscription: AlertSubscription,
  ): Promise<{ sent: boolean; error?: string; messageTs?: string }> {
    try {
      const webhookUrl = subscription.channels.slack?.webhookUrl;

      if (!webhookUrl) {
        return {
          sent: false,
          error: 'No Slack webhook URL configured',
        };
      }

      const slackMessage = this.getSlackMessagePayload(payload);

      const response = await axios.post(webhookUrl, slackMessage);

      this.logger.log(`Alert sent to Slack`);

      return {
        sent: true,
        messageTs: response.data.ts,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send Slack alert:`, error);
      return {
        sent: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Get active delivery channels for a subscription
   */
  private getActiveChannels(subscription: AlertSubscription): string[] {
    const channels: string[] = [];

    if (subscription.channels.email?.enabled) {
      channels.push('email');
    }

    if (subscription.channels.slack?.enabled) {
      channels.push('slack');
    }

    return channels;
  }

  /**
   * Create alert history record
   */
  private async createAlertHistory(
    payload: AlertPayload,
    userId: number,
    status: 'pending' | 'sent' | 'failed' | 'suppressed',
    channels: string[],
  ): Promise<AlertHistory> {
    const alertHistory = this.historyRepository.create({
      tenantId: payload.tenantId,
      ruleId: payload.ruleId,
      userId,
      title: payload.title,
      message: payload.message,
      severity: payload.severity,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      sourceData: payload.sourceData,
      deliveryChannels: channels,
      status,
      metadata: payload.metadata,
    });

    return await this.historyRepository.save(alertHistory);
  }

  /**
   * Get email template for alert
   */
  private getAlertEmailTemplate(payload: AlertPayload, user: User): string {
    const severityColors = {
      critical: '#DC2626',
      high: '#EA580C',
      medium: '#F59E0B',
      low: '#10B981',
    };

    const severityColor = severityColors[payload.severity];

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${severityColor}; color: white; padding: 20px; border-radius: 6px 6px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; }
            .button { background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
            .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; background-color: ${severityColor}; color: white; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            pre { background-color: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">🚨 Alert: ${payload.title}</h2>
            </div>
            <div class="content">
              <p>Hi ${user.firstName},</p>
              <p>An alert has been triggered based on your subscription rules.</p>

              <div style="margin: 20px 0;">
                <strong>Severity:</strong> <span class="severity-badge">${payload.severity}</span>
              </div>

              <div style="margin: 20px 0;">
                <strong>Source:</strong> ${payload.sourceType}
                ${payload.sourceId ? `<br><strong>ID:</strong> ${payload.sourceId}` : ''}
              </div>

              <div style="margin: 20px 0;">
                <strong>Message:</strong>
                <pre>${payload.message}</pre>
              </div>

              <a href="${this.appUrl}/alerts" class="button">View in Dashboard</a>
            </div>
            <div class="footer">
              <p>This is an automated alert from Nexsentia. To manage your alert preferences, visit your account settings.</p>
              <p>© ${new Date().getFullYear()} Nexsentia. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get Slack message payload
   */
  private getSlackMessagePayload(payload: AlertPayload): any {
    const severityEmojis = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    const emoji = severityEmojis[payload.severity];

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${payload.title}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${payload.severity.toUpperCase()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Source:*\n${payload.sourceType}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n\`\`\`${payload.message}\`\`\``,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View in Dashboard',
              },
              url: `${this.appUrl}/alerts`,
              style: 'primary',
            },
          ],
        },
      ],
    };
  }

  /**
   * Get alert delivery statistics
   */
  async getDeliveryStats(tenantId: number, hours: number = 24): Promise<{
    total: number;
    sent: number;
    failed: number;
    suppressed: number;
    byChannel: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const alerts = await this.historyRepository.find({
      where: {
        tenantId,
        createdAt: MoreThan(since),
      },
    });

    const stats = {
      total: alerts.length,
      sent: alerts.filter(a => a.status === 'sent').length,
      failed: alerts.filter(a => a.status === 'failed').length,
      suppressed: alerts.filter(a => a.status === 'suppressed').length,
      byChannel: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
    };

    alerts.forEach(alert => {
      // Count by channel
      alert.deliveryChannels.forEach(channel => {
        stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
      });

      // Count by severity
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
    });

    return stats;
  }
}
