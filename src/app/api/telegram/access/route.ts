import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { TelegramAccessService } from "@/lib/telegram/access-service";
import { cookies } from "next/headers";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_session")?.value;

  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.status !== "AUTHENTICATED" || !session.userId || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's active subscription and its access record
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      expiresAt: { gt: new Date() }
    },
    include: {
      telegramAccesses: true
    },
    orderBy: { expiresAt: "desc" }
  });

  if (!subscription) {
    return NextResponse.json({ status: "NONE", message: "No active subscription" }, { status: 200 });
  }

  if (subscription.telegramAccesses.length === 0) {
    return NextResponse.json({ status: "PENDING", message: "Access not yet provisioned" }, { status: 200 });
  }

  // Assuming one main valid access record
  const access = subscription.telegramAccesses[0];

  return NextResponse.json({
    status: access.status,
    inviteLink: access.status === "INVITED" ? access.inviteLink : null
  }, { status: 200 });
}

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Retry provisioning for the active subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      expiresAt: { gt: new Date() }
    },
    orderBy: { expiresAt: "desc" }
  });

  if (!subscription) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  try {
    const access = await TelegramAccessService.provisionAccess(subscription.id);
    return NextResponse.json({
      status: access.status,
      inviteLink: access.status === "INVITED" ? access.inviteLink : null
    }, { status: 200 });
  } catch (error) {
    console.error("Provisioning retry failed:", error);
    return NextResponse.json({ error: "Provisioning failed" }, { status: 500 });
  }
}
