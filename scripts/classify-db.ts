import { Pool } from 'pg';
import { config } from 'dotenv';
config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
  try {
    const users = await pool.query('SELECT "telegramUsername", "createdAt" FROM "User"');
    const plans = await pool.query('SELECT "name", "price" FROM "Plan"');
    
    let isTest = true;
    for (const row of users.rows) {
      if (row.telegramUsername && !row.telegramUsername.toLowerCase().includes('test')) {
        isTest = false;
      }
    }
    
    console.log(JSON.stringify({
      userCount: users.rowCount ?? 0,
      planNames: plans.rows.map(p => p.name),
      isLikelyTestData: isTest && (users.rowCount ?? 0) > 0 && (users.rowCount ?? 0) <= 5,
      firstUserCreated: users.rows[0]?.createdAt
    }, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
