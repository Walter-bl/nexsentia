import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../config/database/typeorm.config';

config();

async function checkTeams() {
  try {
    await dataSource.initialize();
    console.log('Connected to database\n');

    // Get unique assignment group names from ServiceNow
    const serviceNowTeams = await dataSource.query(`
      SELECT DISTINCT assignmentGroupName, COUNT(*) as count
      FROM servicenow_incidents
      WHERE tenantId = 1
      GROUP BY assignmentGroupName
      ORDER BY count DESC
    `);

    console.log('ServiceNow Teams:');
    console.log('=================');
    serviceNowTeams.forEach((team: any) => {
      console.log(`${team.assignmentGroupName}: ${team.count} incidents`);
    });

    // Get unique project names from Jira
    const jiraTeams = await dataSource.query(`
      SELECT DISTINCT p.name, COUNT(*) as count
      FROM jira_issues i
      LEFT JOIN jira_projects p ON i.projectId = p.id
      WHERE i.tenantId = 1
      GROUP BY p.name
      ORDER BY count DESC
    `);

    console.log('\nJira Teams (Projects):');
    console.log('======================');
    jiraTeams.forEach((team: any) => {
      console.log(`${team.name}: ${team.count} issues`);
    });

    console.log(`\nTotal unique teams: ${serviceNowTeams.length + jiraTeams.length}`);

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

checkTeams();
