import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums';

/**
 * Decorator to specify required roles for a route
 */
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
