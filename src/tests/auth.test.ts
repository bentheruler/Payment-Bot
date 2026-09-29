import { test, describe } from "vitest";
import assert from "node:assert";
import crypto from "crypto";
import { generateConnectionToken, hashToken } from "../lib/auth";
import { verifyTelegramWebhook } from "../lib/telegram";

describe("Token generation", () => {
  test("generates unique 32-byte hex tokens", () => {
    const { token: token1 } = generateConnectionToken();
    const { token: token2 } = generateConnectionToken();
    assert.notStrictEqual(token1, token2);
    assert.strictEqual(token1.length, 64); // 32 bytes in hex = 64 chars
  });

  test("token hash matches expected SHA-256", () => {
    const { token, tokenHash } = generateConnectionToken();
    const expectedHash = crypto.createHash("sha256").update(token).digest("hex");
    assert.strictEqual(tokenHash, expectedHash);
    assert.strictEqual(hashToken(token), expectedHash);
  });
});

describe("Telegram Webhook Validation", () => {
  const originalEnv = process.env.TELEGRAM_WEBHOOK_SECRET;

  test("accepts valid secret token", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "test_secret";
    
    // Mock NextRequest
    const req = {
      headers: new Map([["X-Telegram-Bot-Api-Secret-Token", "test_secret"]])
    } as unknown as import("next/server").NextRequest;

    assert.strictEqual(verifyTelegramWebhook(req), true);
  });

  test("rejects invalid secret token", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "test_secret";
    
    const req = {
      headers: new Map([["X-Telegram-Bot-Api-Secret-Token", "wrong_secret"]])
    } as unknown as import("next/server").NextRequest;

    assert.strictEqual(verifyTelegramWebhook(req), false);
  });

  test("rejects if secret is missing", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "test_secret";
    
    const req = {
      headers: new Map()
    } as unknown as import("next/server").NextRequest;

    assert.strictEqual(verifyTelegramWebhook(req), false);
  });

  // Restore
  process.env.TELEGRAM_WEBHOOK_SECRET = originalEnv;
});
