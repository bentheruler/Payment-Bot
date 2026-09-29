import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const action = searchParams.get("action");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.auditLog.count({ where })
    ]);

    return NextResponse.json({
      data: logs,
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
    console.error("Admin audit logs list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
