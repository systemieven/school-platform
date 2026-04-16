import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AsaasAdapter } from "../_shared/asaas-adapter.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "DUNNING_RECEIVED", "RECEIVED_IN_CASH"]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function loadAdapter(
  service: ReturnType<typeof getServiceClient>,
  gatewayId: string,
): Promise<AsaasAdapter> {
  const { data: gateway, error } = await service
    .from("payment_gateways")
    .select("credentials, provider, environment")
    .eq("id", gatewayId)
    .single();

  if (error || !gateway) throw new Error("Gateway not found");

  const credentials = gateway.credentials as Record<string, string>;
  return new AsaasAdapter(gateway.environment, credentials.api_key);
}

// ── Action: getSession ────────────────────────────────────────────────────────

async function handleGetSession(
  service: ReturnType<typeof getServiceClient>,
  token: string,
): Promise<Response> {
  // 1. Look up session
  const { data: session, error: sessionErr } = await service
    .from("checkout_sessions")
    .select("id, token, status, billing_type, amount, expires_at, provider_charge_id, gateway_id, store_order_id")
    .eq("token", token)
    .single();

  if (sessionErr || !session) {
    return json({ error: "session_not_found" }, 404);
  }

  // 2. Check expiry / status
  const isExpired =
    session.status === "expired" ||
    (session.expires_at && new Date(session.expires_at) < new Date());

  if (isExpired) {
    await service
      .from("checkout_sessions")
      .update({ status: "expired" })
      .eq("id", session.id);
    return json({ error: "session_expired" }, 410);
  }

  if (session.status === "paid") {
    return json({ status: "paid" });
  }

  // 3. Fetch order + related data
  const { data: order, error: orderErr } = await service
    .from("store_orders")
    .select(
      `order_number, total_amount, payment_method, boleto_url,
       guardian_profiles!guardian_id ( name ),
       students!student_id ( full_name ),
       store_order_items ( product_name, variant_description, quantity, unit_price )`,
    )
    .eq("id", session.store_order_id)
    .single();

  if (orderErr || !order) {
    return json({ error: "order_not_found" }, 404);
  }

  // 4. Fetch school name
  const { data: schoolSetting } = await service
    .from("system_settings")
    .select("value")
    .eq("key", "school_name")
    .single();

  const schoolName = schoolSetting?.value ?? "Escola";

  // 5. Load adapter for payment-method-specific data
  const adapter = await loadAdapter(service, session.gateway_id);

  let pixQrImage: string | undefined;
  let pixPayload: string | undefined;
  let pixExpiration: string | undefined;
  let boletoIdentificationField: string | undefined;

  if (session.billing_type === "PIX" && session.provider_charge_id) {
    try {
      const pixData = await (adapter as AsaasAdapter & {
        request: <T>(method: string, path: string) => Promise<T>;
      // deno-lint-ignore no-explicit-any
      })["request"]<any>(
        "GET",
        `/payments/${session.provider_charge_id}/pixQrCode`,
      );
      pixQrImage = pixData.encodedImage;
      pixPayload = pixData.payload;
      pixExpiration = pixData.expirationDate;
    } catch {
      // PIX data not available yet — return without it
    }
  }

  if (session.billing_type === "BOLETO" && session.provider_charge_id) {
    try {
      const boletoData = await (adapter as AsaasAdapter & {
        request: <T>(method: string, path: string) => Promise<T>;
      // deno-lint-ignore no-explicit-any
      })["request"]<any>(
        "GET",
        `/payments/${session.provider_charge_id}/identificationField`,
      );
      boletoIdentificationField = boletoData.identificationField;
    } catch {
      // Boleto field not available yet
    }
  }

  // 6. Build response
  // deno-lint-ignore no-explicit-any
  const orderAny = order as any;
  return json({
    session: {
      id: session.id,
      token: session.token,
      status: session.status,
      billing_type: session.billing_type,
      amount: session.amount,
      expires_at: session.expires_at,
    },
    order: {
      order_number: orderAny.order_number,
      guardian_name: orderAny.guardian_profiles?.name ?? null,
      student_name: orderAny.students?.full_name ?? null,
      items: orderAny.store_order_items ?? [],
      total_amount: orderAny.total_amount,
      boleto_url: orderAny.boleto_url ?? null,
    },
    school_name: schoolName,
    ...(pixQrImage !== undefined && { pix_qr_image: pixQrImage }),
    ...(pixPayload !== undefined && { pix_payload: pixPayload }),
    ...(pixExpiration !== undefined && { pix_expiration: pixExpiration }),
    ...(boletoIdentificationField !== undefined && {
      boleto_identification_field: boletoIdentificationField,
    }),
  });
}

// ── Action: pollStatus ────────────────────────────────────────────────────────

