import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../config/database/typeorm.config';
import { seedSlackData } from '../database/seeds/slack.seeder';
import { seedTeamsData } from '../database/seeds/teams.seeder';

// Load environment variables
config();

async function seedCommunicationData() {
  try {
    console.log('Initializing database connection...');
    console.log(`Connecting to: ${process.env.DB_HOST}/${process.env.DB_DATABASE}`);

    await dataSource.initialize();
    console.log('Database connection established');

    const tenantId = 1; // Live tenant ID

    console.log('\n========================================');
    console.log('Seeding Slack and Teams data...');
    console.log('========================================\n');

    console.log('Starting Slack seeding...');
    await seedSlackData(dataSource, tenantId);
    console.log('✅ Slack seeding completed\n');

    console.log('Starting Teams seeding...');
    await seedTeamsData(dataSource, tenantId);
    console.log('✅ Teams seeding completed\n');

    console.log('\n========================================');
    console.log('Communication data seeding completed!');
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

seedCommunicationData();
