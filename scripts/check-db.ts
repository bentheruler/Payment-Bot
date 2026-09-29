import { Pool } from 'pg';
import { config } from 'dotenv';
config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
});

async function main() {
  try {
    const userCount = await pool.query('SELECT COUNT(*) FROM "User"');
    const planCount = await pool.query('SELECT COUNT(*) FROM "Plan"');
    const paymentCount = await pool.query('SELECT COUNT(*) FROM "Payment"');
    const subscriptionCount = await pool.query('SELECT COUNT(*) FROM "Subscription"');
    const telegramAccessCount = await pool.query('SELECT COUNT(*) FROM "TelegramAccess"');
    const webhookEventCount = await pool.query('SELECT COUNT(*) FROM "WebhookEvent"');
    
    // Also try to get current database name and schema
    const dbInfo = await pool.query('SELECT current_database(), current_schema()');

    const recentPayments = await pool.query('SELECT * FROM "Payment" ORDER BY "createdAt" DESC LIMIT 3');
    const recentAccesses = await pool.query('SELECT * FROM "TelegramAccess" ORDER BY "createdAt" DESC LIMIT 3');

    console.log(JSON.stringify({
      users: parseInt(userCount.rows[0].count),
      plans: parseInt(planCount.rows[0].count),
      payments: parseInt(paymentCount.rows[0].count),
      subscriptions: parseInt(subscriptionCount.rows[0].count),
      telegramAccesses: parseInt(telegramAccessCount.rows[0].count),
      webhookEvents: parseInt(webhookEventCount.rows[0].count),
      dbInfo: dbInfo.rows[0],
      recentPayments: recentPayments.rows,
      recentAccesses: recentAccesses.rows
    }, null, 2));
  } catch (error) {
    console.error('Error counting records:', error);
  } finally {
    await pool.end();
  }
}

main();
