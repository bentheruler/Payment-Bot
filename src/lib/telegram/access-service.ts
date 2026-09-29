import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { createChatInviteLink, approveChatJoinRequest, declineChatJoinRequest, sendMessage } from "../telegram";

export class TelegramAccessService {
  /**
   * Provisions Telegram access for a given subscription.
   * If access is already provisioned, it acts idempotently and returns the existing access.
   */
  static async provisionAccess(subscriptionId: string) {
    // 1. Verify subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, plan: true }
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.status !== "ACTIVE" || subscription.expiresAt <= new Date()) {
      throw new Error("Subscription is not active or has expired");
    }

    // 2. Check if access already exists (idempotency & concurrency check)
    const existingAccess = await prisma.telegramAccess.findUnique({
      where: { subscriptionId }
    });

    if (existingAccess) {
      if (existingAccess.status === "INVITED" || existingAccess.status === "ACTIVE") {
        try {
          if (subscription.user?.telegramId) {
            await sendMessage(
              subscription.user.telegramId, 
              `🎉 <b>Payment confirmed!</b>\n\nYour subscription is active and has been extended.\n\n📅 Access duration: ${subscription.plan.durationDays} days\n\nTap below to go to the private channel:`,
              {
                inline_keyboard: [
                  [{ text: "🔐 Open Private Channel", url: existingAccess.inviteLink }]
                ]
              }
            );
          }
        } catch (e) {
          console.error("Failed to send extension link to user:", e);
        }
        return existingAccess;
      }
      // If it exists but is REVOKED/etc, we should probably throw or re-provision.
      // For now, if it exists we just return it if it's valid, otherwise error.
      if (existingAccess.status === "REVOKED") {
        // Safe to reuse the revoked record for a new provisioning cycle.
        const chatId = process.env.TELEGRAM_CHANNEL_ID;
        if (!chatId) {
          throw new Error("TELEGRAM_CHANNEL_ID is not configured");
        }

        const inviteLink = await createChatInviteLink(
          chatId,
          `Sub_${subscription.plan.name}_${subscription.userId.slice(0, 8)}`
        );

        const updatedAccess = await prisma.telegramAccess.update({
          where: { id: existingAccess.id },
          data: {
            inviteLink,
            status: "INVITED",
            revokedAt: null,
            joinedAt: null
          }
        });
        
        try {
          if (subscription.user?.telegramId) {
            await sendMessage(
              subscription.user.telegramId, 
              `🎉 <b>Payment confirmed!</b>\n\nYour subscription is now active.\n\n📅 Access duration: ${subscription.plan.durationDays} days\n\nTap below to join the private channel:`,
              {
                inline_keyboard: [
                  [{ text: "🔐 Join Private Channel", url: inviteLink }]
                ]
              }
            );
          }
        } catch (e) {
          console.error("Failed to send invite link to user:", e);
        }
        
        return updatedAccess;
      }
    }

    const chatId = process.env.TELEGRAM_CHANNEL_ID;
    if (!chatId) {
      throw new Error("TELEGRAM_CHANNEL_ID is not configured");
    }

    // 3. Provision new invite link via Telegram API
    // If this throws, the database remains in a consistent state without TelegramAccess,
    // allowing safe retry later.
    const inviteLink = await createChatInviteLink(
      chatId, 
      `Sub_${subscription.plan.name}_${subscription.userId.slice(0, 8)}`
    );

