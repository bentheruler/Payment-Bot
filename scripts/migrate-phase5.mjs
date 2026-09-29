import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log("Starting Phase 5 manual migration...");

  try {
    await pool.query('BEGIN');
    
    // Add unique constraint on subscriptionId
    console.log("Adding UNIQUE constraint to TelegramAccess.subscriptionId...");
    await pool.query(`
      ALTER TABLE "TelegramAccess"
      ADD CONSTRAINT "TelegramAccess_subscriptionId_key" UNIQUE ("subscriptionId");
    `);

    await pool.query('COMMIT');
    console.log("Migration successful!");
  } catch (error) {
    await pool.query('ROLLBACK');
    // If it already exists, just ignore
    if (error.code === '42P07' || error.message.includes('already exists')) {
      console.log("Constraint already exists, ignoring...");
    } else {
      console.error("Migration failed:", error);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
