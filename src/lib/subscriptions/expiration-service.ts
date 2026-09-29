import { prisma } from "../prisma";
import { revokeChatInviteLink, banChatMember, unbanChatMember } from "../telegram";

export class SubscriptionExpirationService {
  static async processExpirations(batchSize = 50) {
    const candidates = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: new Date() }
      },
      include: {
        telegramAccesses: true,
        user: true
      },
      take: batchSize
    });

    const result = {
      scanned: candidates.length,
      expired: 0,
      telegramRevoked: 0,
      telegramFailures: 0
    };

    if (candidates.length === 0) return result;

    for (const subscription of candidates) {
      // Conditional update race protection
      const updateResult = await prisma.subscription.updateMany({
        where: {
          id: subscription.id,
          status: "ACTIVE",
          expiresAt: { lte: new Date() } // Ensure it is still expired
        },
        data: {
          status: "EXPIRED"
        }
      });

      if (updateResult.count === 0) {
        // Lost the race or already processed by another worker
        continue;
      }

      result.expired++;

      // Audit Log for subscription expiration
      await prisma.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "SUBSCRIPTION_EXPIRED",
          entityType: "Subscription",
          entityId: subscription.id,
          metadata: { userId: subscription.userId, planId: subscription.planId }
        }
      });

      // Handle Telegram Access
      for (const access of subscription.telegramAccesses) {
        if (access.status === "REVOKED") {
          continue;
        }

        if (access.status === "PENDING") {
          await prisma.telegramAccess.update({
            where: { id: access.id },
            data: { status: "REVOKED", revokedAt: new Date() }
          });
          await prisma.auditLog.create({
            data: { actorType: "SYSTEM", action: "TELEGRAM_ACCESS_REVOKED", entityType: "TelegramAccess", entityId: access.id, metadata: { reason: "Expired while PENDING" } }
          });
          result.telegramRevoked++;
          continue;
        }

        let revocationSuccess = true;
        let failureReason = "";

        // Attempt revoke invite link
        try {
          await revokeChatInviteLink(access.chatId, access.inviteLink);
          await prisma.auditLog.create({
            data: { actorType: "SYSTEM", action: "TELEGRAM_INVITE_REVOKED", entityType: "TelegramAccess", entityId: access.id, metadata: {} }
          });
        } catch (error) {
          console.warn(`Failed to revoke invite link for access ${access.id}:`, error instanceof Error ? error.message : String(error));
          // Don't mark as failure if we still need to ban them.
          // For INVITED state, failing to revoke the link IS a failure.
          if (access.status === "INVITED") {
             revocationSuccess = false;
             failureReason = "Failed to revoke invite link: " + (error instanceof Error ? error.message : String(error));
          }
        }

        // Attempt ban/unban if ACTIVE
        if (access.status === "ACTIVE") {
          try {
            await banChatMember(access.chatId, subscription.user.telegramId);
          } catch (error) {
            revocationSuccess = false;
            failureReason = "Failed to ban member: " + (error instanceof Error ? error.message : String(error));
          }

          if (revocationSuccess) {
            try {
              await unbanChatMember(access.chatId, subscription.user.telegramId);
            } catch (error) {
              revocationSuccess = false;
              failureReason = "Ban succeeded, but unban failed: " + (error instanceof Error ? error.message : String(error));
            }
          }
        }

        if (revocationSuccess) {
          await prisma.telegramAccess.update({
            where: { id: access.id },
            data: { status: "REVOKED", revokedAt: new Date() }
          });
          await prisma.auditLog.create({
            data: { actorType: "SYSTEM", action: "TELEGRAM_ACCESS_REVOKED", entityType: "TelegramAccess", entityId: access.id, metadata: { statusBefore: access.status } }
          });
          result.telegramRevoked++;
        } else {
          // Leave the access record as is (INVITED/ACTIVE) so it can be retried.
          await prisma.auditLog.create({
            data: { actorType: "SYSTEM", action: "TELEGRAM_ACCESS_REVOCATION_FAILED", entityType: "TelegramAccess", entityId: access.id, metadata: { reason: failureReason } }
          });
          result.telegramFailures++;
        }
      }
    }

    return result;
  }
}
