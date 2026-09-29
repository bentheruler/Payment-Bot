import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const users = await pool.query('SELECT COUNT(*) FROM "User"');
  const plans = await pool.query('SELECT COUNT(*) FROM "Plan"');
  const payments = await pool.query('SELECT COUNT(*) FROM "Payment"');
  const subscriptions = await pool.query('SELECT COUNT(*) FROM "Subscription"');
  const telegramAccesses = await pool.query('SELECT COUNT(*) FROM "TelegramAccess"');
  const webhookEvents = await pool.query('SELECT COUNT(*) FROM "WebhookEvent"');

  console.log(`Users: ${users.rows[0].count}`);
  console.log(`Plans: ${plans.rows[0].count}`);
  console.log(`Payments: ${payments.rows[0].count}`);
  console.log(`Subscriptions: ${subscriptions.rows[0].count}`);
  console.log(`TelegramAccess: ${telegramAccesses.rows[0].count}`);
  console.log(`WebhookEvents: ${webhookEvents.rows[0].count}`);
  
  await pool.end();
}

main().catch(console.error);
