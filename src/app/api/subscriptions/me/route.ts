import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // Authenticate
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session || !session.user || session.status !== "AUTHENTICATED" || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Unauthorized or session expired" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch the user's subscription
    const subscription = await prisma.subscription.findFirst({
      where: { userId },
      include: { 
        plan: true,
        telegramAccesses: {
          where: { status: { in: ["INVITED", "ACTIVE"] } },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!subscription) {
      return NextResponse.json({ status: "NONE" }, { status: 200 });
    }

    const now = new Date();
    // STRICT active semantics
    const isActive = subscription.status === "ACTIVE" && subscription.expiresAt > now;

    let inviteLink = null;
    if (subscription.telegramAccesses.length > 0) {
      inviteLink = subscription.telegramAccesses[0].inviteLink;
    }

    return NextResponse.json({
      status: isActive ? "ACTIVE" : "EXPIRED",
      startsAt: subscription.startsAt.toISOString(),
      expiresAt: subscription.expiresAt.toISOString(),
      inviteLink,
      plan: {
        name: subscription.plan.name,
        price: subscription.plan.price.toString(),
        currency: subscription.plan.currency,
        durationDays: subscription.plan.durationDays
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error("Subscription me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
