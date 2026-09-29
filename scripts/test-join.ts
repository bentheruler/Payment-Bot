import { prisma } from '../src/lib/prisma';
import { config } from 'dotenv';
config();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      subscriptions: {
        some: { status: 'ACTIVE' }
      }
    },
    include: {
      subscriptions: {
        include: { telegramAccesses: true }
      }
    }
  });

  if (!user) {
    console.error('No active user found');
    return;
  }

  const telegramId = user.telegramId;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  const inviteLink = user.subscriptions[0].telegramAccesses[0].inviteLink;

  const payload = {
    update_id: Math.floor(Math.random() * 1000000),
    chat_join_request: {
      date: Math.floor(Date.now() / 1000),
      from: {
        id: Number(telegramId),
        is_bot: false,
        first_name: "TestUser",
        username: "testuser"
      },
      chat: {
        id: Number(channelId),
        type: "channel",
        title: "Test Channel"
      },
      invite_link: {
        invite_link: inviteLink,
        creator: { id: 123456, is_bot: true, first_name: "Bot" }
      }
    }
  };

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  console.log(`Sending join request to ${appUrl}/api/webhook/telegram`);
  const t0 = Date.now();
  
  const res = await fetch(`${appUrl}/api/webhook/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': secret || ''
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log(`Response ${res.status} in ${Date.now() - t0}ms: ${text}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
