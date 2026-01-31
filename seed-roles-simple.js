const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedRoles() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'nexsentia_db',
  });

  try {
    console.log('Connected to database...');

    // Insert permissions
    console.log('Inserting permissions...');
    await connection.query(`
      INSERT INTO permissions (code, name, description, category, isActive, createdAt, updatedAt) VALUES
      ('users.create', 'Create Users', 'Create new users', 'users', 1, NOW(), NOW()),
      ('users.read', 'Read Users', 'View user details', 'users', 1, NOW(), NOW()),
      ('users.update', 'Update Users', 'Update user information', 'users', 1, NOW(), NOW()),
      ('users.delete', 'Delete Users', 'Delete users', 'users', 1, NOW(), NOW()),
      ('users.list', 'List Users', 'View list of users', 'users', 1, NOW(), NOW()),
      ('tenants.create', 'Create Tenants', 'Create new tenants', 'tenants', 1, NOW(), NOW()),
      ('tenants.read', 'Read Tenants', 'View tenant details', 'tenants', 1, NOW(), NOW()),
      ('tenants.update', 'Update Tenants', 'Update tenant information', 'tenants', 1, NOW(), NOW()),
      ('tenants.delete', 'Delete Tenants', 'Delete tenants', 'tenants', 1, NOW(), NOW()),
      ('tenants.list', 'List Tenants', 'View list of tenants', 'tenants', 1, NOW(), NOW()),
      ('roles.create', 'Create Roles', 'Create new roles', 'roles', 1, NOW(), NOW()),
      ('roles.read', 'Read Roles', 'View role details', 'roles', 1, NOW(), NOW()),
      ('roles.update', 'Update Roles', 'Update role information', 'roles', 1, NOW(), NOW()),
      ('roles.delete', 'Delete Roles', 'Delete roles', 'roles', 1, NOW(), NOW()),
      ('roles.list', 'List Roles', 'View list of roles', 'roles', 1, NOW(), NOW()),
      ('audit.read', 'Read Audit Logs', 'View audit logs', 'audit', 1, NOW(), NOW()),
      ('audit.list', 'List Audit Logs', 'View list of audit logs', 'audit', 1, NOW(), NOW()),
      ('reports.create', 'Create Reports', 'Create new reports', 'reports', 1, NOW(), NOW()),
      ('reports.read', 'Read Reports', 'View report details', 'reports', 1, NOW(), NOW()),
      ('reports.update', 'Update Reports', 'Update reports', 'reports', 1, NOW(), NOW()),
      ('reports.delete', 'Delete Reports', 'Delete reports', 'reports', 1, NOW(), NOW()),
      ('reports.list', 'List Reports', 'View list of reports', 'reports', 1, NOW(), NOW()),
      ('settings.read', 'Read Settings', 'View system settings', 'settings', 1, NOW(), NOW()),
      ('settings.update', 'Update Settings', 'Update system settings', 'settings', 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // Insert roles
    console.log('Inserting roles...');
    await connection.query(`
      INSERT INTO roles (code, name, description, isActive, isSystemRole, createdAt, updatedAt) VALUES
      ('super_admin', 'Super Admin', 'Full system access across all tenants', 1, 1, NOW(), NOW()),
      ('admin', 'Admin', 'Full access within tenant', 1, 1, NOW(), NOW()),
      ('analyst', 'Analyst', 'Can create and view reports', 1, 1, NOW(), NOW()),
      ('viewer', 'Viewer', 'Read-only access to reports', 1, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // Assign all permissions to super_admin
    console.log('Assigning permissions to super_admin...');
    await connection.query(`
      INSERT INTO role_permissions (roleId, permissionId)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'super_admin'
      ON DUPLICATE KEY UPDATE roleId=roleId
    `);

    // Assign permissions to admin
    console.log('Assigning permissions to admin...');
    await connection.query(`
      INSERT INTO role_permissions (roleId, permissionId)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.code = 'admin'
      AND p.code IN ('users.create', 'users.read', 'users.update', 'users.delete', 'users.list',
                     'roles.create', 'roles.read', 'roles.update', 'roles.delete', 'roles.list',
                     'audit.read', 'audit.list',
                     'reports.create', 'reports.read', 'reports.update', 'reports.delete', 'reports.list',
                     'settings.read', 'settings.update')
      ON DUPLICATE KEY UPDATE roleId=roleId
    `);

    // Assign permissions to analyst
    console.log('Assigning permissions to analyst...');
    await connection.query(`
      INSERT INTO role_permissions (roleId, permissionId)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.code = 'analyst'
      AND p.code IN ('users.read', 'reports.create', 'reports.read', 'reports.update', 'reports.list', 'settings.read')
      ON DUPLICATE KEY UPDATE roleId=roleId
    `);

    // Assign permissions to viewer
    console.log('Assigning permissions to viewer...');
    await connection.query(`
      INSERT INTO role_permissions (roleId, permissionId)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.code = 'viewer'
      AND p.code IN ('reports.read', 'reports.list')
      ON DUPLICATE KEY UPDATE roleId=roleId
    `);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nRoles created:');
    console.log('  - super_admin (all permissions)');
    console.log('  - admin (tenant administration)');
    console.log('  - analyst (reports and analysis)');
    console.log('  - viewer (read-only)');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\nDatabase connection closed.');
  }
}

seedRoles();
