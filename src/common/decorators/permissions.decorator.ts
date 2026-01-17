import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required permissions for a route
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
