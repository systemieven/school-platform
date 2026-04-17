/**
 * nfse-webhook
 *
 * Endpoint publico POST — recebe callbacks de status do provider NFS-e.
 * URL: POST /nfse-webhook?secret=<webhook_secret>
 *
 * Nao exige JWT. Autenticidade validada pelo query param `secret` comparado
 * contra company_nfse_config.webhook_secret.
 *
 * Formatos suportados:
 *   - Nuvem Fiscal (NFS-e Nacional): { id, status, numero, nfse: { xml, pdf } }
 *   - Generico: best-effort em `id|nfse_id`, `status|situacao`, etc.
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

// ── Status mapping ────────────────────────────────────────────────────────────

type OurStatus = "autorizada" | "cancelada" | "rejeitada" | "substituida" | "pendente";

function mapProviderStatus(raw: string | undefined): OurStatus {
  if (!raw) return "pendente";
  const s = raw.toLowerCase();
  if (["autorizada", "authorized", "issued", "emitida", "aprovada", "processada"].includes(s)) return "autorizada";
  if (["cancelada", "cancelled", "canceled"].includes(s)) return "cancelada";
  if (["substituida", "substituted"].includes(s)) return "substituida";
  if (["rejeitada", "rejected", "negada", "denied", "erro", "error"].includes(s)) return "rejeitada";
  return "pendente";
}

// ── Parser por provider ───────────────────────────────────────────────────────

interface ParsedPayload {
  provider_nfse_id: string;
  raw_status: string;
  link_pdf: string | null;
  xml: string | null;
  error_message: string | null;
}

function parseNuvemFiscal(payload: Record<string, unknown>, baseUrl: string): ParsedPayload {
  const id = (payload.id as string) ?? "";
  const status = (payload.status as string) ?? "";
  const nfse = (payload.nfse ?? {}) as Record<string, unknown>;
  const link_pdf =
    (nfse.url_pdf as string | undefined) ??
    (payload.url_pdf as string | undefined) ??
    (id ? `${baseUrl}/nfse/${id}/pdf` : null);
  const xml =
    (nfse.xml as string | undefined) ??
    (payload.xml as string | undefined) ??
    null;
  const mensagens = payload.mensagens as { descricao?: string }[] | undefined;
  const error_message =
    mensagens?.[0]?.descricao ??
    (payload.mensagem as string | undefined) ??
    null;
  return { provider_nfse_id: id, raw_status: status, link_pdf, xml, error_message };
}

function parseGeneric(payload: Record<string, unknown>): ParsedPayload {
  return {
    provider_nfse_id:
      (payload.id as string) ??
      (payload.nfse_id as string) ??
      (payload.provider_id as string) ??
      "",
    raw_status:
      (payload.status as string) ??
      (payload.situacao as string) ??
      "",
    link_pdf:
      (payload.link_pdf as string | undefined) ??
      (payload.url_pdf as string | undefined) ??
      null,
    xml:
      (payload.xml as string | undefined) ??
      (payload.xml_nfse as string | undefined) ??
      null,
    error_message:
      (payload.error_message as string | undefined) ??
      (payload.motivo as string | undefined) ??
      null,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Valida secret
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? "";

  const { data: cfg, error: cfgErr } = await service
    .from("company_nfse_config")
    .select("id, provider, api_base_url, webhook_secret")
    .single();

  if (cfgErr || !cfg) return json({ error: "Configuracao NFS-e nao encontrada" }, 500);
  if (!cfg.webhook_secret || cfg.webhook_secret !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2. Parse body
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // 3. Dispatcher de parsing por provider
  const baseUrl = (cfg.api_base_url as string | null) || "https://api.nuvemfiscal.com.br";
  const parsed =
    cfg.provider === "nuvem_fiscal"
      ? parseNuvemFiscal(payload, baseUrl)
      : parseGeneric(payload);

  if (!parsed.provider_nfse_id) {
    return json({ error: "provider_nfse_id ausente no payload" }, 400);
  }

  // 4. Localiza nfse_emitidas
  const { data: nfse, error: findErr } = await service
    .from("nfse_emitidas")
    .select("id, numero, status, guardian_id")
    .eq("provider_nfse_id", parsed.provider_nfse_id)
    .single();

  if (findErr || !nfse) {
    return json({ error: "NFS-e nao encontrada", provider_nfse_id: parsed.provider_nfse_id }, 404);
  }

  const previousStatus = nfse.status as OurStatus;
  const newStatus = mapProviderStatus(parsed.raw_status);

  // 5. Update nfse_emitidas
  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (parsed.link_pdf) updatePayload.link_pdf = parsed.link_pdf;
  if (parsed.xml) updatePayload.xml_retorno = parsed.xml;
  if (newStatus === "rejeitada" && parsed.error_message) {
    updatePayload.motivo_rejeicao = parsed.error_message;
  }

  const { error: updateErr } = await service
    .from("nfse_emitidas")
    .update(updatePayload)
    .eq("id", nfse.id);

  const logStatus = updateErr ? "error" : newStatus === "rejeitada" ? "error" : "success";

  // 6. Log
  await service.from("nfse_emission_log").insert({
    nfse_id: nfse.id,
    tentativa: null,
    iniciado_por: "webhook",
    dados_env: { provider_nfse_id: parsed.provider_nfse_id, raw_status: parsed.raw_status },
    resposta: payload,
    status: logStatus,
  });

  if (updateErr) {
    return json({ error: "Falha ao atualizar NFS-e", detail: updateErr.message }, 500);
  }

  // 7. WhatsApp se recem-autorizada
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
            body: `Sua NFS-e n. ${nfse.numero} foi autorizada. Link: ${parsed.link_pdf ?? "em breve disponivel"}`,
            priority: 1,
          }),
        });
      } catch {
        // notificacao nao bloqueia
      }
    }
  }

  return json({ received: true, nfse_id: nfse.id, status: newStatus });
});
