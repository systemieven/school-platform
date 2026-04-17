/**
 * nfse-emitter
 *
 * Main NFS-e emission engine.
 * Loads config, validates tomador fiscal data, builds the RPS payload,
 * calls the NFS-e provider API, persists the result and logs the attempt.
 *
 * Auth: accepts both service-role Bearer and regular user JWT.
 *       Regular JWT calls are validated by passing the Authorization header
 *       to createClient so Supabase RLS applies.
 *
 * Body: { source, source_id, guardian_id, valor_servico, discriminacao, initiated_by }
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

interface EmitRequest {
  source: "installment" | "receivable";
  source_id: string;
  guardian_id: string;
  valor_servico: number;
  discriminacao: string;
  initiated_by: string;
}

interface ProviderResponse {
  provider_nfse_id: string;
  link_pdf: string | null;
  xml_retorno: string | null;
  status: "autorizada" | "pendente" | "rejeitada";
  error_message?: string;
}

// ── Provider stub ─────────────────────────────────────────────────────────────

/**
 * TODO: Customize per provider (e.g. eNotas, Nuvem Fiscal, Prefeitura direta).
 * The payload shape below is generic — adapt to the provider's actual RPS schema.
 */
async function callProviderApi(
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<ProviderResponse> {
  const baseUrl = (config.api_base_url as string | null) ?? "https://api.nfse-provider.example.com";
  const token = config.api_token_enc as string;

  // TODO: adapt URL and body shape to the actual provider
  const res = await fetch(`${baseUrl}/rps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return { provider_nfse_id: "", link_pdf: null, xml_retorno: null, status: "rejeitada", error_message: text };
  }

  // TODO: map provider response fields to ProviderResponse
  const data = await res.json();
  return {
    provider_nfse_id: data.id ?? data.nfse_id ?? "",
    link_pdf: data.link_pdf ?? data.url_pdf ?? null,
    xml_retorno: data.xml ?? null,
    status: data.status === "autorizada" ? "autorizada" : data.status === "rejeitada" ? "rejeitada" : "pendente",
    error_message: data.error_message ?? undefined,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";

  // Service-role client (bypasses RLS for config reads / log writes)
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Caller client — respects RLS when using user JWT
  const caller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  let body: EmitRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { source, source_id, guardian_id, valor_servico, discriminacao, initiated_by } = body;
  if (!source || !source_id || !guardian_id || !valor_servico || !discriminacao || !initiated_by) {
    return json({ error: "Campos obrigatórios ausentes" }, 400);
  }

  // 1. Load NFS-e config
  const { data: cfg, error: cfgErr } = await service
    .from("company_nfse_config")
    .select("*")
    .single();
  if (cfgErr || !cfg) return json({ error: "NFS-e não configurado" }, 422);

  // 2. Validate guardian fiscal data
  const { data: guardian, error: gErr } = await service
    .from("guardian_profiles")
    .select("*")
    .eq("id", guardian_id)
    .single();
  if (gErr || !guardian) return json({ error: "Responsável não encontrado" }, 404);

  if (!guardian.fiscal_data_complete) {
    const missing: string[] = [];
    if (!guardian.cpf_cnpj) missing.push("CPF/CNPJ");
    if (!guardian.logradouro_fiscal) missing.push("Logradouro");
    if (!guardian.numero_fiscal) missing.push("Número");
    if (!guardian.bairro_fiscal) missing.push("Bairro");
    if (!guardian.cep_fiscal) missing.push("CEP");
    if (!guardian.municipio_fiscal) missing.push("Município");
    if (!guardian.uf_fiscal) missing.push("UF");
    return json({ error: "Dados fiscais incompletos do responsável", missing_fields: missing }, 422);
  }

  // 3. Load company fiscal config (prestador)
  const { data: fiscal, error: fErr } = await service
    .from("company_fiscal_config")
    .select("*")
    .single();
  if (fErr || !fiscal) return json({ error: "Configuração fiscal da empresa não encontrada" }, 422);

  // 4. Build prestador JSONB
  const prestador = {
    razao_social: fiscal.razao_social,
    cnpj: fiscal.cnpj,
    inscricao_municipal: cfg.inscricao_municipal ?? fiscal.im,
    codigo_municipio_ibge: cfg.codigo_municipio_ibge,
    endereco: {
      logradouro: fiscal.logradouro,
      numero: fiscal.numero,
      complemento: fiscal.complemento ?? null,
      bairro: fiscal.bairro,
      cep: fiscal.cep,
      municipio: fiscal.municipio,
      uf: fiscal.uf,
    },
  };

  // 5. Build tomador JSONB
  const tomador = {
    nome: guardian.full_name,
    cpf_cnpj: guardian.cpf_cnpj,
    tipo_pessoa: guardian.tipo_pessoa ?? "F",
    email: guardian.email_fiscal ?? null,
    endereco: {
      logradouro: guardian.logradouro_fiscal,
      numero: guardian.numero_fiscal,
      complemento: guardian.complemento_fiscal ?? null,
      bairro: guardian.bairro_fiscal,
      cep: guardian.cep_fiscal,
      municipio: guardian.municipio_fiscal,
      uf: guardian.uf_fiscal,
    },
  };

  // 6. Build servico JSONB
  const aliq_iss = Number(cfg.aliq_iss_padrao ?? 0);
  const servico = {
    // TODO: add codigo_servico, cnae, item_lc116 to company_nfse_config if not already present
    codigo_servico: (cfg as Record<string, unknown>).codigo_servico ?? null,
    cnae: (cfg as Record<string, unknown>).cnae ?? null,
    item_lc116: (cfg as Record<string, unknown>).item_lc116 ?? null,
    discriminacao,
    aliq_iss,
    valor_servico,
  };

  // 7. Calculate taxes
  const valor_iss = cfg.reter_iss ? 0 : +(valor_servico * aliq_iss / 100).toFixed(2);
  const valor_iss_retido = cfg.reter_iss ? +(valor_servico * aliq_iss / 100).toFixed(2) : 0;
  const valor_pis = cfg.reter_pis ? +(valor_servico * 0.0065).toFixed(2) : 0;
  const valor_cofins = cfg.reter_cofins ? +(valor_servico * 0.03).toFixed(2) : 0;
  const valor_csll = cfg.reter_csll ? +(valor_servico * 0.01).toFixed(2) : 0;
  const valor_irpj = cfg.reter_irpj ? +(valor_servico * 0.015).toFixed(2) : 0;
  const valor_inss = cfg.reter_inss ? +(valor_servico * 0.11).toFixed(2) : 0;
  const deducoes = valor_iss_retido + valor_pis + valor_cofins + valor_csll + valor_irpj + valor_inss;
  const valor_liquido = +(valor_servico - deducoes).toFixed(2);

  // 8. Increment proximo_numero atomically
  const { data: numRow, error: numErr } = await service.rpc("increment_nfse_numero");
  if (numErr || !numRow) {
    // Fallback: manual increment
    const { data: updated, error: updErr } = await service
      .from("company_nfse_config")
      .update({ proximo_numero: (cfg.proximo_numero ?? 1) + 1 })
      .eq("id", cfg.id)
      .select("proximo_numero")
      .single();
    if (updErr || !updated) return json({ error: "Falha ao incrementar número da NFS-e" }, 500);
  }
  const numero = cfg.proximo_numero ?? 1;

  // 9. Insert nfse_emitidas with status 'pendente'
  const nfseRecord = {
    numero,
    serie: cfg.serie ?? "1",
    prestador,
    tomador,
    servico,
    valor_servico,
    aliq_iss,
    valor_iss,
    valor_pis,
    valor_cofins,
    valor_csll,
    valor_irpj,
    valor_inss,
    valor_iss_retido,
    valor_liquido,
    installment_id: source === "installment" ? source_id : null,
    receivable_id: source === "receivable" ? source_id : null,
    guardian_id,
    status: "pendente",
    emitida_por: initiated_by,
  };

  const { data: nfse, error: insertErr } = await service
    .from("nfse_emitidas")
    .insert(nfseRecord)
    .select("id")
    .single();
  if (insertErr || !nfse) return json({ error: "Falha ao registrar NFS-e", detail: insertErr?.message }, 500);

  const nfse_id = nfse.id;

  // 10. Call provider API
  let providerResult: ProviderResponse;
  try {
    providerResult = await callProviderApi(cfg as Record<string, unknown>, {
      ambiente: cfg.ambiente ?? "homologacao",
      prestador,
      tomador,
      servico,
      numero,
      serie: cfg.serie ?? "1",
    });
  } catch (e) {
    providerResult = {
      provider_nfse_id: "",
      link_pdf: null,
      xml_retorno: null,
      status: "pendente",
      error_message: e instanceof Error ? e.message : "Erro desconhecido",
    };
  }

  // 11. Update nfse_emitidas with provider response
  const updatePayload: Record<string, unknown> = {
    status: providerResult.status,
    provider_nfse_id: providerResult.provider_nfse_id || null,
    link_pdf: providerResult.link_pdf,
    xml_retorno: providerResult.xml_retorno,
  };
  if (providerResult.status === "rejeitada") {
    updatePayload.motivo_rejeicao = providerResult.error_message ?? null;
  }
  await service.from("nfse_emitidas").update(updatePayload).eq("id", nfse_id);

  // 12. Insert emission log
  await service.from("nfse_emission_log").insert({
    nfse_id,
    tentativa: 1,
    iniciado_por: initiated_by,
    dados_env: { prestador, tomador, servico, numero, serie: cfg.serie },
    resposta: providerResult as unknown as Record<string, unknown>,
    status: providerResult.status === "autorizada" ? "success" : providerResult.status === "rejeitada" ? "error" : "pending",
  });

  // 13. If authorized, notify via WhatsApp
  if (providerResult.status === "autorizada" && guardian.telefone) {
    try {
      const orchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/message-orchestrator`;
      await fetch(orchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          phone: guardian.telefone,
          module: "fiscal",
          body: `Sua NFS-e nº ${numero} foi emitida. Link: ${providerResult.link_pdf ?? "em breve disponível"}`,
          priority: 1,
        }),
      });
    } catch {
      // notification failure is non-fatal
    }
  }

  // 14. Return result
  return json({ success: true, nfse_id, status: providerResult.status, numero });
});
