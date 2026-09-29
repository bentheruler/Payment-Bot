import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    
    // In Next.js 16.3.3, params should be awaited if they are promises (dynamic routing).
    // The type says Promise<{id: string}>.
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: "desc" }
        },
        payments: {
          include: { plan: true },
          orderBy: { createdAt: "desc" }
        },
        telegramAccesses: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      telegramId: user.telegramId.toString(),
      payments: user.payments.map(p => ({
        ...p,
        amount: p.amount.toString()
      }))
    });
  } catch (error) {
    if (error instanceof Error ? error.message : String(error) === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
