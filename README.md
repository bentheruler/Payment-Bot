# Telegram Payment Bot

A subscription management platform built with Next.js, Prisma, Supabase, and Telegram Bot API. It handles cryptocurrency payments via Crypto Pay and automatically manages access to a private Telegram channel.

## Production Environment

The application is deployed to Vercel and runs 24/7.
- **Production URL**: `https://payment-bot.vercel.app`
- **Telegram Webhook**: `https://payment-bot.vercel.app/api/webhook/telegram`
- **Crypto Pay Webhook**: `https://payment-bot.vercel.app/api/webhook/cryptopay`

## Local Development (Without ngrok)

Ngrok is no longer required for local development unless you are testing webhooks locally. 

To run the application locally without production credentials:

1. Copy `.env.example` to `.env`
2. Keep the local development Supabase/PostgreSQL connection string (or use an isolated branch).
3. Do **not** overwrite the production Telegram bot or Crypto Pay webhooks. 
4. If you need to test webhooks locally, use a separate test bot and test Crypto Pay app, and run ngrok manually (`ngrok http 3000`).

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run local server
npm run dev
```

## Architecture

- **Next.js 16 (App Router)**
- **Prisma + Supabase** (Uses `uselibpqcompat=true` on port 6543 for strict TLS compliance on Vercel)
- **Vercel Cron** (`/api/cron/expire-subscriptions` runs daily to revoke expired access)
