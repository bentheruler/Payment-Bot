const token = process.env.TELEGRAM_BOT_TOKEN;
fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  .then(r => r.json())
  .then(console.log).catch(console.error);
