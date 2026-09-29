import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const session = await getAdminSession();
    
    if (session) {
      // Mark expired in DB
      await prisma.authSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date() }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          actorType: "ADMIN",
          action: "ADMIN_LOGOUT",
          entityType: "AuthSession",
          entityId: session.id,
        }
      });
    }

    // Always clear the cookie
    const cookieStore = await cookies();
    cookieStore.delete("admin_session");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
