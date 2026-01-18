import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to skip automatic audit logging for specific routes
 * Usage: @SkipAudit()
 */
export const SkipAudit = () => SetMetadata('skipAudit', true);
