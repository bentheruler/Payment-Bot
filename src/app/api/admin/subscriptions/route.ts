import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
    const status = searchParams.get("status");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) {
      if (status === "ACTIVE") {
        where.status = "ACTIVE";
        where.expiresAt = { gt: new Date() };
      } else if (status === "EXPIRED") {
        // Either status is EXPIRED, or it's ACTIVE but time has passed (waiting for cron)
        where.OR = [
          { status: "EXPIRED" },
          { status: "ACTIVE", expiresAt: { lte: new Date() } }
        ];
      } else {
        where.status = status;
      }
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { telegramId: true, firstName: true, telegramUsername: true } },
          plan: { select: { name: true, price: true, currency: true } }
        }
      }),
      prisma.subscription.count({ where })
    ]);

    const formatted = subscriptions.map(s => ({
      ...s,
      user: {
        ...s.user,
        telegramId: s.user.telegramId.toString()
      },
      plan: {
        ...s.plan,
        price: s.plan.price.toString()
      }
    }));

    return NextResponse.json({
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    if (error instanceof Error ? error.message : String(error) === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin subscriptions list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
