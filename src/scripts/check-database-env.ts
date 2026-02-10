import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../config/database/typeorm.config';

config();

async function checkDatabaseEnv() {
  try {
    await dataSource.initialize();

    console.log('\n========================================');
    console.log('DATABASE CONFIGURATION');
    console.log('========================================');
    console.log('Host:', process.env.DB_HOST);
    console.log('Port:', process.env.DB_PORT);
    console.log('Database:', process.env.DB_DATABASE);
    console.log('Username:', process.env.DB_USERNAME);
    console.log('\n========================================');
    console.log('DATABASE CONTENTS');
    console.log('========================================');

    // Count teams
    const serviceNowTeams = await dataSource.query(`
      SELECT COUNT(DISTINCT assignmentGroupName) as count
      FROM servicenow_incidents
      WHERE tenantId = 1
    `);

    const jiraTeams = await dataSource.query(`
      SELECT COUNT(DISTINCT p.name) as count
      FROM jira_issues i
      LEFT JOIN jira_projects p ON i.projectId = p.id
      WHERE i.tenantId = 1
    `);

    const totalTeams = serviceNowTeams[0].count + jiraTeams[0].count;

    console.log('ServiceNow teams:', serviceNowTeams[0].count);
    console.log('Jira teams:', jiraTeams[0].count);
    console.log('Total teams:', totalTeams);

    // Count incidents and issues
    const incidents = await dataSource.query(`
      SELECT COUNT(*) as count FROM servicenow_incidents WHERE tenantId = 1
    `);

    const issues = await dataSource.query(`
      SELECT COUNT(*) as count FROM jira_issues WHERE tenantId = 1
    `);

    const slackMessages = await dataSource.query(`
      SELECT COUNT(*) as count FROM slack_messages WHERE tenantId = 1
    `);

    const teamsMessages = await dataSource.query(`
      SELECT COUNT(*) as count FROM teams_messages WHERE tenantId = 1
    `);

    console.log('\nServiceNow incidents:', incidents[0].count);
    console.log('Jira issues:', issues[0].count);
    console.log('Slack messages:', slackMessages[0].count);
    console.log('Teams messages:', teamsMessages[0].count);

    console.log('\n========================================\n');

    if (process.env.DB_HOST && process.env.DB_HOST.includes('rds.amazonaws.com')) {
      console.log('✅ Connected to AWS RDS (LIVE DATABASE)');
    } else {
      console.log('⚠️  Connected to LOCAL DATABASE');
      console.log('   To use live database, update .env with AWS RDS credentials');
    }

    console.log('\n========================================\n');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

checkDatabaseEnv();
