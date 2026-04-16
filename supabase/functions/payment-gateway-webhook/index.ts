/**
 * payment-gateway-webhook
 *
 * Public endpoint for receiving payment gateway webhooks.
 * Idempotent via gateway_webhook_log unique index.
 *
 * Handles two charge sources:
 *  1. financial_installments (mensalidades) — updates status + logs notification
 *  2. store_orders (PDV online charges)     — updates status to payment_confirmed
 *                                             + dispatches WhatsApp via uazapi
 *
 * Auth: webhook_secret verification per provider.
 * Route: POST /functions/v1/payment-gateway-webhook?provider=asaas&gateway_id=<uuid>
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AsaasAdapter } from "../_shared/asaas-adapter.ts";
import type { GatewayAdapter, NormalizedWebhookEvent } from "../_shared/gateway-adapter.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, asaas-access-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function getAdapter(provider: string, apiKey: string): GatewayAdapter {
  switch (provider) {
    case "asaas":
      return new AsaasAdapter("production", apiKey);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface OrderForWebhook {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_method: string | null;
  guardian: { id: string; full_name: string; phone: string | null } | null;
  student: { id: string; full_name: string } | null;
  items: Array<{ product_name: string; variant_description: string | null; quantity: number; unit_price: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Dispatch a WhatsApp notification for a store order event.
 * Reads credentials + template from DB and calls uazapi directly.
 * Never throws — errors are logged only.
 */
