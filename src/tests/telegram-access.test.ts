import { test, describe, beforeAll as before, afterAll as after, vi as mock } from "vitest";
import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { TelegramAccessService } from "../lib/telegram/access-service";
import { Plan, User, Subscription } from "@prisma/client";

describe("Telegram Access Engine", () => {
  let testUser1: User;
  let testUser2: User;
  let expiredUser: User;
  let plan: Plan;
  let activeSub1: Subscription;
  let activeSub2: Subscription;

  before(async () => {
    try {
      plan = await prisma.plan.create({
        data: { name: "Test Plan", description: "Test", price: 10, currency: "USD", durationDays: 30 }
      });

      testUser1 = await prisma.user.create({ data: { telegramId: BigInt(10001), firstName: "Active1" } });
      testUser2 = await prisma.user.create({ data: { telegramId: BigInt(10002), firstName: "Active2" } });
      expiredUser = await prisma.user.create({ data: { telegramId: BigInt(10003), firstName: "Expired" } });

      activeSub1 = await prisma.subscription.create({
        data: { userId: testUser1.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(), expiresAt: new Date(Date.now() + 86400000) }
      });

      activeSub2 = await prisma.subscription.create({
        data: { userId: testUser2.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(), expiresAt: new Date(Date.now() + 86400000) }
      });

      await prisma.subscription.create({
        data: { userId: expiredUser.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000 * 2), expiresAt: new Date(Date.now() - 86400000) }
      });

      process.env.TELEGRAM_CHANNEL_ID = "-1001234567890";
      process.env.TELEGRAM_BOT_TOKEN = "mock:token";
      
      // Mock global fetch
      mock.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | globalThis.Request, init?: RequestInit ): Promise<Response> => {
        const urlStr = url.toString();
        const body = init && init.body ? JSON.parse(init.body as string) : {};
        
        if (body.chat_id === "fail-create" || body.chat_id === "fail-approve") {
          return {
            json: async () => ({ ok: false, description: "API_ERROR" })
          } as unknown as Response;
        }

        if (urlStr.includes("createChatInviteLink")) {
          return {
            json: async () => ({ ok: true, result: { invite_link: `https://t.me/+mocklink_${Date.now()}` } })
          } as unknown as Response;
        }

        if (urlStr.includes("approveChatJoinRequest") || urlStr.includes("declineChatJoinRequest")) {
          return {
            json: async () => ({ ok: true, result: true })
          } as unknown as Response;
        }

        return {
          json: async () => ({ ok: false, description: "Unknown endpoint" })
        } as unknown as Response;
      });

    } catch (e) {
      console.error("BEFORE HOOK ERROR:", e);
      throw e;
    }
  });

  after(async () => {
    mock.restoreAllMocks();
    await prisma.telegramAccess.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.user.deleteMany({});
  });

  test("Provisioning - Success creates INVITED state", async () => {
    const access = await TelegramAccessService.provisionAccess(activeSub1.id);
    assert.strictEqual(access.status, "INVITED");
    assert.ok(access.inviteLink.startsWith("https://t.me/"));
  });

  test("Provisioning - Duplicate provisioning returns existing access safely", async () => {
    const existingCount = await prisma.telegramAccess.count({ where: { subscriptionId: activeSub1.id } });
    assert.strictEqual(existingCount, 1);

    const access = await TelegramAccessService.provisionAccess(activeSub1.id);
    assert.strictEqual(access.status, "INVITED");

    const afterCount = await prisma.telegramAccess.count({ where: { subscriptionId: activeSub1.id } });
    assert.strictEqual(afterCount, 1, "Duplicate record should not be created");
  });

  test("Provisioning - Telegram API failure does not crash DB", async () => {
    process.env.TELEGRAM_CHANNEL_ID = "fail-create";
    await assert.rejects(TelegramAccessService.provisionAccess(activeSub2.id), /API_ERROR/);
    
    // DB state should remain clean (no TelegramAccess)
    const count = await prisma.telegramAccess.count({ where: { subscriptionId: activeSub2.id } });
    assert.strictEqual(count, 0);
    
    // Restore
    process.env.TELEGRAM_CHANNEL_ID = "-1001234567890";
  });

  test("Join Request - Unknown Telegram user -> DECLINE", async () => {
    const result = await TelegramAccessService.handleJoinRequest("-1001234567890", BigInt(99999));
    assert.strictEqual(result.status, "DECLINED");
    assert.strictEqual(result.reason, "Unknown Telegram user");
  });

  test("Join Request - Wrong channel -> DECLINE", async () => {
    const result = await TelegramAccessService.handleJoinRequest("-999", BigInt(10001));
    assert.strictEqual(result.status, "DECLINED");
    assert.strictEqual(result.reason, "Wrong channel");
  });

  test("Join Request - Expired subscription -> DECLINE", async () => {
    const result = await TelegramAccessService.handleJoinRequest("-1001234567890", BigInt(10003));
    assert.strictEqual(result.status, "DECLINED");
    assert.strictEqual(result.reason, "No active subscription");
  });

  test("Join Request - Wrong invite link -> DECLINE", async () => {
    const result = await TelegramAccessService.handleJoinRequest("-1001234567890", BigInt(10001), "https://t.me/+fake_link");
    assert.strictEqual(result.status, "DECLINED");
    assert.strictEqual(result.reason, "Wrong or missing invite link / no valid access record");
  });

  test("Join Request - Valid request -> APPROVE, ACTIVE", async () => {
    // Get the real invite link for activeSub1
    const access = await prisma.telegramAccess.findUnique({ where: { subscriptionId: activeSub1.id } });
    assert.ok(access);
    
    const result = await TelegramAccessService.handleJoinRequest("-1001234567890", BigInt(10001), access.inviteLink);
    assert.strictEqual(result.status, "APPROVED");

    const updated = await prisma.telegramAccess.findUnique({ where: { id: access.id } });
    assert.strictEqual(updated?.status, "ACTIVE");
    assert.ok(updated?.joinedAt);
  });

  test("Join Request - Duplicate request safe", async () => {
    const access = await prisma.telegramAccess.findUnique({ where: { subscriptionId: activeSub1.id } });
    const result = await TelegramAccessService.handleJoinRequest("-1001234567890", BigInt(10001), access?.inviteLink);
    assert.strictEqual(result.status, "APPROVED", "Should approve idempotently since they are ACTIVE");
  });
});
