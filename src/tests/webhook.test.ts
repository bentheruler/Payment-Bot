import { test, describe, beforeAll as before, afterAll as after, vi as mock } from "vitest";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { POST as TelegramWebhook } from "../app/api/webhook/telegram/route";
import { POST as CryptoPayWebhook } from "../app/api/webhook/cryptopay/route";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

function createTelegramRequest(body: unknown, secret?: string) {
  return new NextRequest("http://localhost:3000/api/webhook/telegram", {
    method: "POST",
    headers: secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {},
    body: JSON.stringify(body)
  });
}

function createCryptoPayRequest(body: unknown, secretKey: string, injectSignature?: string) {
  const rawBody = JSON.stringify(body);
  const secret = crypto.createHash("sha256").update(secretKey).digest();
  const signature = injectSignature ?? crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return new NextRequest("http://localhost:3000/api/webhook/cryptopay", {
    method: "POST",
    headers: { "crypto-pay-api-signature": signature },
    body: rawBody
  });
}

describe("Telegram Webhook Route", () => {
  before(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
  });

  test("Missing secret", async () => {
    const req = createTelegramRequest({ message: { text: "hello" } });
    const res = await TelegramWebhook(req);
    assert.strictEqual(res.status, 401);
  });

  test("Invalid secret", async () => {
    const req = createTelegramRequest({ message: { text: "hello" } }, "wrong-secret");
    const res = await TelegramWebhook(req);
    assert.strictEqual(res.status, 401);
  });

  test("Valid secret", async () => {
    const req = createTelegramRequest({ message: { text: "hello" } }, "test-secret");
    const res = await TelegramWebhook(req);
    assert.strictEqual(res.status, 200);
  });

  test("chat_join_request", async () => {
    mock.spyOn(console, 'error').mockImplementation(() => {});
    const req = createTelegramRequest({ 
      chat_join_request: { 
        chat: { id: -123 }, 
        from: { id: 456 }, 
        invite_link: { invite_link: "https://t.me/+foo" } 
      } 
    }, "test-secret");
    const res = await TelegramWebhook(req);
    assert.strictEqual(res.status, 200); // We expect success, access service handles rejection internally
    mock.restoreAllMocks();
  });

  test("Unsupported update", async () => {
    const req = createTelegramRequest({ inline_query: { id: "123" } }, "test-secret");
    const res = await TelegramWebhook(req);
    assert.strictEqual(res.status, 200); // Should return ok: true and do nothing
  });
});

describe("Crypto Pay Webhook Route", () => {
  const secretKey = "test-crypto-token";
  
  before(async () => {
    process.env.CRYPTO_PAY_API_TOKEN = secretKey;
    process.env.CRYPTO_PAY_TESTNET = "true";
  });

  after(async () => {
    await prisma.webhookEvent.deleteMany({});
  });

  test("Missing/invalid signature", async () => {
    const req = createCryptoPayRequest({ update_id: 1 }, secretKey, "bad-sig");
    const res = await CryptoPayWebhook(req);
    assert.strictEqual(res.status, 401);
  });

  test("Valid signature but missing payment", async () => {
    const req = createCryptoPayRequest({ 
      update_id: Date.now(), 
      update_type: "invoice_paid", 
      request_date: new Date().toISOString(),
      payload: { 
        invoice_id: 9999, 
        status: "PAID",
        hash: "xyz",
        amount: "10.00",
        fiat: "USD"
      } 
    }, secretKey);
    const res = await CryptoPayWebhook(req);
    assert.strictEqual(res.status, 400); // Payment not found
  });

  test("Unsupported event type (schema failure or invalid JSON)", async () => {
    const req = createCryptoPayRequest({ update_id: Date.now() }, secretKey);
    const res = await CryptoPayWebhook(req);
    assert.strictEqual(res.status, 400); // Malformed payload because update_type is missing
  });

  test("Idempotency: Duplicate event", async () => {
    const eventId = Date.now();
    await prisma.webhookEvent.create({
      data: { provider: "CRYPTO_PAY", eventId: String(eventId), eventType: "invoice_paid", payload: {} }
    });

    const req = createCryptoPayRequest({ 
      update_id: eventId, 
      update_type: "invoice_paid", 
      request_date: new Date().toISOString(),
      payload: { invoice_id: 1, status: "PAID", hash: "x" } 
    }, secretKey);
    
    const res = await CryptoPayWebhook(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.message, "Already processed");
  });
});
