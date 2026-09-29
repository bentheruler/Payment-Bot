import { config } from 'dotenv';
config();

async function main() {
  const errors: string[] = [];
  const required = [
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'CRYPTO_PAY_API_TOKEN',
    'CRON_SECRET',
    'NEXT_PUBLIC_APP_URL'
  ];

  for (const req of required) {
    if (!process.env[req]) {
      errors.push(`Missing required environment variable: ${req}`);
    }
  }

  // CRYPTO_PAY_TESTNET strict checks
  if (process.env.CRYPTO_PAY_TESTNET !== 'true') {
    errors.push('CRYPTO_PAY_TESTNET is not "true". For Phase 9 testing, it must be explicitly set to "true".');
  }

  // APP URL check
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    errors.push('NEXT_PUBLIC_APP_URL is not set.');
  }

  const isLocalhost = appUrl && appUrl.includes('localhost');
  const publicWebhookStatus = isLocalhost ? 'NOT CONFIGURED' : 'CONFIGURED';

  console.log('\n--- Phase 9 Pre-flight Check ---');
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'present (not exposed)' : 'MISSING'}`);
  console.log(`TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'present' : 'MISSING'}`);
  console.log(`CRYPTO_PAY_API_TOKEN: ${process.env.CRYPTO_PAY_API_TOKEN ? 'present' : 'MISSING'}`);
  console.log(`CRYPTO_PAY_TESTNET: ${process.env.CRYPTO_PAY_TESTNET}`);
  console.log(`APP_URL: ${appUrl}`);
  console.log(`PUBLIC_WEBHOOK_URL: ${publicWebhookStatus}`);
  console.log('--------------------------------\n');

  if (errors.length > 0) {
    console.error('Pre-flight check failed with errors:');
    errors.forEach(e => console.error(`- ${e}`));
    process.exit(1);
  } else {
    console.log('Pre-flight config validation passed.');
  }
}

main();
