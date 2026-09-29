/* eslint-disable */
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  console.log("Testing DIRECT_URL...");
  const poolDirect = new Pool({
    connectionString: process.env.DIRECT_URL
  });
  
  try {
    const res = await poolDirect.query('SELECT NOW()');
    console.log("DIRECT_URL Success:", res.rows[0]);
  } catch (e) {
    console.error("DIRECT_URL Error:", e.message);
  } finally {
    await poolDirect.end();
  }

  console.log("Testing DATABASE_URL...");
  const poolDb = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const resDb = await poolDb.query('SELECT NOW()');
    console.log("DATABASE_URL Success:", resDb.rows[0]);
  } catch (e) {
    console.error("DATABASE_URL Error:", e.message);
  } finally {
    await poolDb.end();
  }
}

main();
