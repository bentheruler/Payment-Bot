const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = 'https://payment-bot.vercel.app/api/webhook/telegram';
fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${url}&secret_token=${secret}`)
  .then(r => r.json())
  .then(console.log).catch(console.error);
