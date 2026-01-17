import { UserRole } from '../enums';

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: number; // User ID
  email: string;
  tenantId: number;
  role: UserRole;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * JWT refresh token payload
 */
export interface JwtRefreshPayload {
  sub: number;
  tokenId: string;
  iat?: number;
  exp?: number;
}
