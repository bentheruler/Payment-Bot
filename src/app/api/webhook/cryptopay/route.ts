import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { CryptoPayProvider } from "../../../../lib/payments/cryptopay";
import { SubscriptionService } from "../../../../lib/subscriptions/service";
import { z } from "zod";

const cryptoPayEventSchema = z.object({
  update_id: z.number(),
  update_type: z.string(),
  request_date: z.string(),
  payload: z.object({
    invoice_id: z.number(),
    status: z.string(),
    hash: z.string(),
    asset: z.string().optional(),
    amount: z.string().optional(),
    pay_url: z.string().optional(),
    description: z.string().optional(),
    created_at: z.string().optional(),
    allow_comments: z.boolean().optional(),
    allow_anonymous: z.boolean().optional(),
    paid_at: z.string().optional(),
    paid_anonymously: z.boolean().optional(),
    payload: z.string().optional(), // This is our internal payment ID!
    fiat: z.string().optional(),
    accepted_assets: z.any().optional(),
    fee_asset: z.string().optional(),
    fee_amount: z.any().optional(),
    paid_amount: z.string().optional(),
    paid_fiat_rate: z.string().optional(),
    paid_usd_rate: z.string().optional(),
  }).passthrough()
});

export async function POST(req: Request) {
  console.log("📥 Received Crypto Pay webhook request");
  try {
    const rawBody = await req.text();
    const provider = new CryptoPayProvider();
    
    if (!provider.verifyWebhook(rawBody, req.headers)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      console.error("Invalid JSON:", rawBody);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validationResult = cryptoPayEventSchema.safeParse(parsedBody);
    if (!validationResult.success) {
      console.error("Malformed payload:", validationResult.error.format());
      return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
    }

    const data = validationResult.data;
    const updateId = data.update_id.toString();

    const parsedEvent = provider.parseWebhook(data);

    // Implement idempotency before taking any action
    const eventExists = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: "CRYPTO_PAY",
          eventId: updateId,
        }
      }
    });

    if (eventExists) {
      return NextResponse.json({ ok: true, message: "Already processed" }, { status: 200 });
    }

    await prisma.$transaction(async (tx) => {
      let payment;
      if (data.payload.payload) {
        payment = await tx.payment.findUnique({ where: { id: data.payload.payload } });
      } else {
        payment = await tx.payment.findFirst({
          where: { providerInvoiceId: parsedEvent.providerInvoiceId, provider: "CRYPTO_PAY" }
        });
      }

      if (!payment) {
        throw new Error("Payment not found");
      }

      const expectedAmount = payment.amount.toNumber();
      // Use parseFloat on data.payload.amount to handle string decimals ("10.00")
      const incomingAmount = parseFloat(data.payload.amount || "0");
      
      // We expect fiat=USD and amount=10.00.
      if (data.payload.fiat !== payment.currency || incomingAmount !== expectedAmount) {
        throw new Error("Amount or currency mismatch");
      }

      if (parsedEvent.status === "PAID") {
        if (payment.status === "PENDING") {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: "PAID", paidAt: new Date(), providerPayload: data as Prisma.InputJsonValue }
          });
          // 5. Activate subscription atomically with payment
          await SubscriptionService.activateFromPayment(payment.id, tx);
        }
      } else if (parsedEvent.status === "EXPIRED" || parsedEvent.status === "FAILED") {
        if (payment.status === "PENDING") {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: parsedEvent.status, providerPayload: data as Prisma.InputJsonValue }
          });
        }
      }

      await tx.webhookEvent.create({
        data: {
          provider: "CRYPTO_PAY",
          eventId: updateId,
          eventType: data.update_type,
          payload: data as Prisma.InputJsonValue,
          processed: true,
          processedAt: new Date()
        }
      });
    }); // End of transaction

    // 7. Non-Atomic Provisioning of Telegram Access
    // We execute this outside the transaction. If it fails, the subscription 
    // remains ACTIVE and we can retry provisioning later.
    let targetPayment;
    if (data.payload.payload) {
      targetPayment = await prisma.payment.findUnique({ where: { id: data.payload.payload } });
    } else {
      targetPayment = await prisma.payment.findFirst({
        where: { providerInvoiceId: parsedEvent.providerInvoiceId, provider: "CRYPTO_PAY" }
      });
    }

    if (parsedEvent.status === "PAID" && targetPayment?.subscriptionId) {
      try {
        const { TelegramAccessService } = await import("../../../../lib/telegram/access-service");
        await TelegramAccessService.provisionAccess(targetPayment.subscriptionId);
      } catch (err) {
        console.error("Failed to provision Telegram access immediately:", err);
        // We still return 200 OK because the payment was successfully processed.
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Webhook processing error:", err.message);
    // Safe idempotent handling of concurrent duplicate webhooks
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, message: "Already processed concurrently" }, { status: 200 });
    }
    if (err.message === "Payment not found" || err.message === "Amount or currency mismatch") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
