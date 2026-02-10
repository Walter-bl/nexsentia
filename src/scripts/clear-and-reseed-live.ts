import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../config/database/typeorm.config';

// Load environment variables
config();

async function clearAndReseedLive() {
  try {
    console.log('Initializing database connection...');
    console.log(`Connecting to: ${process.env.DB_HOST}/${process.env.DB_DATABASE}`);

    await dataSource.initialize();
    console.log('Database connection established');

    const tenantId = 1; // Live tenant ID

    console.log('\n========================================');
    console.log('Clearing old integration data...');
    console.log('========================================\n');

    // Delete all integration messages for tenant 1
    console.log('Deleting Slack messages...');
    const slackResult = await dataSource.query(`DELETE FROM slack_messages WHERE tenantId = ?`, [tenantId]);
    console.log(`✓ Deleted ${slackResult.affectedRows} Slack messages`);

    console.log('Deleting Teams messages...');
    const teamsResult = await dataSource.query(`DELETE FROM teams_messages WHERE tenantId = ?`, [tenantId]);
    console.log(`✓ Deleted ${teamsResult.affectedRows} Teams messages`);

    console.log('Deleting Jira issues...');
    const jiraResult = await dataSource.query(`DELETE FROM jira_issues WHERE tenantId = ?`, [tenantId]);
    console.log(`✓ Deleted ${jiraResult.affectedRows} Jira issues`);

    console.log('Deleting ServiceNow incidents...');
    const serviceNowResult = await dataSource.query(`DELETE FROM servicenow_incidents WHERE tenantId = ?`, [tenantId]);
    console.log(`✓ Deleted ${serviceNowResult.affectedRows} ServiceNow incidents`);

    console.log('Deleting weak signals...');
    const weakSignalsResult = await dataSource.query(`DELETE FROM weak_signals WHERE tenantId = ?`, [tenantId]);
    console.log(`✓ Deleted ${weakSignalsResult.affectedRows} weak signals`);

    console.log('Deleting detection runs...');
    const detectionRunsResult = await dataSource.query(`DELETE FROM detection_runs WHERE tenantId = ?`, [tenantId]);
    console.log(`✓ Deleted ${detectionRunsResult.affectedRows} detection runs`);

    console.log('\n✅ All old data cleared successfully!\n');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('Error during cleanup:');
    console.error('========================================\n');
    console.error(error);

    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    process.exit(1);
  }
}

clearAndReseedLive();
