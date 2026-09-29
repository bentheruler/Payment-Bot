import "dotenv/config";
import { Prisma } from "@prisma/client";
import { test, describe, beforeAll as before, afterEach } from "vitest";
import assert from "node:assert";
import { CryptoPayProvider } from "../lib/payments/cryptopay";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

process.env.CRYPTO_PAY_API_TOKEN = "1234:TEST_TOKEN";
process.env.CRYPTO_PAY_TESTNET = "true";
const provider = new CryptoPayProvider();

describe("Crypto Pay Provider Configuration", () => {
  const originalToken = process.env.CRYPTO_PAY_API_TOKEN;
  const originalTestnet = process.env.CRYPTO_PAY_TESTNET;

  afterEach(() => {
    process.env.CRYPTO_PAY_API_TOKEN = originalToken;
    process.env.CRYPTO_PAY_TESTNET = originalTestnet;
  });

  test("Missing API token throws", () => {
    delete process.env.CRYPTO_PAY_API_TOKEN;
    assert.throws(() => new CryptoPayProvider(), /CRYPTO_PAY_API_TOKEN is missing/);
  });

  test("CRYPTO_PAY_TESTNET=true connects to testnet", () => {
    process.env.CRYPTO_PAY_TESTNET = "true";
    const p = new CryptoPayProvider();
    assert.strictEqual((p as unknown as { baseUrl: string }).baseUrl, "https://testnet-pay.crypt.bot/api");
  });

  test("CRYPTO_PAY_TESTNET=false connects to mainnet", () => {
    process.env.CRYPTO_PAY_TESTNET = "false";
    const p = new CryptoPayProvider();
    assert.strictEqual((p as unknown as { baseUrl: string }).baseUrl, "https://pay.crypt.bot/api");
  });

  test("CRYPTO_PAY_TESTNET missing throws error", () => {
    delete process.env.CRYPTO_PAY_TESTNET;
    assert.throws(() => new CryptoPayProvider(), /CRYPTO_PAY_TESTNET configuration is missing/);
  });
});

describe("Crypto Pay Provider Signature Verification", () => {
  test("Valid signature passes", () => {
    const rawBody = JSON.stringify({ update_id: 1, update_type: "invoice_paid" });
    const secret = crypto.createHash("sha256").update("1234:TEST_TOKEN").digest();
    const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    
    const headers = new Headers({ "crypto-pay-api-signature": hmac });
    
    assert.strictEqual(provider.verifyWebhook(rawBody, headers), true);
  });

  test("Invalid signature fails", () => {
    const rawBody = JSON.stringify({ update_id: 1, update_type: "invoice_paid" });
    const headers = new Headers({ "crypto-pay-api-signature": "badsignature" });
    assert.strictEqual(provider.verifyWebhook(rawBody, headers), false);
  });
  
  test("Modified body fails", () => {
    const rawBody = JSON.stringify({ update_id: 1 });
    const secret = crypto.createHash("sha256").update("1234:TEST_TOKEN").digest();
    const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    
    const modifiedBody = JSON.stringify({ update_id: 1, extra: true });
    const headers = new Headers({ "crypto-pay-api-signature": hmac });
    
    assert.strictEqual(provider.verifyWebhook(modifiedBody, headers), false);
  });
});

describe("Database Idempotency & State Machine", () => {
  let user: import("@prisma/client").User;
  let plan: import("@prisma/client").Plan;
  let payment: import("@prisma/client").Payment;
  const eventId = `evt_${Date.now()}`;

  before(async () => {
    const telegramId = Math.floor(Math.random() * 1000000000);
    user = await prisma.user.create({ data: { telegramId, firstName: "Test" }});
    plan = await prisma.plan.findFirst({ where: { name: "Premium Monthly" }}) || 
                 await prisma.plan.create({ data: { name: "Premium Monthly", description: "", price: 10, currency: "USD", durationDays: 30 }});

    payment = await prisma.payment.create({
      data: {
        userId: user.id, planId: plan.id, provider: "CRYPTO_PAY", providerInvoiceId: "99999",
        amount: plan.price, currency: plan.currency, status: "PENDING"
      }
    });
  });

  test("Transition PENDING -> PAID", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: new Date() }
      });
      await tx.webhookEvent.create({
        data: { provider: "CRYPTO_PAY", eventId, eventType: "invoice_paid", payload: {} }
      });
    });
    
    const p = await prisma.payment.findUnique({ where: { id: payment.id }});
    assert.strictEqual(p?.status, "PAID");
  });

  test("Duplicate webhook throws on creation", async () => {
    try {
      await prisma.webhookEvent.create({
        data: { provider: "CRYPTO_PAY", eventId, eventType: "invoice_paid", payload: {} }
      });
      assert.fail("Should have thrown unique constraint error");
    } catch (error: unknown) {
      assert.ok(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002");
    }
  });
});
