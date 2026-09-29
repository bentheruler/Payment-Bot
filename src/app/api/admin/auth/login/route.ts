import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { cookies } from "next/headers";

// Very simple memory-based rate limiting for V1.
// Documented limitation: This is scoped per-instance in serverless environments.
// For production hardening (Phase 8), Redis could be used.
const loginAttempts = new Map<string, { count: number; timestamp: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt) {
    // Reset after 15 minutes
    if (now - attempt.timestamp > 15 * 60 * 1000) {
      loginAttempts.set(ip, { count: 1, timestamp: now });
      return true;
    }
    if (attempt.count >= 5) {
      return false; // Rate limited
    }
    attempt.count++;
    return true;
  }
  loginAttempts.set(ip, { count: 1, timestamp: now });
  return true;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword || expectedPassword.length === 0) {
      console.error("ADMIN_PASSWORD is not set on the server.");
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    // Use double-hashing constant-time comparison to prevent timing attacks and length leakage
    const expectedHash = crypto.createHash("sha256").update(expectedPassword).digest();
    const providedHash = crypto.createHash("sha256").update(password).digest();

    if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
      // Intentionally not logging the failed password
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Success - reset rate limit
    loginAttempts.delete(ip);

    // Generate secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    
    // 12 hours expiration
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const session = await prisma.authSession.create({
      data: {
        tokenHash,
        status: "AUTHENTICATED", // Lifecycle state
        userId: null, // Strictly null for admin principal
        expiresAt,
      }
    });

    // Add audit log
    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        action: "ADMIN_LOGIN",
        entityType: "AuthSession",
        entityId: session.id,
      }
    });

    // Set HttpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: expiresAt
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
