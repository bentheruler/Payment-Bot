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
    if (status) where.status = status;

    const [accesses, total] = await Promise.all([
      prisma.telegramAccess.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { telegramId: true, firstName: true, telegramUsername: true } },
          subscription: { select: { status: true, expiresAt: true } }
        }
      }),
      prisma.telegramAccess.count({ where })
    ]);

    const formatted = accesses.map(a => ({
      ...a,
      user: {
        ...a.user,
        telegramId: a.user.telegramId.toString()
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
    console.error("Admin access list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