async function handlePollStatus(
  service: ReturnType<typeof getServiceClient>,
  token: string,
): Promise<Response> {
  const { data: session, error } = await service
    .from("checkout_sessions")
    .select("id, status, provider_charge_id, gateway_id")
    .eq("token", token)
    .single();

  if (error || !session) {
    return json({ error: "session_not_found" }, 404);
  }

  if (session.status === "paid") {
    return json({ paid: true });
  }

  if (!session.provider_charge_id) {
    return json({ paid: false, status: session.status });
  }

  const adapter = await loadAdapter(service, session.gateway_id);

  // Call Asaas directly for raw status
  // deno-lint-ignore no-explicit-any
  const chargeData = await (adapter as any)["request"]<{ status: string }>(
    "GET",
    `/payments/${session.provider_charge_id}`,
  );

  const rawStatus: string = chargeData.status;

  if (PAID_STATUSES.has(rawStatus)) {
    await service
      .from("checkout_sessions")
      .update({ status: "paid" })
      .eq("id", session.id);
    return json({ paid: true });
  }

  return json({ paid: false, status: rawStatus });
}

// ── Action: createSession ─────────────────────────────────────────────────────
// Requires JWT (admin or guardian who owns the order).
// Creates a gateway charge + checkout_session and returns the token.

