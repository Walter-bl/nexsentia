import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.EMAIL_FROM || 'noreply@nexsentia.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Nexsentia',
}));
