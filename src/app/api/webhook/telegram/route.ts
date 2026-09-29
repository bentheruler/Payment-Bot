import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramWebhook } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  console.log("📥 Received Telegram webhook request");
  if (!verifyTelegramWebhook(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await req.json();

    if (update.chat_join_request) {
      const t0 = performance.now();
      const joinReqDate = (update.chat_join_request.date || (Date.now() / 1000)) * 1000;
      const tReceived = Date.now();
      console.log(`[DIAGNOSTICS] JOIN_REQUEST_RECEIVED. Telegram Send Date: ${new Date(joinReqDate).toISOString()} | Received: ${new Date(tReceived).toISOString()} | Tunnel Delay: ${tReceived - joinReqDate}ms`);

      const joinReq = update.chat_join_request;
      const { TelegramAccessService } = await import("@/lib/telegram/access-service");
      
      const chatId = joinReq.chat?.id?.toString();
      const telegramId = BigInt(joinReq.from?.id);
      const inviteLink = joinReq.invite_link?.invite_link;

      if (chatId && telegramId) {
        console.log(`[DIAGNOSTICS] STARTING_ACCESS_SERVICE_HANDLER`);
        await TelegramAccessService.handleJoinRequest(chatId, telegramId, inviteLink);
        const tEnd = performance.now();
        console.log(`[DIAGNOSTICS] JOIN_REQUEST_HANDLED. Total Server-Side Processing: ${(tEnd - t0).toFixed(2)}ms`);
      }
      return NextResponse.json({ ok: true });
    }

    if (!update.message || !update.message.text) {
      return NextResponse.json({ ok: true }); // Ignore non-text messages
    }

    const text = update.message.text;
    const from = update.message.from;

    if (!from || !from.id) {
      return NextResponse.json({ ok: true }); // Ignore if no user info
    }

    if (text.startsWith("/start")) {
      const token = text.split(" ")[1];
      if (!token || token === "subscribe") {
        const { sendMessage } = await import("@/lib/telegram");
        const { CryptoPayProvider } = await import("@/lib/payments/cryptopay");
        
        try {
          const telegramId = BigInt(from.id);
          const user = await prisma.user.upsert({
            where: { telegramId },
            create: {
              telegramId,
              telegramUsername: from.username || null,
              firstName: from.first_name || null,
              lastName: from.last_name || null,
            },
            update: {
              telegramUsername: from.username || null,
              firstName: from.first_name || null,
              lastName: from.last_name || null,
            },
          });

          const plan = await prisma.plan.findFirst({
            where: { name: "Premium Monthly", active: true }
          });

          if (!plan) {
            await sendMessage(from.id, `Sorry, no active plans are available right now.`);
            return NextResponse.json({ ok: true });
          }

          const payment = await prisma.payment.create({
            data: {
              userId: user.id,
              planId: plan.id,
              provider: "CRYPTO_PAY",
              amount: plan.price,
              currency: plan.currency,
              status: "PENDING",
            }
          });

          const provider = new CryptoPayProvider();
          const invoice = await provider.createInvoice({
            amount: plan.price.toString(),
            currency: plan.currency,
            description: `Payment for ${plan.name}`,
            payload: payment.id,
          });

          await prisma.payment.update({
            where: { id: payment.id },
            data: { providerInvoiceId: invoice.invoiceId }
          });

          await sendMessage(
            from.id, 
            `👋 <b>Welcome!</b>\n\nGet access to our private premium channel.\n\n💰 $${plan.price.toString()}\n📅 30 days\n\nAfter payment is confirmed, I'll send you a button to join the private channel.`,
            {
              inline_keyboard: [
                [{ text: `💳 Subscribe — $${plan.price.toString()}`, url: invoice.url }]
              ]
            }
          );
        } catch (e) {
          console.error("Failed to process subscribe flow:", e);
        }
        return NextResponse.json({ ok: true });
      }

      const tokenHash = hashToken(token);

      // Verify the session
      const session = await prisma.authSession.findUnique({
        where: { tokenHash },
      });

      if (!session) {
        console.log("Webhook: session not found");
        return NextResponse.json({ ok: true }); // Silently fail to Telegram
      }

      if (session.status !== "PENDING" || session.expiresAt < new Date()) {
        console.log("Webhook: session not pending or expired");
        return NextResponse.json({ ok: true });
      }

      // Valid session, upsert User
      const telegramId = BigInt(from.id);
      const user = await prisma.user.upsert({
        where: { telegramId },
        create: {
          telegramId,
          telegramUsername: from.username || null,
          firstName: from.first_name || null,
          lastName: from.last_name || null,
        },
        update: {
          telegramUsername: from.username || null,
          firstName: from.first_name || null,
          lastName: from.last_name || null,
        },
      });

      // Update AuthSession
      await prisma.authSession.update({
        where: { id: session.id },
        data: {
          userId: user.id,
          status: "AUTHENTICATED",
        },
      });

      console.log(`Webhook: Successfully authenticated session ${session.id} for User ${user.id}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
