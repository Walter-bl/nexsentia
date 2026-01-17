import { DataSource } from 'typeorm';
import { Role } from '../../modules/roles/entities/role.entity';
import { Permission } from '../../modules/permissions/entities/permission.entity';

export async function seedRolesAndPermissions(dataSource: DataSource): Promise<void> {
  const permissionRepository = dataSource.getRepository(Permission);
  const roleRepository = dataSource.getRepository(Role);

  console.log('Seeding permissions...');

  // Define all permissions
  const permissionsData = [
    // User permissions
    { code: 'users.create', name: 'Create Users', description: 'Create new users', category: 'users' },
    { code: 'users.read', name: 'Read Users', description: 'View user details', category: 'users' },
    { code: 'users.update', name: 'Update Users', description: 'Update user information', category: 'users' },
    { code: 'users.delete', name: 'Delete Users', description: 'Delete users', category: 'users' },
    { code: 'users.list', name: 'List Users', description: 'View list of users', category: 'users' },

    // Tenant permissions
    { code: 'tenants.create', name: 'Create Tenants', description: 'Create new tenants', category: 'tenants' },
    { code: 'tenants.read', name: 'Read Tenants', description: 'View tenant details', category: 'tenants' },
    { code: 'tenants.update', name: 'Update Tenants', description: 'Update tenant information', category: 'tenants' },
    { code: 'tenants.delete', name: 'Delete Tenants', description: 'Delete tenants', category: 'tenants' },
    { code: 'tenants.list', name: 'List Tenants', description: 'View list of tenants', category: 'tenants' },

    // Role permissions
    { code: 'roles.create', name: 'Create Roles', description: 'Create new roles', category: 'roles' },
    { code: 'roles.read', name: 'Read Roles', description: 'View role details', category: 'roles' },
    { code: 'roles.update', name: 'Update Roles', description: 'Update role information', category: 'roles' },
    { code: 'roles.delete', name: 'Delete Roles', description: 'Delete roles', category: 'roles' },
    { code: 'roles.list', name: 'List Roles', description: 'View list of roles', category: 'roles' },

    // Audit permissions
    { code: 'audit.read', name: 'Read Audit Logs', description: 'View audit logs', category: 'audit' },
    { code: 'audit.list', name: 'List Audit Logs', description: 'View list of audit logs', category: 'audit' },

    // Report permissions
    { code: 'reports.create', name: 'Create Reports', description: 'Create new reports', category: 'reports' },
    { code: 'reports.read', name: 'Read Reports', description: 'View report details', category: 'reports' },
    { code: 'reports.update', name: 'Update Reports', description: 'Update reports', category: 'reports' },
    { code: 'reports.delete', name: 'Delete Reports', description: 'Delete reports', category: 'reports' },
    { code: 'reports.list', name: 'List Reports', description: 'View list of reports', category: 'reports' },

    // Settings permissions
    { code: 'settings.read', name: 'Read Settings', description: 'View system settings', category: 'settings' },
    { code: 'settings.update', name: 'Update Settings', description: 'Update system settings', category: 'settings' },
  ];

  // Create or update permissions
  const permissions: Permission[] = [];
  for (const permData of permissionsData) {
    let permission = await permissionRepository.findOne({ where: { code: permData.code } });
    if (!permission) {
      permission = permissionRepository.create({ ...permData, isActive: true });
      await permissionRepository.save(permission);
      console.log(`Created permission: ${permData.code}`);
    } else {
      console.log(`Permission already exists: ${permData.code}`);
    }
    permissions.push(permission);
  }

  console.log('Seeding roles...');

  // Define roles with their permissions
  const rolesData = [
    {
      code: 'super_admin',
      name: 'Super Admin',
      description: 'Full system access across all tenants',
      permissionCodes: permissionsData.map(p => p.code), // All permissions
    },
    {
      code: 'admin',
      name: 'Admin',
      description: 'Full access within tenant',
      permissionCodes: [
        'users.create', 'users.read', 'users.update', 'users.delete', 'users.list',
        'roles.create', 'roles.read', 'roles.update', 'roles.delete', 'roles.list',
        'audit.read', 'audit.list',
        'reports.create', 'reports.read', 'reports.update', 'reports.delete', 'reports.list',
        'settings.read', 'settings.update',
      ],
    },
    {
      code: 'analyst',
      name: 'Analyst',
      description: 'Can create and view reports',
      permissionCodes: [
        'users.read',
        'reports.create', 'reports.read', 'reports.update', 'reports.list',
        'settings.read',
      ],
    },
    {
      code: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to reports',
      permissionCodes: [
        'reports.read', 'reports.list',
      ],
    },
  ];

  // Create or update roles
  for (const roleData of rolesData) {
    let role = await roleRepository.findOne({
      where: { code: roleData.code },
      relations: ['permissions'],
    });

    const rolePermissions = permissions.filter(p => roleData.permissionCodes.includes(p.code));

    if (!role) {
      role = roleRepository.create({
        code: roleData.code,
        name: roleData.name,
        description: roleData.description,
        isActive: true,
        permissions: rolePermissions,
      });
      await roleRepository.save(role);
      console.log(`Created role: ${roleData.code} with ${rolePermissions.length} permissions`);
    } else {
      role.name = roleData.name;
      role.description = roleData.description;
      role.permissions = rolePermissions;
      await roleRepository.save(role);
      console.log(`Updated role: ${roleData.code} with ${rolePermissions.length} permissions`);
    }
  }

  console.log('Roles and permissions seeding completed!');
}