async function handleCreateSession(
  service: ReturnType<typeof getServiceClient>,
  authHeader: string,
  orderId: string,
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD",
): Promise<Response> {
  // Verify JWT and determine who the caller is
  const authed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await authed.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  // Load the order
  const { data: order, error: orderErr } = await service
    .from("store_orders")
    .select("id, order_number, guardian_id, student_id, total_amount")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) return json({ error: "order_not_found" }, 404);

  // Auth check: caller must be admin OR the guardian who owns the order
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile && ["super_admin", "admin", "coordinator", "user"].includes(profile.role);

  if (!isAdmin) {
    // Check if caller is the guardian
    const { data: gp } = await service
      .from("guardian_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!gp || gp.id !== order.guardian_id) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  // Load guardian info
  const { data: guardian } = await service
    .from("guardian_profiles")
    .select("id, name, cpf, phone, email")
    .eq("id", order.guardian_id)
    .single();

  if (!guardian) return json({ error: "guardian_not_found" }, 404);
  if (!guardian.cpf) {
    return json({ error: "CPF do responsável não cadastrado. Adicione o CPF antes de gerar cobrança online." }, 400);
  }

  // Load active gateway
  const { data: gateway } = await service
    .from("payment_gateways")
    .select("id, provider, environment, credentials")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gateway) return json({ error: "Nenhum gateway de pagamento configurado." }, 400);

  const credentials = gateway.credentials as Record<string, string>;
  const adapter = new AsaasAdapter(gateway.environment, credentials.api_key);

  // Get or create gateway customer
  let providerCustomerId: string;
  const { data: cachedCustomer } = await service
    .from("gateway_customers")
    .select("provider_customer_id")
    .eq("gateway_id", gateway.id)
    .eq("student_id", order.student_id)
    .maybeSingle();

  if (cachedCustomer?.provider_customer_id) {
    providerCustomerId = cachedCustomer.provider_customer_id as string;
  } else {
    const customerRes = await adapter.createCustomer({
      name: guardian.name,
      cpf_cnpj: guardian.cpf,
      email: guardian.email ?? undefined,
      phone: guardian.phone ?? undefined,
    });
    providerCustomerId = customerRes.provider_customer_id;

    await service.from("gateway_customers").insert({
      gateway_id: gateway.id,
      student_id: order.student_id,
      provider_customer_id: providerCustomerId,
    });
  }

  // Create gateway charge
  const todayISO = new Date().toISOString().slice(0, 10);
  const chargeRes = await adapter.createCharge({
    provider_customer_id: providerCustomerId,
    amount_cents: Math.round(order.total_amount * 100),
    due_date: todayISO,
    description: `Pedido ${order.order_number}`,
    billing_type: billingType,
    external_reference: order.order_number,
  });

  // Update store_order with charge data
  await service
    .from("store_orders")
    .update({
      gateway_charge_id: chargeRes.provider_charge_id,
      payment_link: chargeRes.payment_link ?? null,
      pix_code: chargeRes.pix_code ?? null,
      boleto_url: chargeRes.boleto_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  // Insert checkout_session
  const { data: sessionRow, error: sessionErr } = await service
    .from("checkout_sessions")
    .insert({
      store_order_id: orderId,
      gateway_id: gateway.id,
      provider_charge_id: chargeRes.provider_charge_id,
      billing_type: billingType,
      amount: order.total_amount,
    })
    .select("token")
    .single();

  if (sessionErr || !sessionRow) {
    console.error("[checkout-proxy] createSession insert error:", sessionErr);
    return json({ error: "Erro ao criar sessão de pagamento." }, 500);
  }

  return json({ token: sessionRow.token });
}

// ── Action: payWithCard ───────────────────────────────────────────────────────

interface CardInput {
  holder_name: string;
  number: string;
  expiry_month: string;
  expiry_year: string;
  ccv: string;
  installments?: number;
}

async function handlePayWithCard(
  service: ReturnType<typeof getServiceClient>,
  token: string,
  card: CardInput,
  postalCode: string,
  addressNumber: string,
): Promise<Response> {
  // 1. Load and validate session
  const { data: session, error: sessionErr } = await service
    .from("checkout_sessions")
    .select("id, status, billing_type, amount, expires_at, provider_charge_id, gateway_id, store_order_id")
    .eq("token", token)
    .single();

  if (sessionErr || !session) {
    return json({ ok: false, error: "Sessão não encontrada." }, 404);
  }

  if (session.status === "paid") {
    return json({ ok: true }); // already paid
  }

  const isExpired =
    session.status === "expired" ||
    (session.expires_at && new Date(session.expires_at) < new Date());

  if (isExpired) {
    return json({ ok: false, error: "Sessão expirada." }, 410);
  }

  if (!session.provider_charge_id) {
    return json({ ok: false, error: "Cobrança não encontrada." }, 400);
  }

  // 2. Fetch guardian info from store_order
  const { data: order, error: orderErr } = await service
    .from("store_orders")
    .select("id, total_amount, guardian_profiles!guardian_id ( name, email, cpf, phone )")
    .eq("id", session.store_order_id)
    .single();

  if (orderErr || !order) {
    return json({ ok: false, error: "Pedido não encontrado." }, 404);
  }

  // deno-lint-ignore no-explicit-any
  const orderAny = order as any;
  const guardian = orderAny.guardian_profiles;

  // 3. Load adapter
  const adapter = await loadAdapter(service, session.gateway_id);

  // 4. Build payWithCreditCard payload
  const installments = card.installments ?? 1;
  const totalValue: number = orderAny.total_amount ?? session.amount;

  // deno-lint-ignore no-explicit-any
  const ccPayload: Record<string, any> = {
    creditCard: {
      holderName: card.holder_name,
      number: card.number.replace(/\D/g, ""),
      expiryMonth: card.expiry_month,
      expiryYear: card.expiry_year,
      ccv: card.ccv,
    },
    creditCardHolderInfo: {
      name: guardian?.name ?? card.holder_name,
      email: guardian?.email ?? "",
      cpfCnpj: (guardian?.cpf ?? "").replace(/\D/g, ""),
      postalCode: postalCode.replace(/\D/g, ""),
      addressNumber: addressNumber,
      phone: (guardian?.phone ?? "").replace(/\D/g, ""),
    },
  };

  if (installments > 1) {
    ccPayload.installmentCount = installments;
    ccPayload.installmentValue = Math.round((totalValue / installments) * 100) / 100;
  }

  // 5. Call Asaas
  let rawResponse: Record<string, unknown>;
  try {
    // deno-lint-ignore no-explicit-any
    rawResponse = await (adapter as any)["request"]<Record<string, unknown>>(
      "POST",
      `/payments/${session.provider_charge_id}/payWithCreditCard`,
      ccPayload,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar cartão.";
    // Try to extract a user-friendly description from Asaas error format
    // The adapter already extracts errors[].description and puts them in the Error message
    return json({ ok: false, error: message });
  }

  const rawStatus = rawResponse.status as string | undefined;

  if (rawStatus && (rawStatus === "CONFIRMED" || rawStatus === "RECEIVED")) {
    // Update session and order
    await service
      .from("checkout_sessions")
      .update({ status: "paid" })
      .eq("id", session.id);

    await service
      .from("store_orders")
      .update({ status: "payment_confirmed" })
      .eq("id", orderAny.id);

    return json({ ok: true });
  }

  // Payment processed but not immediately confirmed (e.g. analysis)
  return json({ ok: true, status: rawStatus });
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action } = body as { action?: string };
  if (!action) return json({ error: "Missing action" }, 400);

  const service = getServiceClient();

  try {
    // createSession requires JWT but no existing token
    if (action === "createSession") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const { order_id, billing_type } = body as { order_id?: string; billing_type?: string };
      if (!order_id || !billing_type) {
        return json({ error: "Missing order_id or billing_type" }, 400);
      }
      return await handleCreateSession(
        service,
        authHeader,
        order_id,
        billing_type as "PIX" | "BOLETO" | "CREDIT_CARD",
      );
    }

    // All other actions require a token
    const token = body.token as string | undefined;
    if (!token) return json({ error: "Missing token" }, 400);

    switch (action) {
      case "getSession":
        return await handleGetSession(service, token);

      case "pollStatus":
        return await handlePollStatus(service, token);

      case "payWithCard": {
        const card = body.card as CardInput | undefined;
        const postalCode = (body.postal_code as string | undefined) ?? "";
        const addressNumber = (body.address_number as string | undefined) ?? "";

        if (!card) {
          return json({ ok: false, error: "Missing card data" }, 400);
        }

        return await handlePayWithCard(service, token, card, postalCode, addressNumber);
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[checkout-proxy]", message);
    return json({ error: "internal_error", detail: message }, 500);
  }
});
