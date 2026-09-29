import crypto from "crypto";
import { CreateInvoiceParams, PaymentProvider, WebhookEventData } from "./provider";

export class CryptoPayProvider implements PaymentProvider {
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiToken = process.env.CRYPTO_PAY_API_TOKEN || "";
    if (!this.apiToken) {
      throw new Error("CRYPTO_PAY_API_TOKEN is missing");
    }
    // Crypto Pay TESTNET Safety:
    // CRYPTO_PAY_TESTNET must be explicitly set to 'true' or 'false'.
    // A missing configuration throws an error to prevent accidental mainnet transactions in test.
    const testnetFlag = process.env.CRYPTO_PAY_TESTNET;
    if (testnetFlag === "true") {
      this.baseUrl = "https://testnet-pay.crypt.bot/api";
    } else if (testnetFlag === "false") {
      this.baseUrl = "https://pay.crypt.bot/api";
    } else {
      throw new Error("CRYPTO_PAY_TESTNET configuration is missing or invalid. Must be 'true' or 'false'.");
    }
  }

  async createInvoice(params: CreateInvoiceParams): Promise<{ invoiceId: string; url: string }> {
    // Official API states: asset (e.g. USDT) OR fiat (e.g. USD).
    // We are requesting fiat=USD, amount=10.00
    const body = {
      currency_type: "fiat",
      fiat: params.currency, // "USD"
      amount: params.amount,
      description: params.description,
      payload: params.payload, // Our internal DB payment ID
      // Optional: paid_btn_name, paid_btn_url
    };

    const res = await fetch(`${this.baseUrl}/createInvoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Crypto-Pay-API-Token": this.apiToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Crypto Pay createInvoice failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!data.ok || !data.result) {
      throw new Error(`Crypto Pay returned error: ${JSON.stringify(data)}`);
    }

    // invoice_id is an integer in Crypto Pay
    const invoiceId = data.result.invoice_id.toString();
    const url = data.result.bot_invoice_url || data.result.mini_app_invoice_url || data.result.pay_url;

    return { invoiceId, url: url || data.result.pay_url || "" };
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const signature = headers.get("crypto-pay-api-signature");
    if (!signature) return false;

    // Secret = SHA256(API Token)
    const secret = crypto.createHash("sha256").update(this.apiToken).digest();
    
    // HMAC-SHA256(secret, rawBody)
    const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    // Constant-time comparison
    try {
      return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signature, "hex"));
    } catch {
      return false; // Length mismatch or invalid hex
    }
  }

  parseWebhook(body: unknown): WebhookEventData {
    // Current official documentation: The update contains update_id and update_type.
    // We are interested in invoice_paid.
    const safeBody = body as Record<string, unknown>;
    const type = safeBody.update_type;
    const payload = safeBody.payload as Record<string, unknown>; // This is the invoice object

    let status: WebhookEventData["status"] = "PENDING";
    if (type === "invoice_paid" && payload.status === "paid") {
      status = "PAID";
    } else if (payload.status === "expired") {
      status = "EXPIRED";
    }

    const providerInvoiceId = String(payload.invoice_id);

    // Use the requested fiat and amount if available, to match our DB expectations.
    // If we used `fiat: "USD"`, then payload.fiat = "USD" and payload.amount = "10.00".
    const amount = payload.fiat ? payload.amount : payload.paid_amount;
    const currency = payload.fiat || payload.asset;

    return {
      providerInvoiceId,
      status,
      amount: String(amount),
      currency: String(currency),
      rawPayload: safeBody,
    };
  }
}
