/**
 * nfse-webhook
 *
 * Public POST endpoint — receives status callbacks from the NFS-e provider.
 * URL: POST /nfse-webhook?secret=<webhook_secret>
 *
 * No JWT auth required. Request authenticity is validated via the
 * webhook_secret query param matched against company_nfse_config.webhook_secret.
 *
 * On success the nfse_emitidas record is updated and, if newly authorized
 * and guardian has a phone, a WhatsApp notification is dispatched.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Provider status mapping ───────────────────────────────────────────────────

type OurStatus = "autorizada" | "cancelada" | "rejeitada" | "substituida" | "pendente";

/**
 * TODO: Map your provider's status strings to our enum.
 * Common values across providers are handled below; extend as needed.
 */
function mapProviderStatus(raw: string | undefined): OurStatus {
  if (!raw) return "pendente";
  const s = raw.toLowerCase();
  if (["autorizada", "authorized", "issued", "emitida", "aprovada"].includes(s)) return "autorizada";
  if (["cancelada", "cancelled", "canceled"].includes(s)) return "cancelada";
  if (["substituida", "substituted"].includes(s)) return "substituida";
  if (["rejeitada", "rejected", "negada", "denied", "erro", "error"].includes(s)) return "rejeitada";
  return "pendente";
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Validate webhook secret
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? "";

  const { data: cfg, error: cfgErr } = await service
    .from("company_nfse_config")
    .select("id, webhook_secret")
    .single();

  if (cfgErr || !cfg) return json({ error: "Configuração NFS-e não encontrada" }, 500);
  if (!cfg.webhook_secret || cfg.webhook_secret !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2. Parse provider body
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // TODO: adapt field names to match the actual provider's callback payload
  const provider_nfse_id =
    (payload.id ?? payload.nfse_id ?? payload.provider_id ?? "") as string;
  const rawStatus = (payload.status ?? payload.situacao ?? "") as string;
  const link_pdf = (payload.link_pdf ?? payload.url_pdf ?? null) as string | null;
  const xml = (payload.xml ?? payload.xml_nfse ?? null) as string | null;
  const error_message = (payload.error_message ?? payload.motivo ?? null) as string | null;

  if (!provider_nfse_id) {
    return json({ error: "provider_nfse_id ausente no payload" }, 400);
  }

  // 3. Find nfse_emitidas by provider_nfse_id
  const { data: nfse, error: findErr } = await service
    .from("nfse_emitidas")
    .select("id, numero, status, guardian_id")
    .eq("provider_nfse_id", provider_nfse_id)
    .single();

  if (findErr || !nfse) {
    return json({ error: "NFS-e não encontrada", provider_nfse_id }, 404);
  }

  const previousStatus = nfse.status as OurStatus;

  // 4. Map to our enum
  const newStatus = mapProviderStatus(rawStatus);

  // 5. Update nfse_emitidas
  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (link_pdf) updatePayload.link_pdf = link_pdf;
  if (xml) updatePayload.xml_retorno = xml;
  if (newStatus === "rejeitada" && error_message) updatePayload.motivo_rejeicao = error_message;

  const { error: updateErr } = await service
    .from("nfse_emitidas")
    .update(updatePayload)
    .eq("id", nfse.id);

  const logStatus = updateErr ? "error" : newStatus === "rejeitada" ? "error" : "success";

  // 6. Insert emission log
  await service.from("nfse_emission_log").insert({
    nfse_id: nfse.id,
    tentativa: null, // webhook-triggered, no retry count
    iniciado_por: "webhook",
    dados_env: { provider_nfse_id, raw_status: rawStatus },
    resposta: payload,
    status: logStatus,
  });

  if (updateErr) {
    return json({ error: "Falha ao atualizar NFS-e", detail: updateErr.message }, 500);
  }

  // 7. WhatsApp notification if newly authorized
  if (newStatus === "autorizada" && previousStatus !== "autorizada") {
    const { data: guardian } = await service
      .from("guardian_profiles")
      .select("telefone")
      .eq("id", nfse.guardian_id)
      .single();

    const phone = (guardian as Record<string, unknown> | null)?.telefone as string | null;
    if (phone) {
      try {
        const orchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/message-orchestrator`;
        await fetch(orchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            phone,
            module: "fiscal",
            body: `Sua NFS-e nº ${nfse.numero} foi autorizada. Link: ${link_pdf ?? "em breve disponível"}`,
            priority: 1,
          }),
        });
      } catch {
        // notification failure is non-fatal
      }
    }
  }

  return json({ received: true, nfse_id: nfse.id, status: newStatus });
});
