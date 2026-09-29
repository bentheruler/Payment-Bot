import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { TelegramAccessService } from "@/lib/telegram/access-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const access = await prisma.telegramAccess.findUnique({
      where: { id },
      include: { subscription: true }
    });

    if (!access) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const { subscription } = access;
    const now = new Date();

    // Critical authorization check: only retry if the subscription is actively entitled
    if (subscription.status !== "ACTIVE" || subscription.expiresAt <= now) {
      return NextResponse.json({ error: "Cannot provision access for an expired or inactive subscription." }, { status: 403 });
    }

    // Call existing business logic
    const newAccess = await TelegramAccessService.provisionAccess(subscription.id);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: session.id, // Using the admin AuthSession ID as the actorId
        action: "ADMIN_TELEGRAM_PROVISION_RETRY",
        entityType: "TelegramAccess",
        entityId: newAccess.id,
        metadata: {
          previousStatus: access.status,
          newStatus: newAccess.status,
        }
      }
    });

    return NextResponse.json({ success: true, data: newAccess });
  } catch (error) {
    if (error instanceof Error ? error.message : String(error) === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin access retry error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
