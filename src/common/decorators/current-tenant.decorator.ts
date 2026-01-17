import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get the current tenant ID from authenticated user
 */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.tenantId;
});
