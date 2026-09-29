import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "Payment" ALTER COLUMN "providerInvoiceId" DROP NOT NULL;`);
    console.log("Made providerInvoiceId optional");
    
    const idxCheck = await client.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'Payment_provider_providerInvoiceId_key' AND n.nspname = 'public';`);
    if (idxCheck.rows.length === 0) {
      await client.query(`CREATE UNIQUE INDEX "Payment_provider_providerInvoiceId_key" ON "Payment"("provider", "providerInvoiceId");`);
      console.log("Created unique index");
    } else {
      console.log("Unique index already exists");
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}
main();
