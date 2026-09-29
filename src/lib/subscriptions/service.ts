import { Prisma } from "@prisma/client";

export class SubscriptionService {
  /**
   * Activates or renews a subscription based on a successfully PAID payment.
   * This method MUST be called within a transaction to ensure idempotency and concurrency safety.
   */
  static async activateFromPayment(paymentId: string, tx: Prisma.TransactionClient) {
    // 1. Load the Payment with Plan and User
    // We don't use FOR UPDATE because Prisma doesn't support it directly in nested queries,
    // but we rely on @@unique([userId, planId]) for creation races, 
    // and payment.subscriptionId for payment consumption races.
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { plan: true, user: true }
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "PAID") {
      throw new Error("Payment must be PAID to activate a subscription");
    }

    if (payment.subscriptionId) {
      // Payment has already been consumed. Idempotency guard.
      throw new Error("Payment has already been processed for a subscription");
    }

    const now = new Date();
    const durationMs = payment.plan.durationDays * 24 * 60 * 60 * 1000;
    
    // 2. Lookup existing subscription for this user and plan
    const existingSub = await tx.subscription.findUnique({
      where: {
        userId_planId: {
          userId: payment.userId,
          planId: payment.planId
        }
      }
    });

    let subscriptionId: string;
    let previousExpiresAt: Date | null = null;
    let newExpiresAt: Date;
    let actionType: string;

    if (existingSub) {
      subscriptionId = existingSub.id;
      previousExpiresAt = existingSub.expiresAt;
      actionType = "SUBSCRIPTION_RENEWED";
      
      const isActive = existingSub.status === "ACTIVE" && existingSub.expiresAt > now;

      if (isActive) {
        // Extend existing expiration
        newExpiresAt = new Date(existingSub.expiresAt.getTime() + durationMs);
        
        await tx.subscription.update({
          where: { id: existingSub.id },
          data: {
            expiresAt: newExpiresAt,
            status: "ACTIVE"
          }
        });
      } else {
        // Subscription expired, start a new period from now
        newExpiresAt = new Date(now.getTime() + durationMs);
        
        await tx.subscription.update({
          where: { id: existingSub.id },
          data: {
            startsAt: now,
            expiresAt: newExpiresAt,
            status: "ACTIVE"
          }
        });
      }
    } else {
      actionType = "SUBSCRIPTION_ACTIVATED";
      newExpiresAt = new Date(now.getTime() + durationMs);
      
      // Rely on @@unique([userId, planId]) to prevent concurrent insertions from producing duplicates
      const newSub = await tx.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId,
          status: "ACTIVE",
          startsAt: now,
          expiresAt: newExpiresAt
        }
      });
      subscriptionId = newSub.id;
    }

    // 3. Mark the payment as consumed by linking it to the subscription
    await tx.payment.update({
      where: { id: payment.id },
      data: { subscriptionId }
    });

    // 4. Record AuditLog
    await tx.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: actionType,
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: {
          paymentId: payment.id,
          planId: payment.planId,
          userId: payment.userId,
          previousExpiresAt: previousExpiresAt ? previousExpiresAt.toISOString() : null,
          newExpiresAt: newExpiresAt.toISOString()
        }
      }
    });

    return {
      subscriptionId,
      status: "ACTIVE",
      expiresAt: newExpiresAt
    };
  }
}
