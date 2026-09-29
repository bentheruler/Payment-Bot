import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { prisma } from "../lib/prisma";
import crypto from "crypto";
import { GET as getOverview } from "../app/api/admin/overview/route";
import { POST as login } from "../app/api/admin/auth/login/route";
import { POST as retryAccess } from "../app/api/admin/access/[id]/retry/route";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }))
}));

vi.mock("../lib/telegram/access-service", () => ({
  TelegramAccessService: {
    provisionAccess: vi.fn()
  }
}));

describe("Phase 7: Admin Dashboard & Auth", () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.telegramAccess.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Admin Auth Boundaries", () => {
    it("should prevent login with invalid password", async () => {
      const req = new Request("http://localhost/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: "wrong" }),
        headers: { "x-forwarded-for": "127.0.0.1" }
      });

      const res = await login(req);
      expect(res.status).toBe(401);

      const sessions = await prisma.authSession.count();
      expect(sessions).toBe(0);
    });

    it("should reject customer sessions for admin routes", async () => {
      // Create a customer session
      const user = await prisma.user.create({
        data: { telegramId: BigInt(12345), telegramUsername: "test" }
      });

      const token = "customer_token";
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.authSession.create({
        data: {
          userId: user.id,
          tokenHash,
          status: "AUTHENTICATED", // not ADMIN
          expiresAt: new Date(Date.now() + 10000)
        }
      });

      // Mock cookies to return customer token
      const { cookies } = await import("next/headers");
      ((cookies as unknown) as ReturnType<typeof vi.fn>).mockReturnValue({
        get: vi.fn().mockReturnValue({ value: token })
      });

      const res = await getOverview();
      expect(res.status).toBe(401);
    });
  });

  describe("Metrics Collection (Prisma Decimal)", () => {
    it("should accurately sum paid payments and count active subs", async () => {
      // Mock valid admin session
      const token = "admin_token";
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.authSession.create({
        data: {
          userId: null,
          tokenHash,
          status: "AUTHENTICATED",
          expiresAt: new Date(Date.now() + 10000)
        }
      });

      const { cookies } = await import("next/headers");
      ((cookies as unknown) as ReturnType<typeof vi.fn>).mockReturnValue({
        get: vi.fn().mockReturnValue({ value: token })
      });

      // Insert data
      const user = await prisma.user.create({
        data: { telegramId: BigInt(111) }
      });
      const plan = await prisma.plan.create({
        data: { name: "Test", description: "Test plan", price: 10.50, currency: "USD", durationDays: 30 }
      });

      // 1 Paid payment, 1 Failed
      await prisma.payment.create({
        data: {
          userId: user.id, planId: plan.id, amount: 10.50, currency: "USD",
          provider: "CRYPTO_PAY", providerInvoiceId: "1", status: "PAID"
        }
      });
      await prisma.payment.create({
        data: {
          userId: user.id, planId: plan.id, amount: 10.50, currency: "USD",
          provider: "CRYPTO_PAY", providerInvoiceId: "2", status: "FAILED"
        }
      });

      // 1 Active sub, 1 Expired
      await prisma.subscription.create({
        data: {
          userId: user.id, planId: plan.id, status: "ACTIVE",
          startsAt: new Date(), expiresAt: new Date(Date.now() + 100000)
        }
      });
      const plan2 = await prisma.plan.create({
        data: { name: "Test2", description: "Test plan 2", price: 10.50, currency: "USD", durationDays: 30 }
      });
      await prisma.subscription.create({
        data: {
          userId: user.id, planId: plan2.id, status: "EXPIRED",
          startsAt: new Date(Date.now() - 100000), expiresAt: new Date(Date.now() - 10000)
        }
      });

      const res = await getOverview();
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.metrics.totalUsers).toBe(1);
      expect(data.metrics.activeSubscriptions).toBe(1);
      expect(data.metrics.totalRevenue).toBe("10.5"); // Decimal converted correctly
    });
  });

  describe("Telegram Access Provision Retry Restrictions", () => {
    it("should block retry if subscription is not active", async () => {
      // Mock valid admin session
      const token = "admin_token";
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.authSession.create({
        data: {
          userId: null,
          tokenHash,
          status: "AUTHENTICATED",
          expiresAt: new Date(Date.now() + 10000)
        }
      });

      const { cookies } = await import("next/headers");
      ((cookies as unknown) as ReturnType<typeof vi.fn>).mockReturnValue({
        get: vi.fn().mockReturnValue({ value: token })
      });

      const user = await prisma.user.create({ data: { telegramId: BigInt(222) } });
      const plan = await prisma.plan.create({ data: { name: "Test", description: "test", price: 5, currency: "USD", durationDays: 30 } });
      
      // Expired sub
      const sub = await prisma.subscription.create({
        data: {
          userId: user.id, planId: plan.id, status: "ACTIVE", // status active but...
          startsAt: new Date(Date.now() - 100000),
          expiresAt: new Date(Date.now() - 10000) // ...expired date
        }
      });

      const access = await prisma.telegramAccess.create({
        data: {
          userId: user.id, subscriptionId: sub.id, status: "REVOKED", chatId: "-100", inviteLink: "https://t.me/+test"
        }
      });

      const req = new Request(`http://localhost/api/admin/access/${access.id}/retry`, { method: "POST" });
      // The Next.js 15 route expects params as a Promise, simulate this
      const res = await retryAccess(req, { params: Promise.resolve({ id: access.id }) });
      
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("expired or inactive");
    });
  });
});
