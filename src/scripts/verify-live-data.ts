import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

async function verifyLiveData() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Connected to live database');

    // Check Slack messages
    const slackResult = await dataSource.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN slackCreatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last30Days,
        SUM(CASE WHEN slackCreatedAt >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND slackCreatedAt < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as days30to60,
        SUM(CASE WHEN slackCreatedAt >= DATE_SUB(NOW(), INTERVAL 90 DAY) AND slackCreatedAt < DATE_SUB(NOW(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) as days60to90
      FROM slack_messages
      WHERE tenantId = 1
    `);

    console.log('\nSlack Messages Distribution:');
    console.log('Total:', slackResult[0].total);
    console.log('Last 30 days:', slackResult[0].last30Days);
    console.log('30-60 days:', slackResult[0].days30to60);
    console.log('60-90 days:', slackResult[0].days60to90);
    if (slackResult[0].total > 0) {
      console.log('Percentages:',
        `${(slackResult[0].last30Days / slackResult[0].total * 100).toFixed(1)}% / `,
        `${(slackResult[0].days30to60 / slackResult[0].total * 100).toFixed(1)}% / `,
        `${(slackResult[0].days60to90 / slackResult[0].total * 100).toFixed(1)}%`
      );
    }

    // Check Teams messages
    const teamsResult = await dataSource.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN createdDateTime >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last30Days,
        SUM(CASE WHEN createdDateTime >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND createdDateTime < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as days30to60,
        SUM(CASE WHEN createdDateTime >= DATE_SUB(NOW(), INTERVAL 90 DAY) AND createdDateTime < DATE_SUB(NOW(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) as days60to90
      FROM teams_messages
      WHERE tenantId = 1
    `);

    console.log('\nTeams Messages Distribution:');
    console.log('Total:', teamsResult[0].total);
    console.log('Last 30 days:', teamsResult[0].last30Days);
    console.log('30-60 days:', teamsResult[0].days30to60);
    console.log('60-90 days:', teamsResult[0].days60to90);
    if (teamsResult[0].total > 0) {
      console.log('Percentages:',
        `${(teamsResult[0].last30Days / teamsResult[0].total * 100).toFixed(1)}% / `,
        `${(teamsResult[0].days30to60 / teamsResult[0].total * 100).toFixed(1)}% / `,
        `${(teamsResult[0].days60to90 / teamsResult[0].total * 100).toFixed(1)}%`
      );
    }

    await dataSource.destroy();
    console.log('\nVerification complete');
  } catch (error) {
    console.error('Error:', error.message);
    await dataSource.destroy();
    process.exit(1);
  }
}

verifyLiveData();
