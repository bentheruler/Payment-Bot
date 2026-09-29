import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { CryptoPayProvider } from "../../../../lib/payments/cryptopay";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function POST() {
  try {
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

    const plan = await prisma.plan.findFirst({
      where: { name: "Premium Monthly", active: true }
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        planId: plan.id,
        provider: "CRYPTO_PAY",
        amount: plan.price,
        currency: plan.currency,
        status: "PENDING",
      }
    });

    try {
      const provider = new CryptoPayProvider();
      const invoice = await provider.createInvoice({
        amount: plan.price.toString(),
        currency: plan.currency,
        description: `Payment for ${plan.name}`,
        payload: payment.id,
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerInvoiceId: invoice.invoiceId }
      });

      return NextResponse.json({ payUrl: invoice.url, paymentId: payment.id });
    } catch (providerError: unknown) {
      console.error("Crypto Pay API error:", providerError);
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" }
      });

      return NextResponse.json({ error: "Failed to communicate with payment provider" }, { status: 502 });
    }
  } catch (error: unknown) {
    console.error("Payment create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
