import { test, describe, beforeAll as before, afterAll as after } from "vitest";
import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { SubscriptionService } from "../lib/subscriptions/service";
import { Plan, User } from "@prisma/client";

describe("Subscription Engine", () => {
  let user1: User, user2: User, plan: Plan;

  before(async () => {
    try {
      // Setup users and plan
      user1 = await prisma.user.create({
        data: { telegramId: BigInt(Math.floor(Math.random() * 1000000000)), firstName: "SubUser1" }
      });
      user2 = await prisma.user.create({
        data: { telegramId: BigInt(Math.floor(Math.random() * 1000000000)), firstName: "SubUser2" }
      });
      plan = await prisma.plan.create({
        data: {
          name: "Test Plan",
          description: "Test",
          price: 10,
          currency: "USD",
          durationDays: 30
        }
      });
    } catch (err) {
      console.error("BEFORE HOOK ERROR:", err);
      throw err;
    }
  });

  after(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.payment.updateMany({ data: { subscriptionId: null } });
    await prisma.subscription.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.plan.deleteMany({ where: { id: plan.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
  });

  const createPayment = async (userId: string, status: string = "PENDING") => {
    return await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        provider: "CRYPTO_PAY",
        amount: plan.price,
        currency: plan.currency,
        status,
        providerInvoiceId: `test_inv_${Date.now()}_${Math.random()}`
      }
    });
  };

  test("Initial activation - PAID payment creates correct subscription", async () => {
    const payment = await createPayment(user1.id, "PAID");

    const result = await prisma.$transaction(async (tx) => {
      return await SubscriptionService.activateFromPayment(payment.id, tx);
    });

    assert.strictEqual(result.status, "ACTIVE");
    
    // Verify DB state
    const sub = await prisma.subscription.findUnique({ where: { id: result.subscriptionId } });
    assert.ok(sub);
    assert.strictEqual(sub.status, "ACTIVE");
    assert.strictEqual(sub.userId, user1.id);
    assert.strictEqual(sub.planId, plan.id);
    assert.ok(sub.expiresAt > new Date());

    // Verify Payment linked
    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    assert.strictEqual(updatedPayment?.subscriptionId, sub.id);

    // Verify AuditLog
    const log = await prisma.auditLog.findFirst({ where: { entityId: sub.id, action: "SUBSCRIPTION_ACTIVATED" } });
    assert.ok(log);
  });

  test("Invalid payment states are rejected", async () => {
    const p1 = await createPayment(user1.id, "PENDING");
    const p2 = await createPayment(user1.id, "FAILED");
    const p3 = await createPayment(user1.id, "EXPIRED");

    for (const p of [p1, p2, p3]) {
      await assert.rejects(
        prisma.$transaction((tx) => SubscriptionService.activateFromPayment(p.id, tx)),
        /Payment must be PAID/
      );
    }
  });

  test("Renewal - active subscription extends from existing expiresAt", async () => {
    const payment2 = await createPayment(user1.id, "PAID");

    const beforeSub = await prisma.subscription.findUnique({
      where: { userId_planId: { userId: user1.id, planId: plan.id } }
    });
    assert.ok(beforeSub);

    const result = await prisma.$transaction(async (tx) => {
      return await SubscriptionService.activateFromPayment(payment2.id, tx);
    });

    const afterSub = await prisma.subscription.findUnique({ where: { id: result.subscriptionId } });
    assert.ok(afterSub);

    // Should be exactly 30 days added to the previous expiration
    const expectedTime = beforeSub.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000;
    assert.strictEqual(afterSub.expiresAt.getTime(), expectedTime);

    // Verify AuditLog
    const log = await prisma.auditLog.findFirst({
      where: { entityId: afterSub.id, action: "SUBSCRIPTION_RENEWED" },
      orderBy: { createdAt: 'desc' }
    });
    assert.ok(log);
  });

  test("Idempotency - same payment cannot extend twice", async () => {
    const payment = await createPayment(user2.id, "PAID");

    // First time
    await prisma.$transaction((tx) => SubscriptionService.activateFromPayment(payment.id, tx));

    // Second time
    await assert.rejects(
      prisma.$transaction((tx) => SubscriptionService.activateFromPayment(payment.id, tx)),
      /already been processed/
    );
  });

  test("Renewal - expired subscription starts a new period from now", async () => {
    // Manually expire user2's subscription
    const sub = await prisma.subscription.findUnique({
      where: { userId_planId: { userId: user2.id, planId: plan.id } }
    });
    assert.ok(sub);

    const pastDate = new Date(Date.now() - 100000);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { expiresAt: pastDate }
    });

    const payment = await createPayment(user2.id, "PAID");
    const result = await prisma.$transaction((tx) => SubscriptionService.activateFromPayment(payment.id, tx));

    const afterSub = await prisma.subscription.findUnique({ where: { id: result.subscriptionId } });
    assert.ok(afterSub);

    // The new expiresAt should be roughly now + 30 days, not pastDate + 30 days
    const diffFromNow = afterSub.expiresAt.getTime() - Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(diffFromNow - thirtyDays) < 5000); // within 5 seconds
  });

  test("Concurrency - concurrent processing of two legitimate payments", async () => {
    const user3 = await prisma.user.create({
      data: { telegramId: BigInt(Math.floor(Math.random() * 1000000000)), firstName: "SubUser3" }
    });

    const p1 = await createPayment(user3.id, "PAID");
    const p2 = await createPayment(user3.id, "PAID");

    // Start both transactions concurrently
    const promise1 = prisma.$transaction((tx) => SubscriptionService.activateFromPayment(p1.id, tx));
    const promise2 = prisma.$transaction((tx) => SubscriptionService.activateFromPayment(p2.id, tx));

    const results = await Promise.allSettled([promise1, promise2]);
    
    // Check results
    // Both might succeed if DB serialization handles them perfectly sequentially, 
    // or one might fail due to @@unique constraint or write conflicts if they perfectly collide on creation
    // However, if one fails, Prisma throws a P2002 on create or P2034 transaction conflict.
    // In our logic, if they both try to create at exactly the same ms, one gets P2002.
    // If one succeeds and the other runs right after, the second will see the sub and renew it.

    // Let's verify exactly one Subscription row was created
    const subs = await prisma.subscription.findMany({ where: { userId: user3.id } });
    assert.strictEqual(subs.length, 1);

    // Verify how many succeeded
    const successes = results.filter(r => r.status === "fulfilled");
    assert.ok(successes.length > 0);

    if (successes.length === 2) {
      // Both processed, one created, one renewed
      const sub = subs[0];
      const sixtyDays = 60 * 24 * 60 * 60 * 1000;
      const diffFromNow = sub.expiresAt.getTime() - Date.now();
      assert.ok(Math.abs(diffFromNow - sixtyDays) < 5000);
    }
  });
});
