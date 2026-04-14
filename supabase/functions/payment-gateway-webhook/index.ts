/**
 * payment-gateway-webhook
 *
 * Public endpoint for receiving payment gateway webhooks.
 * Idempotent via gateway_webhook_log unique index.
 * Updates financial_installments on payment events.
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
      console.warn(`[webhook] No installment found for charge ${event.provider_charge_id}`);
      // Update log with note
      await service
        .from("gateway_webhook_log")
        .update({ processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("provider_charge_id", event.provider_charge_id)
        .eq("event_type", event.event_type);
      return json({ ok: true, warning: "installment_not_found" });
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
