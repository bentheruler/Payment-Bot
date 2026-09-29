import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminSession();

    const now = new Date();

    const [
      totalUsers,
      activeSubscriptions,
      paidPaymentsResult,
      recentActivity
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({
        where: {
          status: "ACTIVE",
          expiresAt: { gt: now }
        }
      }),
      prisma.payment.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true }
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    // Prisma returns Decimal object for amount sum, safely convert to string to preserve precision
    const totalRevenue = paidPaymentsResult._sum.amount?.toString() || "0";

    return NextResponse.json({
      metrics: {
        totalUsers,
        activeSubscriptions,
        totalRevenue
      },
      recentActivity
    });
  } catch (error) {
    if (error instanceof Error ? error.message : String(error) === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin overview error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
