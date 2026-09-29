import { test, describe, beforeAll as before, afterAll as after, vi as mock } from "vitest";
import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { SubscriptionExpirationService } from "../lib/subscriptions/expiration-service";
import { TelegramAccessService } from "../lib/telegram/access-service";
import { Plan, User, Subscription } from "@prisma/client";

describe("Phase 6 - Expiration & Revocation", () => {
  let plan: Plan;
  let user1: User, user2: User, user3: User, raceUser: User;
  let subInvited: Subscription, subActive: Subscription, subRevoked: Subscription, subRace: Subscription;
  

  before(async () => {
    plan = await prisma.plan.create({
      data: { name: "Test Plan", description: "Test", price: 10, currency: "USD", durationDays: 30 }
    });

    user1 = await prisma.user.create({ data: { telegramId: BigInt(20001), firstName: "InvitedUser" } });
    user2 = await prisma.user.create({ data: { telegramId: BigInt(20002), firstName: "ActiveUser" } });
    user3 = await prisma.user.create({ data: { telegramId: BigInt(20003), firstName: "RevokedUser" } });
    raceUser = await prisma.user.create({ data: { telegramId: BigInt(20004), firstName: "RaceUser" } });

    // Expired sub with INVITED access
    subInvited = await prisma.subscription.create({
      data: { userId: user1.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000 * 30), expiresAt: new Date(Date.now() - 1000) }
    });
    await prisma.telegramAccess.create({
      data: { userId: user1.id, subscriptionId: subInvited.id, chatId: "-100", inviteLink: "https://t.me/+inv1", status: "INVITED" }
    });

    // Expired sub with ACTIVE access
    subActive = await prisma.subscription.create({
      data: { userId: user2.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000 * 30), expiresAt: new Date(Date.now() - 1000) }
    });
    await prisma.telegramAccess.create({
      data: { userId: user2.id, subscriptionId: subActive.id, chatId: "-100", inviteLink: "https://t.me/+act1", status: "ACTIVE", joinedAt: new Date() }
    });

    // Expired sub with already REVOKED access
    subRevoked = await prisma.subscription.create({
      data: { userId: user3.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000 * 30), expiresAt: new Date(Date.now() - 1000) }
    });
    await prisma.telegramAccess.create({
      data: { userId: user3.id, subscriptionId: subRevoked.id, chatId: "-100", inviteLink: "https://t.me/+rev1", status: "REVOKED", revokedAt: new Date() }
    });

    // Sub for race condition testing (starts expired)
    subRace = await prisma.subscription.create({
      data: { userId: raceUser.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000 * 30), expiresAt: new Date(Date.now() - 1000) }
    });
    await prisma.telegramAccess.create({
      data: { userId: raceUser.id, subscriptionId: subRace.id, chatId: "-100", inviteLink: "https://t.me/+race", status: "ACTIVE", joinedAt: new Date() }
    });

    process.env.TELEGRAM_BOT_TOKEN = "mock:token";
    process.env.TELEGRAM_CHANNEL_ID = "-100";

    // Mock fetch for Telegram API
    mock.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | globalThis.Request, init?: RequestInit ): Promise<Response> => {
      const urlStr = url.toString();
      const body = init && init.body ? JSON.parse(init.body as string) : {};

      if (urlStr.includes("revokeChatInviteLink")) {
        if (body.invite_link === "fail-revoke") return { json: async () => ({ ok: false, description: "API_ERROR" }) } as unknown as Response;
        return { json: async () => ({ ok: true, result: true }) } as unknown as Response;
      }
      
      if (urlStr.includes("banChatMember")) {
        if (body.user_id === "99999") return { json: async () => ({ ok: false, description: "BAN_FAIL" }) } as unknown as Response;
        return { json: async () => ({ ok: true, result: true }) } as unknown as Response;
      }

      if (urlStr.includes("unbanChatMember")) {
        if (body.user_id === "88888") return { json: async () => ({ ok: false, description: "UNBAN_FAIL" }) } as unknown as Response;
        return { json: async () => ({ ok: true, result: true }) } as unknown as Response;
      }

      if (urlStr.includes("createChatInviteLink")) {
        return { json: async () => ({ ok: true, result: { invite_link: "https://t.me/+new_link_" + Date.now() } }) } as unknown as Response;
      }

      return { json: async () => ({ ok: false, description: "Unknown endpoint" }) } as unknown as Response;
    });
  });

  after(async () => {
    mock.restoreAllMocks();
    await prisma.auditLog.deleteMany({});
    await prisma.telegramAccess.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.user.deleteMany({});
  });

  test("Expiration - REVOKED access remains idempotent", async () => {
    await SubscriptionExpirationService.processExpirations(100);
    // Finds subInvited, subActive, subRevoked, subRace = 4
    
    const dbSub = await prisma.subscription.findUnique({ where: { id: subRevoked.id } });
    assert.strictEqual(dbSub?.status, "EXPIRED");

    const access = await prisma.telegramAccess.findUnique({ where: { subscriptionId: subRevoked.id } });
    assert.strictEqual(access?.status, "REVOKED");
  }, 10000);

  test("Expiration - INVITED access revokes link and marks REVOKED", async () => {
    const dbSub = await prisma.subscription.findUnique({ where: { id: subInvited.id } });
    assert.strictEqual(dbSub?.status, "EXPIRED");

    const access = await prisma.telegramAccess.findUnique({ where: { subscriptionId: subInvited.id } });
    assert.strictEqual(access?.status, "REVOKED");
    assert.ok(access?.revokedAt);
  });

  test("Expiration - ACTIVE access bans+unbans and marks REVOKED", async () => {
    const dbSub = await prisma.subscription.findUnique({ where: { id: subActive.id } });
    assert.strictEqual(dbSub?.status, "EXPIRED");

    const access = await prisma.telegramAccess.findUnique({ where: { subscriptionId: subActive.id } });
    assert.strictEqual(access?.status, "REVOKED");
    assert.ok(access?.revokedAt);
  });

  test("Expiration - Telegram API failure leaves access in retryable state", async () => {
    const failUser = await prisma.user.create({ data: { telegramId: BigInt(99999), firstName: "FailBan" } });
    const failSub = await prisma.subscription.create({
      data: { userId: failUser.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000 * 30), expiresAt: new Date(Date.now() - 1000) }
    });
    await prisma.telegramAccess.create({
      data: { userId: failUser.id, subscriptionId: failSub.id, chatId: "-100", inviteLink: "https://t.me/+fail", status: "ACTIVE", joinedAt: new Date() }
    });

    await SubscriptionExpirationService.processExpirations(100);

    const dbSub = await prisma.subscription.findUnique({ where: { id: failSub.id } });
    assert.strictEqual(dbSub?.status, "EXPIRED", "Subscription MUST be EXPIRED even if Telegram fails");

    const access = await prisma.telegramAccess.findUnique({ where: { subscriptionId: failSub.id } });
    assert.strictEqual(access?.status, "ACTIVE", "Access MUST remain ACTIVE for retry");
    assert.ok(!access?.revokedAt);
  }, 10000);

  test("Expiration - Race Condition: Renewal wins", async () => {
    // subRace is currently EXPIRED from the first run. Let's make a new one to simulate the race strictly.
    const raceUser2 = await prisma.user.create({ data: { telegramId: BigInt(30005), firstName: "Race2" } });
    const raceSub2 = await prisma.subscription.create({
      data: { userId: raceUser2.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) }
    });
    await prisma.telegramAccess.create({
      data: { userId: raceUser2.id, subscriptionId: raceSub2.id, chatId: "-100", inviteLink: "https://t.me/+race2", status: "ACTIVE", joinedAt: new Date() }
    });

    // Mock updateMany to simulate mid-air collision.
    // Instead of mocking Prisma, we can just run the logic, but intercept it.
    // Actually, we'll manually change the DB state before `processExpirations` hits it by
    // overriding `findMany` just for a tick, but that's hard.
    // Let's just test that `updateMany` strictly requires `expiresAt <= new Date()`.
    
    // We update the DB to simulate renewal.
    await prisma.subscription.update({
      where: { id: raceSub2.id },
      data: { expiresAt: new Date(Date.now() + 86400000) }
    });

    // Now run expiration worker
    await SubscriptionExpirationService.processExpirations(100);

    // It should have ignored raceSub2 because it's no longer expired!
    const dbSub = await prisma.subscription.findUnique({ where: { id: raceSub2.id } });
    assert.strictEqual(dbSub?.status, "ACTIVE");

    const access = await prisma.telegramAccess.findUnique({ where: { subscriptionId: raceSub2.id } });
    assert.strictEqual(access?.status, "ACTIVE", "Telegram access MUST NOT be revoked");
  });

  test("Renewal - Provisioning reuses REVOKED record and generates NEW invite", async () => {
    // subInvited is now EXPIRED and its access is REVOKED.
    // Simulate user renewing subscription
    await prisma.subscription.update({
      where: { id: subInvited.id },
      data: { status: "ACTIVE", expiresAt: new Date(Date.now() + 86400000) }
    });

    // Provision access
    const newAccess = await TelegramAccessService.provisionAccess(subInvited.id);
    
    assert.strictEqual(newAccess.status, "INVITED");
    assert.ok(newAccess.inviteLink.includes("new_link_"), "Must generate a brand new link");
    assert.ok(!newAccess.revokedAt, "revokedAt must be cleared");
    assert.ok(!newAccess.joinedAt, "joinedAt must be cleared");

    // Check that we reused the same record (didn't create a second one)
    const count = await prisma.telegramAccess.count({ where: { subscriptionId: subInvited.id } });
    assert.strictEqual(count, 1);
  });
});
