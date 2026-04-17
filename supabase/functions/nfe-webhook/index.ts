/**
 * nfe-webhook
 *
 * POST /nfe-webhook?secret=<webhook_secret>
 * Publico — autenticacao por query param comparado com company_nfe_config.webhook_secret.
 *
 * Atualiza nfe_emitidas quando o provider notifica mudanca de status
 * (autorizacao assincrona, denegacao, cancelamento).
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

type OurStatus = "autorizada" | "cancelada" | "rejeitada" | "denegada" | "inutilizada" | "pendente";

function mapProviderStatus(raw: string | undefined): OurStatus {
  if (!raw) return "pendente";
  const s = raw.toLowerCase();
  if (["autorizada", "authorized", "issued", "emitida", "aprovada", "processada"].includes(s)) return "autorizada";
  if (["cancelada", "cancelled", "canceled"].includes(s)) return "cancelada";
  if (["denegada"].includes(s)) return "denegada";
  if (["inutilizada"].includes(s)) return "inutilizada";
  if (["rejeitada", "rejected", "negada", "denied", "erro", "error"].includes(s)) return "rejeitada";
  return "pendente";
}

interface ParsedPayload {
  provider_nfe_id: string;
  raw_status: string;
  chave_nfe: string | null;
  protocolo: string | null;
  link_danfe: string | null;
  link_xml: string | null;
  xml: string | null;
  error_message: string | null;
}

function parseNuvemFiscal(payload: Record<string, unknown>, baseUrl: string): ParsedPayload {
  const id = (payload.id as string) ?? "";
  const status = (payload.status as string) ?? "";
  const nfe = (payload.nfe ?? {}) as Record<string, unknown>;
  const mensagens = payload.mensagens as { descricao?: string }[] | undefined;
  return {
    provider_nfe_id: id,
    raw_status: status,
    chave_nfe: (payload.chave as string | undefined) ?? (nfe.chave as string | undefined) ?? null,
    protocolo: (payload.protocolo as string | undefined) ?? null,
    link_danfe: (nfe.url_pdf as string | undefined) ?? (id ? `${baseUrl}/nfe/${id}/pdf` : null),
    link_xml: (nfe.url_xml as string | undefined) ?? (id ? `${baseUrl}/nfe/${id}/xml` : null),
    xml: (nfe.xml as string | undefined) ?? null,
    error_message: mensagens?.[0]?.descricao ?? (payload.mensagem as string | undefined) ?? null,
  };
}

function parseGeneric(payload: Record<string, unknown>): ParsedPayload {
  return {
    provider_nfe_id:
      (payload.id as string) ?? (payload.nfe_id as string) ?? (payload.provider_id as string) ?? "",
    raw_status: (payload.status as string) ?? (payload.situacao as string) ?? "",
    chave_nfe: (payload.chave as string | undefined) ?? (payload.chave_nfe as string | undefined) ?? null,
    protocolo: (payload.protocolo as string | undefined) ?? null,
    link_danfe: (payload.link_danfe as string | undefined) ?? (payload.url_pdf as string | undefined) ?? null,
    link_xml: (payload.link_xml as string | undefined) ?? (payload.url_xml as string | undefined) ?? null,
    xml: (payload.xml as string | undefined) ?? null,
    error_message: (payload.error_message as string | undefined) ?? (payload.motivo as string | undefined) ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? "";

  const { data: cfg, error: cfgErr } = await service
    .from("company_nfe_config")
    .select("id, provider, api_base_url, webhook_secret")
    .maybeSingle();

  if (cfgErr || !cfg) return json({ error: "Configuracao NF-e nao encontrada" }, 500);
  if (!cfg.webhook_secret || cfg.webhook_secret !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const baseUrl = (cfg.api_base_url as string | null) || "https://api.nuvemfiscal.com.br";
  const parsed = cfg.provider === "nuvem_fiscal"
    ? parseNuvemFiscal(payload, baseUrl)
    : parseGeneric(payload);

  if (!parsed.provider_nfe_id) {
    return json({ error: "provider_nfe_id ausente no payload" }, 400);
  }

  const { data: nfe, error: findErr } = await service
    .from("nfe_emitidas")
    .select("id, numero, status")
    .eq("provider_nfe_id", parsed.provider_nfe_id)
    .maybeSingle();

  if (findErr || !nfe) {
    return json({ error: "NF-e nao encontrada", provider_nfe_id: parsed.provider_nfe_id }, 404);
  }

  const newStatus = mapProviderStatus(parsed.raw_status);

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (parsed.chave_nfe) updatePayload.chave_nfe = parsed.chave_nfe;
  if (parsed.protocolo) updatePayload.protocolo = parsed.protocolo;
  if (parsed.link_danfe) updatePayload.link_danfe = parsed.link_danfe;
  if (parsed.link_xml) updatePayload.link_xml = parsed.link_xml;
  if (parsed.xml) updatePayload.xml_retorno = parsed.xml;
  if (newStatus === "autorizada") updatePayload.autorizada_em = new Date().toISOString();
  if ((newStatus === "rejeitada" || newStatus === "denegada") && parsed.error_message) {
    updatePayload.motivo_rejeicao = parsed.error_message;
  }

  const { error: updateErr } = await service
    .from("nfe_emitidas")
    .update(updatePayload)
    .eq("id", nfe.id);

  await service.from("nfe_emission_log").insert({
    nfe_id: nfe.id,
    tentativa: 1,
    iniciado_por: null,
    dados_env: { provider_nfe_id: parsed.provider_nfe_id, raw_status: parsed.raw_status },
    resposta: payload,
    status: updateErr ? "error" : newStatus === "rejeitada" || newStatus === "denegada" ? "error" : "success",
  });

  if (updateErr) {
    return json({ error: "Falha ao atualizar NF-e", detail: updateErr.message }, 500);
  }

  return json({ received: true, nfe_id: nfe.id, status: newStatus });
});
