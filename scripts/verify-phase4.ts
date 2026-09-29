import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { SubscriptionService } from "../src/lib/subscriptions/service";
import crypto from "crypto";
import { GET } from "../src/app/api/subscriptions/me/route";
async function main() {
  console.log("Starting Phase 4 E2E Verification...");
  
  // 1. Create a user and an auth session
  const user = await prisma.user.create({
    data: { telegramId: BigInt(Math.floor(Math.random() * 1000000000)), firstName: "E2EUser" }
  });
  
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash,
      status: "AUTHENTICATED",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60)
    }
  });

  // 2. Create a Plan
  const plan = await prisma.plan.create({
    data: {
      name: "Premium Monthly",
      description: "Premium access",
      price: 10,
      currency: "USD",
      durationDays: 30
    }
  });

  // 3. Create a simulated PAID payment
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      planId: plan.id,
      provider: "CRYPTO_PAY",
      amount: 10,
      currency: "USD",
      status: "PAID",
      providerInvoiceId: `e2e_inv_${Date.now()}`
    }
  });

  console.log("Mocked payment created. Activating subscription...");

  // 4. Activate subscription via Service
  await prisma.$transaction(async (tx) => {
    await SubscriptionService.activateFromPayment(payment.id, tx);
  });

  console.log("Subscription activated. Hitting API endpoint...");

  // 5. Hit API endpoint locally (simulate by directly calling the route logic, or just a fetch if the server is running)
  const req = new Request(`http://localhost:3000/api/subscriptions/me?token=${token}`);
  const res = await GET();
  const data = await res.json();
  
  console.log("API Response:", data);
  
  if (data.status === "ACTIVE") {
    console.log("✅ Verification SUCCESS: Subscription is active and correctly tracked.");
  } else {
    console.error("❌ Verification FAILED: Subscription status is", data.status);
  }

  // Cleanup
  await prisma.auditLog.deleteMany({});
  await prisma.payment.updateMany({ data: { subscriptionId: null } });
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.payment.deleteMany({ where: { userId: user.id } });
  await prisma.plan.deleteMany({ where: { id: plan.id } });
  await prisma.authSession.deleteMany({ where: { id: session.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
}

main().catch(console.error);
