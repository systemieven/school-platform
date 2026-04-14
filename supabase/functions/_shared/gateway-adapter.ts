/**
 * Gateway Adapter — Interfaces for payment gateway integrations.
 * Each provider (Asaas, Efi, etc.) implements GatewayAdapter.
 */

// ── Customer ─────────────────────────────────────────────────────────────────
export interface CreateCustomerInput {
  name: string;
  cpf_cnpj: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface CustomerResult {
  provider_customer_id: string;
  raw: Record<string, unknown>;
}

// ── Charge ───────────────────────────────────────────────────────────────────
export interface CreateChargeInput {
  provider_customer_id: string;
  amount_cents: number;
  due_date: string; // YYYY-MM-DD
  description: string;
  billing_type: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
  installment_id?: string;
  external_reference?: string;
  fine_percent?: number;
  interest_percent?: number;
  discount_value?: number;
  discount_due_date?: string;
}

export interface ChargeResult {
  provider_charge_id: string;
  status: string;
  boleto_url?: string;
  pix_code?: string;
  payment_link?: string;
  raw: Record<string, unknown>;
}

export interface GetChargeResult {
  provider_charge_id: string;
  status: string;
  paid_at?: string;
  paid_amount_cents?: number;
  payment_method?: string;
  boleto_url?: string;
  pix_code?: string;
  payment_link?: string;
  raw: Record<string, unknown>;
}

// ── Webhook ──────────────────────────────────────────────────────────────────
export interface NormalizedWebhookEvent {
  event_type: string;        // "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", etc.
  provider_charge_id: string;
  status: string;            // normalized status
  paid_at?: string;
  paid_amount_cents?: number;
  payment_method?: string;
}

// ── Adapter interface ────────────────────────────────────────────────────────
export interface GatewayAdapter {
  provider: string;

  createCustomer(input: CreateCustomerInput): Promise<CustomerResult>;
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  getCharge(provider_charge_id: string): Promise<GetChargeResult>;
  cancelCharge(provider_charge_id: string): Promise<{ success: boolean; raw: Record<string, unknown> }>;

  /**
   * Parse and normalize an incoming webhook payload.
   * Returns null if the event type is not relevant.
   */
  parseWebhook(body: Record<string, unknown>): NormalizedWebhookEvent | null;

  /**
   * Verify webhook signature. Returns true if valid.
   */
  verifyWebhookSignature(body: string, signature: string, secret: string): boolean;
}
