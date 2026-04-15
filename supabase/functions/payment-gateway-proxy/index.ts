/**
 * payment-gateway-proxy
 *
 * Authenticated proxy for gateway operations (admin only).
 * Actions: createCustomer, createCharge, getCharge, cancelCharge
 *
 * Auth: JWT (Supabase auth) — role must be admin or super_admin.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AsaasAdapter } from "../_shared/asaas-adapter.ts";
import type { GatewayAdapter } from "../_shared/gateway-adapter.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function getAdapter(provider: string, environment: string, credentials: Record<string, string>): GatewayAdapter {
  switch (provider) {
    case "asaas":
      return new AsaasAdapter(environment, credentials.api_key || "");
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

interface ProxyPayload {
  action: "createCustomer" | "createCharge" | "getCharge" | "cancelCharge";
  gateway_id: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── JWT Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing authorization" }, 401);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  // Check admin role
  const service = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    return json({ error: "Forbidden: admin role required" }, 403);
  }

  try {
    const payload: ProxyPayload = await req.json();
    const { action, gateway_id, data: actionData } = payload;

    if (!action || !gateway_id) {
      return json({ error: "Missing action or gateway_id" }, 400);
    }

    // Load gateway config
    const { data: gateway, error: gwError } = await service
      .from("payment_gateways")
      .select("*")
      .eq("id", gateway_id)
      .single();

    if (gwError || !gateway) {
      return json({ error: "Gateway not found" }, 404);
    }

    if (!gateway.is_active) {
      return json({ error: "Gateway is inactive" }, 400);
    }

    const adapter = getAdapter(
      gateway.provider,
      gateway.environment,
      gateway.credentials as Record<string, string>,
    );

    // ── Actions ─────────────────────────────────────────────────────────────
    switch (action) {
      case "createCustomer": {
        if (!actionData) return json({ error: "Missing data for createCustomer" }, 400);
        const result = await adapter.createCustomer({
          name: actionData.name as string,
          cpf_cnpj: actionData.cpf_cnpj as string,
          email: actionData.email as string | undefined,
          phone: actionData.phone as string | undefined,
        });

        // Cache in gateway_customers
        if (actionData.student_id) {
          await service.from("gateway_customers").upsert({
            gateway_id,
            student_id: actionData.student_id as string,
            provider_customer_id: result.provider_customer_id,
          }, { onConflict: "gateway_id,student_id" });
        }

        return json({ success: true, ...result });
      }

      case "createCharge": {
        if (!actionData) return json({ error: "Missing data for createCharge" }, 400);
        const result = await adapter.createCharge({
          provider_customer_id: actionData.provider_customer_id as string,
          amount_cents: actionData.amount_cents as number,
          due_date: actionData.due_date as string,
          description: actionData.description as string || "Mensalidade escolar",
          billing_type: (actionData.billing_type as "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED") || "UNDEFINED",
          external_reference: actionData.external_reference as string | undefined,
          fine_percent: actionData.fine_percent as number | undefined,
          interest_percent: actionData.interest_percent as number | undefined,
          discount_value: actionData.discount_value as number | undefined,
          discount_due_date: actionData.discount_due_date as string | undefined,
        });

        // Update installment with gateway data
        if (actionData.installment_id) {
          await service
            .from("financial_installments")
            .update({
              gateway_id,
              provider_charge_id: result.provider_charge_id,
              boleto_url: result.boleto_url || null,
              pix_code: result.pix_code || null,
              payment_link: result.payment_link || null,
            })
            .eq("id", actionData.installment_id as string);
        }

        return json({ success: true, ...result });
      }

      case "getCharge": {
        if (!actionData?.provider_charge_id) {
          return json({ error: "Missing provider_charge_id" }, 400);
        }
        const result = await adapter.getCharge(actionData.provider_charge_id as string);
        return json({ success: true, ...result });
      }

      case "cancelCharge": {
        if (!actionData?.provider_charge_id) {
          return json({ error: "Missing provider_charge_id" }, 400);
        }
        const result = await adapter.cancelCharge(actionData.provider_charge_id as string);

        // Update installment status
        if (actionData.installment_id) {
          await service
            .from("financial_installments")
            .update({ status: "cancelled", provider_charge_id: null })
            .eq("id", actionData.installment_id as string);
        }

        // cancelCharge returns { success, raw } — strip its success to avoid
        // the "specified more than once" TS error from the spread.
        const { success: _canceled, ...rest } = result;
        return json({ success: true, ...rest });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[payment-gateway-proxy] error:", err);
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
