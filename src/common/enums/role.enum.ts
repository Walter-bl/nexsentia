/**
 * User roles in the system following RBAC model
 * Values match MySQL ENUM in database
 */
export enum UserRole {
  // Super admin with full access
  SUPER_ADMIN = 'super_admin',

  // System administrators
  ADMIN = 'admin',

  // Manager role
  MANAGER = 'manager',

  // Analysts with read-only access (default)
  ANALYST = 'analyst',

  // Contributors
  CONTRIBUTOR = 'contributor',

  // Viewers (read-only)
  VIEWER = 'viewer',

  // Guest users
  GUEST = 'guest',
}
