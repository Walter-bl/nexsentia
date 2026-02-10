import 'reflect-metadata';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TeamImpactService } from '../modules/kpi/services/team-impact.service';

config();

async function testTeamImpact() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const teamImpactService = app.get(TeamImpactService);

  try {
    console.log('Testing team impact for tenant 1, last 1 month...\n');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const result = await teamImpactService.getTeamImpactDashboard(1, startDate, endDate);

    console.log(`Total teams in breakdown: ${result.teamBreakdown.length}`);
    console.log(`\nTeams with activity (problemsResolved > 0):`);

    const activeTeams = result.teamBreakdown.filter(t => t.problemsResolved > 0);
    console.log(`Active: ${activeTeams.length}`);
    activeTeams.forEach(t => {
      console.log(`- ${t.teamName}: ${t.problemsResolved} problems`);
    });

    console.log(`\nTeams with NO activity:`);
    const inactiveTeams = result.teamBreakdown.filter(t => t.problemsResolved === 0);
    console.log(`Inactive: ${inactiveTeams.length}`);
    inactiveTeams.slice(0, 10).forEach(t => {
      console.log(`- ${t.teamName}`);
    });
    if (inactiveTeams.length > 10) {
      console.log(`... and ${inactiveTeams.length - 10} more`);
    }

    await app.close();
  } catch (error) {
    console.error('Error:', error);
    await app.close();
    process.exit(1);
  }
}

testTeamImpact();
