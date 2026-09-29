import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const tokenHash = hashToken(token);

  try {
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
    });

    if (!session) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (session.expiresAt < new Date()) {
      // Mark expired in DB if not already
      if (session.status !== "EXPIRED") {
        await prisma.authSession.update({
          where: { id: session.id },
          data: { status: "EXPIRED" },
        });
      }
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    if (session.status === "AUTHENTICATED") {
      const response = NextResponse.json({ 
        status: "AUTHENTICATED", 
        userId: session.userId 
      });
      
      response.cookies.set("customer_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        expires: session.expiresAt
      });

      return response;
    }

    return NextResponse.json({ status: session.status });
  } catch (error) {
    console.error("Failed to get session status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
