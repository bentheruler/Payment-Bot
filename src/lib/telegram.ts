import { NextRequest } from "next/server";

export function verifyTelegramWebhook(req: NextRequest): boolean {
  const secretToken = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedToken) {
    console.warn("TELEGRAM_WEBHOOK_SECRET is not set in environment.");
    return false;
  }

  return secretToken === expectedToken;
}

export async function createChatInviteLink(chatId: string, name: string): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      name: name,
      creates_join_request: true
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Failed to create invite link: ${data.description}`);
  }

  return data.result.invite_link;
}

export async function approveChatJoinRequest(chatId: string, userId: bigint): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/approveChatJoinRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId.toString()
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Failed to approve join request: ${data.description}`);
  }
}

export async function declineChatJoinRequest(chatId: string, userId: bigint): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/declineChatJoinRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId.toString()
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Failed to decline join request: ${data.description}`);
  }
}

export async function revokeChatInviteLink(chatId: string, inviteLink: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/revokeChatInviteLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      invite_link: inviteLink
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Failed to revoke invite link: ${data.description}`);
  }
}

export async function banChatMember(chatId: string, userId: bigint): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/banChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId.toString()
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Failed to ban chat member: ${data.description}`);
  }
}

export async function unbanChatMember(chatId: string, userId: bigint): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/unbanChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId.toString(),
      only_if_banned: true // Unban safely
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Failed to unban chat member: ${data.description}`);
  }
}

export async function sendMessage(chatId: string | bigint, text: string, replyMarkup?: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId.toString(),
      text: text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Failed to send message: ${data.description}`);
  }
}
