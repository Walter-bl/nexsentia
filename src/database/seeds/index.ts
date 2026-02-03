import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../config/database/typeorm.config';
import { seedRolesAndPermissions } from './roles-permissions.seeder';
import { seedJiraData } from './jira.seeder';
import { seedSlackData } from './slack.seeder';
import { seedTeamsData } from './teams.seeder';
import { seedServiceNowData } from './servicenow.seeder';

// Load environment variables
config();

async function runSeeders() {
  try {
    console.log('Initializing database connection...');
    await dataSource.initialize();
    console.log('Database connection established');

    console.log('\n========================================');
    console.log('Starting database seeding...');
    console.log('========================================\n');

    // Run seeders in order
    await seedRolesAndPermissions(dataSource);

    // Seed integration demo data for tenant 1
    const demoTenantId = 1;
    console.log(`\n📦 Seeding integration demo data for tenant ${demoTenantId}...\n`);

    await seedJiraData(dataSource, demoTenantId);
    await seedSlackData(dataSource, demoTenantId);
    await seedTeamsData(dataSource, demoTenantId);
    await seedServiceNowData(dataSource, demoTenantId);

    console.log('\n========================================');
    console.log('Database seeding completed successfully!');
    console.log('========================================\n');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('Error during seeding:');
    console.error('========================================\n');
    console.error(error);

    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    process.exit(1);
  }
}

runSeeders();
