import { cookies } from "next/headers";
import { prisma } from "./prisma";
import crypto from "crypto";

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const session = await prisma.authSession.findUnique({
    where: { tokenHash }
  });

  if (!session) return null;
  
  // Security invariants for admin session
  if (session.status !== "AUTHENTICATED") return null;
  if (session.userId !== null) return null; // Must not be linked to a customer
  if (session.expiresAt < new Date()) return null;

  return session;
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
