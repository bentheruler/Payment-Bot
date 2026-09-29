import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !NEXT_PUBLIC_APP_URL) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const url = `${NEXT_PUBLIC_APP_URL}/api/webhook/telegram`;

async function setWebhook() {
  try {
    console.log("Setting Telegram webhook...");
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        secret_token: TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message", "chat_join_request"]
      })
    });
    
    const data = await res.json();
    console.log("setWebhook response:", data);

    console.log("Getting Telegram webhook info...");
    const infoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const infoData = await infoRes.json();
    console.log("getWebhookInfo response:", infoData);
  } catch (err) {
    console.error(err);
  }
}

setWebhook();
