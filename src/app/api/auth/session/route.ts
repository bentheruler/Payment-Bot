import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateConnectionToken } from "@/lib/auth";

export async function POST() {
  try {
    const { token, tokenHash } = generateConnectionToken();

    // Set expiration to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.authSession.create({
      data: {
        tokenHash,
        expiresAt,
        status: "PENDING",
      },
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Failed to create auth session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
