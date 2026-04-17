/**
 * nfse-retry-job
 *
 * Retry job for pending NFS-e records.
 * Intended to be called by pg_cron or manually via POST.
 *
 * Auth: service role only (Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>)
 *
 * For each NFS-e with status='pendente' created within the last 7 days:
 *   - Calls the provider's status-check API (GET /nfse/{provider_nfse_id})
 *   - If the response indicates an updated status, updates nfse_emitidas + logs
 *
 * Returns: { processed: N, updated: M }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function isServiceRole(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) return false;
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${serviceKey}`;
}

// ── Status mapping ────────────────────────────────────────────────────────────

type OurStatus = "autorizada" | "cancelada" | "rejeitada" | "substituida" | "pendente";

/** TODO: Adapt to your provider's status vocabulary (same as nfse-webhook). */
function mapProviderStatus(raw: string | undefined): OurStatus {
  if (!raw) return "pendente";
  const s = raw.toLowerCase();
  if (["autorizada", "authorized", "issued", "emitida", "aprovada"].includes(s)) return "autorizada";
  if (["cancelada", "cancelled", "canceled"].includes(s)) return "cancelada";
  if (["substituida", "substituted"].includes(s)) return "substituida";
  if (["rejeitada", "rejected", "negada", "denied", "erro", "error"].includes(s)) return "rejeitada";
  return "pendente";
}

// ── Provider status-check stub ────────────────────────────────────────────────

interface StatusCheckResult {
  status: OurStatus;
  link_pdf: string | null;
  xml_retorno: string | null;
  error_message: string | null;
  raw: Record<string, unknown>;
}

/**
 * TODO: Customize per provider.
 * Typical pattern: GET {base_url}/nfse/{provider_nfse_id}
 * Some providers use POST with the nota fiscal number instead.
 */
async function checkProviderStatus(
  config: Record<string, unknown>,
  provider_nfse_id: string,
): Promise<StatusCheckResult> {
  const baseUrl = (config.api_base_url as string | null) ?? "https://api.nfse-provider.example.com";
  const token = config.api_token_enc as string;

  const res = await fetch(`${baseUrl}/nfse/${provider_nfse_id}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return {
      status: "pendente",
      link_pdf: null,
      xml_retorno: null,
      error_message: `HTTP ${res.status}: ${text}`,
      raw: { http_status: res.status, body: text },
    };
  }

  const data: Record<string, unknown> = await res.json();

  // TODO: adapt field extraction to provider response schema
  return {
    status: mapProviderStatus(data.status as string | undefined ?? data.situacao as string | undefined),
    link_pdf: (data.link_pdf ?? data.url_pdf ?? null) as string | null,
    xml_retorno: (data.xml ?? data.xml_nfse ?? null) as string | null,
    error_message: (data.error_message ?? data.motivo ?? null) as string | null,
    raw: data,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 1. Authenticate — service role only
  if (!isServiceRole(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 2. Load pending NFS-e (last 7 days only — avoid retrying ancient records)
  const { data: pending, error: listErr } = await service
    .from("nfse_emitidas")
    .select("id, numero, serie, provider_nfse_id, guardian_id")
    .eq("status", "pendente")
    .not("provider_nfse_id", "is", null)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (listErr) {
    return json({ error: "Falha ao listar NFS-e pendentes", detail: listErr.message }, 500);
  }

  if (!pending || pending.length === 0) {
    return json({ processed: 0, updated: 0 });
  }

  // 3. Load NFS-e config
  const { data: cfg, error: cfgErr } = await service
    .from("company_nfse_config")
    .select("*")
    .single();

  if (cfgErr || !cfg) {
    return json({ error: "NFS-e não configurado" }, 422);
  }

  let updated = 0;
  const errors: string[] = [];

  // 4. Check each pending NFS-e
  for (const nfse of pending) {
    try {
      const result = await checkProviderStatus(
        cfg as Record<string, unknown>,
        nfse.provider_nfse_id,
      );

      // Only update if status actually changed
      if (result.status === "pendente") continue;

      const updatePayload: Record<string, unknown> = { status: result.status };
      if (result.link_pdf) updatePayload.link_pdf = result.link_pdf;
      if (result.xml_retorno) updatePayload.xml_retorno = result.xml_retorno;
      if (result.status === "rejeitada" && result.error_message) {
        updatePayload.motivo_rejeicao = result.error_message;
      }

      // 5. Update nfse_emitidas + insert log
      const { error: updateErr } = await service
        .from("nfse_emitidas")
        .update(updatePayload)
        .eq("id", nfse.id);

      await service.from("nfse_emission_log").insert({
        nfse_id: nfse.id,
        tentativa: null,
        iniciado_por: "retry-job",
        dados_env: { provider_nfse_id: nfse.provider_nfse_id },
        resposta: result.raw,
        status: updateErr ? "error" : result.status === "rejeitada" ? "error" : "success",
      });

      if (!updateErr) updated++;
    } catch (e) {
      errors.push(`nfse ${nfse.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({
    processed: pending.length,
    updated,
    ...(errors.length > 0 ? { errors } : {}),
  });
});
