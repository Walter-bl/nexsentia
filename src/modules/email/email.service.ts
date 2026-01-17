import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.resendApiKey') || '';
    this.fromEmail = this.configService.get<string>('email.fromEmail') || 'noreply@nexsentia.com';
    this.fromName = this.configService.get<string>('email.fromName') || 'Nexsentia';

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured. Email sending will fail.');
    }

    this.resend = new Resend(apiKey);
  }

  async sendPasswordResetEmail(to: string, resetToken: string, firstName: string): Promise<void> {
    try {
      const resetUrl = `${this.configService.get<string>('APP_URL', 'http://localhost:3001')}/reset-password?token=${resetToken}`;

      await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject: 'Reset Your Password',
        html: this.getPasswordResetTemplate(firstName, resetUrl),
      });

      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject: 'Welcome to Nexsentia',
        html: this.getWelcomeTemplate(firstName),
      });

      this.logger.log(`Welcome email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}:`, error);
      // Don't throw error for welcome emails - it's not critical
    }
  }

  async sendPasswordChangedEmail(to: string, firstName: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject: 'Password Changed Successfully',
        html: this.getPasswordChangedTemplate(firstName),
      });

      this.logger.log(`Password changed confirmation email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${to}:`, error);
      // Don't throw error - it's not critical
    }
  }

  private getPasswordResetTemplate(firstName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Reset Your Password</h2>
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Nexsentia. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Welcome to Nexsentia!</h2>
            <p>Hi ${firstName},</p>
            <p>Thank you for joining Nexsentia. We're excited to have you on board!</p>
            <p>Get started by exploring our platform and discovering weak signals in your organization.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Nexsentia. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordChangedTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Changed Successfully</h2>
            <p>Hi ${firstName},</p>
            <p>Your password has been changed successfully.</p>
            <p>If you didn't make this change, please contact support immediately.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Nexsentia. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
