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
    const provider = searchParams.get("provider");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { telegramId: true, firstName: true, telegramUsername: true } },
          plan: { select: { name: true } }
        }
      }),
      prisma.payment.count({ where })
    ]);

    const formatted = payments.map(p => {
      // Exclude providerPayload for basic list to save bandwidth and not leak secrets
      const {  ...safePayment } = p;
      return {
        ...safePayment,
        amount: safePayment.amount.toString(),
        user: {
          ...safePayment.user,
          telegramId: safePayment.user.telegramId.toString()
        }
      };
    });

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
    console.error("Admin payments list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