async function dispatchOrderWhatsApp(
  // deno-lint-ignore no-explicit-any
  service: any,
  order: OrderForWebhook,
  triggerEvent: string,
): Promise<void> {
  const phone = order.guardian?.phone;
  if (!phone) {
    console.warn(`[webhook] No guardian phone for order ${order.order_number}, skipping WhatsApp`);
    return;
  }

  // Load WhatsApp credentials
  const { data: settingsRows } = await service
    .from("system_settings")
    .select("key, value")
    .or("key.eq.instance_url,key.eq.api_token,key.eq.school_name")
    .eq("category", "whatsapp");

  const whatsappMap: Record<string, string> = {};
  let schoolName = "Colégio";
  (settingsRows ?? []).forEach((r: { key: string; value: unknown }) => {
    if (r.key === "school_name") {
      schoolName = String(r.value ?? "Colégio");
    } else {
      whatsappMap[r.key] = String(r.value ?? "");
    }
  });

  // Also check system_settings without category filter for school_name
  if (schoolName === "Colégio") {
    const { data: nameRow } = await service
      .from("system_settings")
      .select("value")
      .eq("key", "school_name")
      .single();
    if (nameRow?.value) schoolName = String(nameRow.value);
  }

  const instanceUrl = whatsappMap["instance_url"]?.trim();
  const apiToken    = whatsappMap["api_token"]?.trim();

  if (!instanceUrl || !apiToken) {
    console.warn("[webhook] WhatsApp not configured, skipping notification");
    return;
  }

  // Fetch template
  const { data: templates } = await service
    .from("whatsapp_templates")
    .select("content, variables")
    .eq("category", "pedidos")
    .eq("trigger_event", triggerEvent)
    .eq("is_active", true)
    .limit(1);

  if (!templates?.length) {
    console.warn(`[webhook] No active template for trigger_event=${triggerEvent}`);
    return;
  }

  const tpl = templates[0];
  const bodyText: string = (tpl.content as { body?: string })?.body ?? "";

  // Build variables
  const itemsSummary = (order.items ?? [])
    .map((it) => `${it.product_name}${it.variant_description ? ` (${it.variant_description})` : ""} ×${it.quantity}`)
    .join(", ");

  const now = new Date();
  const vars: Record<string, string> = {
    numero_pedido:    order.order_number,
    nome_responsavel: order.guardian?.full_name ?? "Responsável",
    nome_aluno:       order.student?.full_name ?? "Aluno",
    itens_resumo:     itemsSummary,
    valor_total:      formatBRL(order.total_amount),
    forma_pagamento:  order.payment_method ?? "—",
    data_pedido:      now.toLocaleDateString("pt-BR"),
    previsao_retirada: "A confirmar",
    link_pedido:      "",
    instituicao:      schoolName,
  };

  const text = renderTemplate(bodyText, vars);

  // Send via uazapi
  const base   = instanceUrl.replace(/\/$/, "");
  const target = `${base}/sendText`;

  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
    body: JSON.stringify({ phone, text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[webhook] uazapi sendText failed (${res.status}): ${detail}`);
  } else {
    console.log(`[webhook] WhatsApp sent to ${phone} for order ${order.order_number} (${triggerEvent})`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");
    const gatewayId = url.searchParams.get("gateway_id");

    if (!provider || !gatewayId) {
      return json({ error: "Missing provider or gateway_id query params" }, 400);
    }

    // Load gateway
    const { data: gateway } = await service
      .from("payment_gateways")
      .select("id, provider, webhook_secret, credentials, environment")
      .eq("id", gatewayId)
      .eq("provider", provider)
      .single();

    if (!gateway) {
      return json({ error: "Gateway not found" }, 404);
    }

    // Verify signature
    const rawBody = await req.text();
    const signature = req.headers.get("asaas-access-token") || "";
    const credentials = gateway.credentials as Record<string, string>;
    const adapter = getAdapter(provider, credentials.api_key || "");

    const webhookSecret = gateway.webhook_secret || "";
    if (webhookSecret && !adapter.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.warn(`[webhook] Invalid signature for gateway ${gatewayId}`);
      return json({ error: "Invalid signature" }, 401);
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    // Normalize event
    const event: NormalizedWebhookEvent | null = adapter.parseWebhook(body);
    if (!event) {
      console.log(`[webhook] Irrelevant event from ${provider}, ignoring`);
      return json({ ok: true, ignored: true });
    }

    console.log(`[webhook] ${provider} event=${event.event_type} charge=${event.provider_charge_id} status=${event.status}`);

    // ── Idempotency check ─────────────────────────────────────────────────
    const { error: insertError } = await service
      .from("gateway_webhook_log")
      .insert({
        gateway_id: gatewayId,
        provider,
        event_type: event.event_type,
        provider_charge_id: event.provider_charge_id,
        normalized: event as unknown as Record<string, unknown>,
        raw: body,
      });

    if (insertError) {
      // Unique constraint violation = already processed
      if (insertError.code === "23505") {
        console.log(`[webhook] Duplicate event, skipping: ${event.event_type} ${event.provider_charge_id}`);
        return json({ ok: true, duplicate: true });
      }
      console.error("[webhook] Failed to insert log:", insertError);
    }

    // ── Find installment by provider_charge_id ──────────────────────────────
    const { data: installment } = await service
      .from("financial_installments")
      .select("id, status, student_id")
      .eq("provider_charge_id", event.provider_charge_id)
      .single();

    if (!installment) {
      // ── Fallback: check store_orders by gateway_charge_id ──────────────
      const { data: order } = await service
        .from("store_orders")
        .select(`
          id, order_number, status, total_amount, payment_method,
          guardian_id,
          guardian:guardian_profiles!store_orders_guardian_id_fkey(id, full_name, phone),
          student:students!store_orders_student_id_fkey(id, full_name),
          items:store_order_items(product_name, variant_description, quantity, unit_price)
        `)
        .eq("gateway_charge_id", event.provider_charge_id)
        .single();

      if (!order) {
        console.warn(`[webhook] No installment or store_order found for charge ${event.provider_charge_id}`);
        await service
          .from("gateway_webhook_log")
          .update({ processed_at: new Date().toISOString() })
          .eq("provider", provider)
          .eq("provider_charge_id", event.provider_charge_id)
          .eq("event_type", event.event_type);
        return json({ ok: true, warning: "charge_not_found" });
      }

      // Link store_order_id to webhook log
      await service
        .from("gateway_webhook_log")
        .update({ store_order_id: order.id, processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("provider_charge_id", event.provider_charge_id)
        .eq("event_type", event.event_type);

      // Handle store order payment events
      const triggerEvent = event.status === "paid"
        ? "order_payment_confirmed"
        : event.status === "overdue"
        ? "order_payment_failed"
        : null;

      if (event.status === "paid" && order.status === "pending_payment") {
        await service
          .from("store_orders")
          .update({ status: "payment_confirmed", updated_at: new Date().toISOString() })
          .eq("id", order.id);

        // Mark checkout_session as paid so the /pagar/:token page auto-advances
        await service
          .from("checkout_sessions")
          .update({ status: "paid" })
          .eq("store_order_id", order.id)
          .eq("status", "pending");

        console.log(`[webhook] Store order ${order.order_number} marked as payment_confirmed`);
      } else if (event.status === "overdue") {
        // Don't auto-cancel — the order stays pending_payment, school decides
        console.log(`[webhook] Store order ${order.order_number} charge is overdue — no auto-cancel`);
      }

      // Dispatch WhatsApp notification
      if (triggerEvent) {
        try {
          await dispatchOrderWhatsApp(service, order, triggerEvent);
        } catch (waErr) {
          console.error(`[webhook] WhatsApp dispatch error for order ${order.order_number}:`, waErr);
        }
      }

      return json({ ok: true, event_type: event.event_type, store_order_id: order.id });
    }

    // Link installment_id to webhook log
    await service
      .from("gateway_webhook_log")
      .update({ installment_id: installment.id, processed_at: new Date().toISOString() })
      .eq("provider", provider)
      .eq("provider_charge_id", event.provider_charge_id)
      .eq("event_type", event.event_type);

    // ── Update installment ──────────────────────────────────────────────────
    if (event.status === "paid" && installment.status !== "paid") {
      await service
        .from("financial_installments")
        .update({
          status: "paid",
          paid_at: event.paid_at ? new Date(event.paid_at).toISOString() : new Date().toISOString(),
          paid_amount: event.paid_amount_cents ? event.paid_amount_cents / 100 : null,
          payment_method: event.payment_method || null,
        })
        .eq("id", installment.id);

      console.log(`[webhook] Installment ${installment.id} marked as paid`);

      // Send payment confirmation notification (if template exists)
      try {
        const { data: confirmTemplates } = await service
          .from("whatsapp_templates")
          .select("id")
          .eq("category", "financeiro")
          .eq("trigger_event", "on_status_change")
          .eq("is_active", true)
          .limit(1);

        if (confirmTemplates && confirmTemplates.length > 0) {
          // Log for future processing by financial-notify or manual trigger
          await service.from("financial_notification_log").insert({
            installment_id: installment.id,
            trigger_type: "payment_confirmed",
          });
        }
      } catch (notifErr) {
        console.error("[webhook] Notification log error:", notifErr);
      }
    } else if (event.status === "overdue" && installment.status === "pending") {
      await service
        .from("financial_installments")
        .update({ status: "overdue" })
        .eq("id", installment.id);

      console.log(`[webhook] Installment ${installment.id} marked as overdue`);
    }

    return json({ ok: true, event_type: event.event_type, installment_id: installment.id });
  } catch (err) {
    console.error("[webhook] error:", err);
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