    // 4. Create the TelegramAccess record
    try {
      const access = await prisma.telegramAccess.create({
        data: {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          chatId: chatId,
          inviteLink: inviteLink,
          status: "INVITED"
        }
      });
      
      try {
        if (subscription.user?.telegramId) {
          await sendMessage(
            subscription.user.telegramId, 
            `🎉 <b>Payment confirmed!</b>\n\nYour subscription is now active.\n\n📅 Access duration: ${subscription.plan.durationDays} days\n\nTap below to join the private channel:`,
            {
              inline_keyboard: [
                [{ text: "🔐 Join Private Channel", url: inviteLink }]
              ]
            }
          );
        }
      } catch (e) {
        console.error("Failed to send invite link to user:", e);
      }
      
      return access;
    } catch (error  ) {
      // Handle the rare race condition where two concurrent requests passed the findUnique check
      // and both called Telegram API. Unique constraint will fail on one.
      // In this case, we just return the newly created one by the winner.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         const wonAccess = await prisma.telegramAccess.findUnique({
           where: { subscriptionId }
         });
         if (wonAccess) return wonAccess;
      }
      throw error;
    }
  }

  /**
   * Handles an incoming chat_join_request from the Telegram webhook.
   * Performs authorization and either approves or declines the request.
   */
  static async handleJoinRequest(chatId: string, telegramId: bigint, inviteLinkUrl?: string) {
    const configuredChatId = process.env.TELEGRAM_CHANNEL_ID;
    
    // 1. Verify correct channel
    if (chatId !== configuredChatId) {
      try {
        await declineChatJoinRequest(chatId, telegramId);
      } catch { /* ignore */ }
      return { status: 'DECLINED', reason: 'Wrong channel' };
    }

    // 2. Identify the user
    console.log("[DIAGNOSTICS] SUBSCRIPTION_CHECK_START");
    const tCheckStart = performance.now();
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        subscriptions: {
          where: {
            status: "ACTIVE",
            expiresAt: { gt: new Date() }
          },
          include: {
            telegramAccesses: true
          }
        }
      }
    });
    console.log(`[DIAGNOSTICS] SUBSCRIPTION_CHECK_END: ${(performance.now() - tCheckStart).toFixed(2)}ms`);

    if (!user) {
      await declineChatJoinRequest(chatId, telegramId);
      try {
        await sendMessage(telegramId, `Hello! To join this private channel, you first need to create an account and subscribe.\n\nPlease visit our website to subscribe: ${process.env.NEXT_PUBLIC_APP_URL || 'https://parcel-power-dividable.ngrok-free.dev'}`);
      } catch (e) {
        console.error("Failed to send message to user:", e);
      }
      return { status: 'DECLINED', reason: 'Unknown Telegram user' };
    }

    if (user.subscriptions.length === 0) {
      await declineChatJoinRequest(chatId, telegramId);
      try {
        await sendMessage(telegramId, `Hello! We couldn't find an active subscription for your account.\n\nPlease visit our website to subscribe and gain access: ${process.env.NEXT_PUBLIC_APP_URL || 'https://parcel-power-dividable.ngrok-free.dev'}`);
      } catch (e) {
        console.error("Failed to send message to user:", e);
      }
      return { status: 'DECLINED', reason: 'No active subscription' };
    }

    console.log("[DIAGNOSTICS] SUBSCRIPTION_ACTIVE");

    // 3. Find a matching active subscription with a valid access record
    let targetAccess = null;

    for (const sub of user.subscriptions) {
      for (const access of sub.telegramAccesses) {
        if (access.status === "INVITED" || access.status === "ACTIVE") {
          if (inviteLinkUrl) {
            if (access.inviteLink === inviteLinkUrl) {
              targetAccess = access;
              break;
            }
          } else {
             targetAccess = access;
             break;
          }
        }
      }
      if (targetAccess) break;
    }

    if (!targetAccess) {
      await declineChatJoinRequest(chatId, telegramId);
      return { status: 'DECLINED', reason: 'Wrong or missing invite link / no valid access record' };
    }

    // 4. All checks passed, approve
    console.log("[DIAGNOSTICS] TELEGRAM_APPROVAL_START");
    const tApprovalStart = performance.now();
    try {
      await approveChatJoinRequest(chatId, telegramId);
      console.log(`[DIAGNOSTICS] TELEGRAM_APPROVAL_SUCCESS: ${(performance.now() - tApprovalStart).toFixed(2)}ms`);
    } catch (apiError: unknown) {
      const err = apiError instanceof Error ? apiError : new Error(String(apiError));
      console.error(`[DIAGNOSTICS] TELEGRAM_APPROVAL_FAILURE: ${err.message}`);
      throw err;
    }

    // 5. Update state to ACTIVE
    console.log("[DIAGNOSTICS] ACCESS_DB_UPDATE_START");
    const tDbStart = performance.now();
    if (targetAccess.status !== "ACTIVE") {
      await prisma.telegramAccess.update({
        where: { id: targetAccess.id },
        data: {
          status: "ACTIVE",
          joinedAt: new Date()
        }
      });
    }
    console.log(`[DIAGNOSTICS] ACCESS_DB_UPDATE_END: ${(performance.now() - tDbStart).toFixed(2)}ms`);

    return { status: 'APPROVED' };
  }
}
