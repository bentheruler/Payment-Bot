import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Add subscriptionId to Payment
    await client.query(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;`);
    await client.query(`ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_subscriptionId_fkey";`);
    await client.query(`ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
    
    // 2. Remove paymentId from Subscription
    await client.query(`ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_paymentId_fkey";`);
    await client.query(`ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "paymentId";`);

    // 3. Add unique constraint [userId, planId]
    await client.query(`ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_userId_planId_key";`);
    await client.query(`ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_planId_key" UNIQUE ("userId", "planId");`);
    
    console.log("Migration successful.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    client.release();
    pool.end();
  }
}
main();
