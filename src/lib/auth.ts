import crypto from "crypto";

/**
 * AuthSession Security Invariants:
 * 1. PENDING + userId=null: Unauthenticated customer Telegram-link session (awaiting Telegram auth).
 * 2. AUTHENTICATED + userId=<user>: Authenticated customer session.
 * 3. AUTHENTICATED + userId=null: Admin session. Created ONLY by the secure admin login route.
 * 4. Expired/used sessions cannot authenticate (expiresAt must be checked).
 */
export function generateConnectionToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
