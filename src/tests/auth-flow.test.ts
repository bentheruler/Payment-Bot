import "dotenv/config";
import { test, describe, vi, afterEach } from "vitest";
import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { generateConnectionToken } from "../lib/auth";
import { GET as getSessionStatus } from "../app/api/auth/session/status/route";
import { GET as getSubscriptionsMe } from "../app/api/subscriptions/me/route";
import { POST as createPayment } from "../app/api/payments/create/route";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }))
}));

vi.mock("../lib/payments/cryptopay", () => ({
  CryptoPayProvider: vi.fn().mockImplementation(() => ({
    createInvoice: vi.fn().mockResolvedValue({
      invoiceId: "mock_invoice_123",
      url: "https://t.me/CryptoBot?start=mock_invoice_123"
    })
  }))
}));

describe("Authentication Flow Integration", () => {
  const cleanup = async (tokenHash: string) => {
    await prisma.authSession.deleteMany({ where: { tokenHash } });
    await prisma.payment.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("Real Auth Flow: webhook -> status (cookie) -> me/payment", async () => {
    const { token, tokenHash } = generateConnectionToken();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const session = await prisma.authSession.create({
      data: { tokenHash, expiresAt, status: "PENDING" },
    });

    assert.strictEqual(session.status, "PENDING");

    // 1. Webhook authenticates the session
    const telegramId = BigInt(Math.floor(Math.random() * 1000000));
    const user = await prisma.user.upsert({
      where: { telegramId },
      create: { telegramId },
      update: {},
    });

    await prisma.authSession.update({
      where: { id: session.id },
      data: { userId: user.id, status: "AUTHENTICATED" },
    });

    // 2. Client polls /api/auth/session/status
    const req = new Request(`http://localhost/api/auth/session/status?token=${token}`);
    // mock next/server NextRequest which has nextUrl
    Object.defineProperty(req, 'nextUrl', { value: new URL(req.url) });

    const statusRes = await getSessionStatus(req as import("next/server").NextRequest);
    const statusData = await statusRes.json();

    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusData.status, "AUTHENTICATED");
    assert.strictEqual(statusData.userId, user.id);

    // Wait! The router now sends customer_session cookie via response.cookies.set
    // In our test environment, we just manually pull the token for the next step.

    // 3. Client calls /api/subscriptions/me using the HttpOnly cookie
    const { cookies } = await import("next/headers");
    ((cookies as unknown) as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn().mockImplementation((name) => {
        if (name === "customer_session") return { value: token };
        return undefined;
      })
    });

    const meRes = await getSubscriptionsMe();
    
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.status, "NONE"); // No subscription yet

    // 4. Client calls /api/payments/create
    await prisma.plan.create({ data: { name: "Premium Monthly", description: "", price: 10, currency: "USD", durationDays: 30 }});
    
    const payRes = await createPayment();

    assert.strictEqual(payRes.status, 200);
    const payData = await payRes.json();
    assert.ok(payData.paymentId);

    // Verify session remains AUTHENTICATED in DB
    const finalSession = await prisma.authSession.findUnique({ where: { tokenHash } });
    assert.strictEqual(finalSession!.status, "AUTHENTICATED");

    await cleanup(tokenHash);
  });

  test("Expired token is rejected by API", async () => {
    const { token, tokenHash } = generateConnectionToken();
    const expiresAt = new Date(Date.now() - 5 * 60 * 1000); // Past

    const user = await prisma.user.create({ data: { telegramId: BigInt(Date.now()) } });
    await prisma.authSession.create({
      data: { tokenHash, expiresAt, status: "AUTHENTICATED", userId: user.id },
    });

    const { cookies } = await import("next/headers");
    ((cookies as unknown) as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn().mockReturnValue({ value: token })
    });

    const res = await getSubscriptionsMe();
    // The API logic should fetch the session and see expiresAt < new Date() and reject
    assert.strictEqual(res.status, 401);
    
    await cleanup(tokenHash);
  });

  test("Unauthenticated customer session is rejected", async () => {
    const { token, tokenHash } = generateConnectionToken();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Session exists but userId is null
    await prisma.authSession.create({
      data: { tokenHash, expiresAt, status: "AUTHENTICATED", userId: null },
    });

    const { cookies } = await import("next/headers");
    ((cookies as unknown) as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn().mockReturnValue({ value: token })
    });

    const res = await getSubscriptionsMe();
    assert.strictEqual(res.status, 401);

    await cleanup(tokenHash);
  });

  test("Invalid token string is rejected", async () => {
    const { cookies } = await import("next/headers");
    ((cookies as unknown) as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn().mockReturnValue({ value: "invalid_token_format" })
    });

    const res = await getSubscriptionsMe();
    assert.strictEqual(res.status, 401);
  });
});
