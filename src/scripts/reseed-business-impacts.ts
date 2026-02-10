import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../config/database/typeorm.config';
import { seedBusinessImpacts } from '../database/seeds/business-impact.seeder';

// Load environment variables
config();

async function reseedBusinessImpacts() {
  try {
    console.log('Initializing database connection...');
    console.log(`Connecting to: ${process.env.DB_HOST}/${process.env.DB_DATABASE}`);

    await dataSource.initialize();
    console.log('Database connection established');

    const tenantId = 1; // Live tenant ID

    console.log('\n========================================');
    console.log('Re-seeding business impacts...');
    console.log('========================================\n');

    // The seeder will delete existing impacts and create new ones
    await seedBusinessImpacts(dataSource, tenantId);

    console.log('\n========================================');
    console.log('Business impacts re-seeding completed!');
    console.log('========================================\n');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('Error during re-seeding:');
    console.error('========================================\n');
    console.error(error);

    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    process.exit(1);
  }
}

reseedBusinessImpacts();
