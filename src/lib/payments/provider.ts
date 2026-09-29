

export interface CreateInvoiceParams {
  amount: string; // "10.00"
  currency: string; // "USD"
  description: string;
  payload: string; // Our internal payment ID
}

export interface WebhookEventData {
  providerInvoiceId: string;
  status: "PAID" | "EXPIRED" | "FAILED" | "PENDING";
  amount: string;
  currency: string; // "USD"
  rawPayload: unknown;
}

export interface PaymentProvider {
  /**
   * Creates a new payment invoice on the provider.
   */
  createInvoice(params: CreateInvoiceParams): Promise<{ invoiceId: string; url: string }>;

  /**
   * Verifies the authenticity of the incoming webhook.
   */
  verifyWebhook(rawBody: string, headers: Headers): boolean;

  /**
   * Parses the validated webhook into a normalized format.
   */
  parseWebhook(body: unknown): WebhookEventData;
}
