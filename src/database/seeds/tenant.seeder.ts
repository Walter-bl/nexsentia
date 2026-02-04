import { DataSource } from 'typeorm';
import { Tenant } from '../../modules/tenants/entities/tenant.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import * as bcrypt from 'bcrypt';

export async function seedDemoTenant(dataSource: DataSource): Promise<number> {
  const tenantRepo = dataSource.getRepository(Tenant);
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);

  console.log('🏢 Seeding demo tenant...');

  // Check if demo tenant already exists
  let tenant = await tenantRepo.findOne({
    where: { slug: 'demo-tenant' },
  });

  if (!tenant) {
    // Create demo tenant
    tenant = tenantRepo.create({
      name: 'Demo Organization',
      slug: 'demo-tenant',
      contactEmail: 'demo@nexsentia.com',
      isActive: true,
    });
    await tenantRepo.save(tenant);
    console.log(`  ✅ Created demo tenant (ID: ${tenant.id})`);
  } else {
    console.log(`  ℹ️  Demo tenant already exists (ID: ${tenant.id})`);
  }

  // Check if demo user exists
  const existingUser = await userRepo.findOne({
    where: { email: 'demo@nexsentia.com', tenantId: tenant.id },
  });

  if (!existingUser) {
    // Get ANALYST role
    const analystRole = await roleRepo.findOne({
      where: { code: 'analyst' },
    });

    if (analystRole) {
      // Create demo user
      const hashedPassword = await bcrypt.hash('Demo@123', 10);
      const user = userRepo.create({
        email: 'demo@nexsentia.com',
        firstName: 'Demo',
        lastName: 'User',
        password: hashedPassword,
        tenantId: tenant.id,
        isActive: true,
        isEmailVerified: true,
        roles: [analystRole],
      });
      await userRepo.save(user);
      console.log('  ✅ Created demo user (email: demo@nexsentia.com, password: Demo@123)');
    }
  } else {
    console.log('  ℹ️  Demo user already exists');
  }

  console.log('');
  return tenant.id;
}
