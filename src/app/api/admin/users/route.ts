import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { telegramUsername: { contains: search, mode: "insensitive" as const } },
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          subscriptions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { status: true, expiresAt: true }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    // Format bigints
    const formattedUsers = users.map(user => ({
      ...user,
      telegramId: user.telegramId.toString(),
    }));

    return NextResponse.json({
      data: formattedUsers,
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
    console.error("Admin users list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
