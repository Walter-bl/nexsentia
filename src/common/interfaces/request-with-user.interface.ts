import { Request } from 'express';

/**
 * Extended request interface with authenticated user
 */
export interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    tenantId: number;
    role: string;
    permissions: string[];
  };
}
