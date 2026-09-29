import { NextResponse } from "next/server";
import { SubscriptionExpirationService } from "@/lib/subscriptions/expiration-service";
import crypto from "crypto";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expectedHash = crypto.createHash("sha256").update(expectedSecret).digest();
  const tokenHash = crypto.createHash("sha256").update(token).digest();

  if (!crypto.timingSafeEqual(expectedHash, tokenHash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await SubscriptionExpirationService.processExpirations(100);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Expiration cron failed:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
