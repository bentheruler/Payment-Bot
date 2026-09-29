import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Next.js 15+ route params are Promises
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    const cookieStore = await cookies();
    const token = cookieStore.get("customer_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session || session.status !== "AUTHENTICATED" || !session.user) {
      return NextResponse.json({ error: "Unauthorized or unauthenticated session" }, { status: 401 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 }); // Do not leak existence
    }

    if (payment.userId !== session.user.id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 }); // Do not leak existence
    }

    return NextResponse.json({ status: payment.status });
  } catch (error: unknown) {
    console.error("Payment status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
