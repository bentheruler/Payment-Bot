import { execFileSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

config();

const dbUrl = process.env.DATABASE_URL;
const dumpUrl = dbUrl ? dbUrl.replace('pgbouncer=true&', '').replace('&pgbouncer=true', '').replace('?pgbouncer=true', '') : undefined;
if (!dumpUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(process.cwd(), `phase9-preflight-${timestamp}.dump`);
const pgDumpPath = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe";
const pgRestorePath = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe";

console.log(`Starting backup to ${backupFile}...`);

try {
  execFileSync(pgDumpPath, ['--format=custom', '-f', backupFile, dumpUrl], { stdio: 'inherit' });
  console.log("Backup created successfully.");
} catch (e) {
  console.error("Failed to create backup:", e);
  process.exit(1);
}

const stats = fs.statSync(backupFile);
console.log(`Backup file: ${path.basename(backupFile)}`);
console.log(`Backup size: ${stats.size} bytes`);

if (stats.size === 0) {
  console.error("Backup file is empty!");
  process.exit(1);
}

console.log("Verifying backup...");
try {
  execFileSync(pgRestorePath, ['--list', backupFile]);
  console.log("Backup verified successfully.");
} catch (e) {
  console.error("Failed to verify backup:", e);
  process.exit(1);
}
