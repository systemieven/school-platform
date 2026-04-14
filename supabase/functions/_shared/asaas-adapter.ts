/**
 * Asaas Gateway Adapter
 *
 * Implements GatewayAdapter for Asaas (https://docs.asaas.com).
 * Supports sandbox and production environments.
 */
import type {
  GatewayAdapter,
  CreateCustomerInput,
  CustomerResult,
  CreateChargeInput,
  ChargeResult,
  GetChargeResult,
  NormalizedWebhookEvent,
} from "./gateway-adapter.ts";

const ASAAS_URLS: Record<string, string> = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  production: "https://api.asaas.com/api/v3",
};

// Asaas status → normalized status
const STATUS_MAP: Record<string, string> = {
  PENDING: "pending",
  RECEIVED: "paid",
  CONFIRMED: "paid",
  OVERDUE: "overdue",
  REFUNDED: "refunded",
  RECEIVED_IN_CASH: "paid",
  REFUND_REQUESTED: "refund_requested",
  REFUND_IN_PROGRESS: "refund_in_progress",
  CHARGEBACK_REQUESTED: "chargeback",
  CHARGEBACK_DISPUTE: "chargeback",
  AWAITING_CHARGEBACK_REVERSAL: "chargeback",
  DUNNING_REQUESTED: "overdue",
  DUNNING_RECEIVED: "paid",
  AWAITING_RISK_ANALYSIS: "pending",
};

// Relevant webhook event types
const RELEVANT_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_UPDATED",
]);

export class AsaasAdapter implements GatewayAdapter {
  provider = "asaas";
  private baseUrl: string;
  private apiKey: string;

  constructor(environment: string, apiKey: string) {
    this.baseUrl = ASAAS_URLS[environment] || ASAAS_URLS.sandbox;
    this.apiKey = apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: this.apiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json();
    if (!res.ok) {
      const errors = Array.isArray(data.errors)
        ? data.errors.map((e: { description: string }) => e.description).join("; ")
        : JSON.stringify(data);
      throw new Error(`Asaas ${method} ${path} failed (${res.status}): ${errors}`);
    }
    return data as T;
  }

  // ── Customer ─────────────────────────────────────────────────────────────
  async createCustomer(input: CreateCustomerInput): Promise<CustomerResult> {
    const payload: Record<string, unknown> = {
      name: input.name,
      cpfCnpj: input.cpf_cnpj.replace(/\D/g, ""),
    };
    if (input.email) payload.email = input.email;
    if (input.phone) payload.mobilePhone = input.phone.replace(/\D/g, "");
    if (input.address) {
      payload.address = input.address.street;
      payload.addressNumber = input.address.number;
      payload.complement = input.address.complement || "";
      payload.province = input.address.neighborhood;
      payload.postalCode = input.address.zip.replace(/\D/g, "");
    }

    const data = await this.request<{ id: string }>("POST", "/customers", payload);
    return { provider_customer_id: data.id, raw: data as unknown as Record<string, unknown> };
  }

  // ── Charge ───────────────────────────────────────────────────────────────
  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const payload: Record<string, unknown> = {
      customer: input.provider_customer_id,
      billingType: input.billing_type,
      value: input.amount_cents / 100,
      dueDate: input.due_date,
      description: input.description,
    };
    if (input.external_reference) payload.externalReference = input.external_reference;
    if (input.fine_percent) {
      payload.fine = { value: input.fine_percent, type: "PERCENTAGE" };
    }
    if (input.interest_percent) {
      payload.interest = { value: input.interest_percent, type: "PERCENTAGE" };
    }
    if (input.discount_value && input.discount_due_date) {
      payload.discount = {
        value: input.discount_value / 100,
        dueDateLimitDays: 0,
        type: "FIXED",
      };
    }

    const data = await this.request<{
      id: string;
      status: string;
      bankSlipUrl?: string;
      invoiceUrl?: string;
    }>("POST", "/payments", payload);

    // If PIX, fetch QR code
    let pixCode: string | undefined;
    if (input.billing_type === "PIX" || input.billing_type === "UNDEFINED") {
      try {
        const pixData = await this.request<{ payload?: string }>("GET", `/payments/${data.id}/pixQrCode`);
        pixCode = pixData.payload;
      } catch { /* PIX may not be available */ }
    }

    return {
      provider_charge_id: data.id,
      status: STATUS_MAP[data.status] || data.status,
      boleto_url: data.bankSlipUrl,
      pix_code: pixCode,
      payment_link: data.invoiceUrl,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  // ── Get Charge ───────────────────────────────────────────────────────────
  async getCharge(provider_charge_id: string): Promise<GetChargeResult> {
    const data = await this.request<{
      id: string;
      status: string;
      confirmedDate?: string;
      paymentDate?: string;
      value: number;
      netValue?: number;
      billingType?: string;
      bankSlipUrl?: string;
      invoiceUrl?: string;
    }>("GET", `/payments/${provider_charge_id}`);

    let pixCode: string | undefined;
    try {
      const pixData = await this.request<{ payload?: string }>("GET", `/payments/${provider_charge_id}/pixQrCode`);
      pixCode = pixData.payload;
    } catch { /* ignore */ }

    const billingTypeMap: Record<string, string> = {
      BOLETO: "boleto",
      PIX: "pix",
      CREDIT_CARD: "credit_card",
      DEBIT_CARD: "debit_card",
      UNDEFINED: "other",
    };

    return {
      provider_charge_id: data.id,
      status: STATUS_MAP[data.status] || data.status,
      paid_at: data.confirmedDate || data.paymentDate,
      paid_amount_cents: data.netValue ? Math.round(data.netValue * 100) : Math.round(data.value * 100),
      payment_method: billingTypeMap[data.billingType || ""] || data.billingType,
      boleto_url: data.bankSlipUrl,
      pix_code: pixCode,
      payment_link: data.invoiceUrl,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  async cancelCharge(provider_charge_id: string): Promise<{ success: boolean; raw: Record<string, unknown> }> {
    const data = await this.request<Record<string, unknown>>("DELETE", `/payments/${provider_charge_id}`);
    return { success: true, raw: data };
  }

  // ── Webhook ──────────────────────────────────────────────────────────────
  parseWebhook(body: Record<string, unknown>): NormalizedWebhookEvent | null {
    const event = body.event as string;
    if (!event || !RELEVANT_EVENTS.has(event)) return null;

    const payment = body.payment as Record<string, unknown> | undefined;
    if (!payment) return null;

    const billingTypeMap: Record<string, string> = {
      BOLETO: "boleto",
      PIX: "pix",
      CREDIT_CARD: "credit_card",
    };

    return {
      event_type: event,
      provider_charge_id: payment.id as string,
      status: STATUS_MAP[payment.status as string] || (payment.status as string),
      paid_at: (payment.confirmedDate || payment.paymentDate) as string | undefined,
      paid_amount_cents: payment.netValue
        ? Math.round((payment.netValue as number) * 100)
        : payment.value
          ? Math.round((payment.value as number) * 100)
          : undefined,
      payment_method: billingTypeMap[payment.billingType as string] || (payment.billingType as string),
    };
  }

  verifyWebhookSignature(_body: string, signature: string, secret: string): boolean {
    // Asaas webhook uses a simple token comparison (accessToken in header)
    return signature === secret;
  }
}
