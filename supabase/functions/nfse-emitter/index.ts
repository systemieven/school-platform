/**
 * nfse-emitter
 *
 * Motor de emissao de NFS-e.
 * Carrega configuracao, valida dados fiscais do tomador, constroi o payload
 * DPS (NFS-e Nacional — LC 214/2024), chama o provider e persiste o resultado.
 *
 * Providers suportados:
 *   - nuvem_fiscal  (implementado — Sprint 14.S.P.1)
 *   - outros        (stub generico para expansao futura)
 *
 * Auth: aceita service-role Bearer ou JWT de usuario.
 *
 * Body: { source, source_id, guardian_id, valor_servico, discriminacao, initiated_by }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { nuvemFiscalFetch } from "../_shared/nuvemFiscal.ts";

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
  raw?: unknown;
}

// ── Provider: Nuvem Fiscal ────────────────────────────────────────────────────
//
// Docs: https://dev.nuvemfiscal.com.br/docs/api
// Endpoint DPS (NFS-e Nacional): POST /nfse/dps
// Resposta sincrona traz `id`, `status`, `dataEmissao`, `numero` etc.
// PDF/XML sao obtidos depois via GET /nfse/{id}/pdf e /nfse/{id}/xml.

interface NuvemFiscalDps {
  provedor: "padrao_nacional";
  ambiente: "producao" | "homologacao";
  referencia?: string;
  infDPS: {
    tpAmb: 1 | 2;
    dhEmi: string;
    verAplic?: string;
    serie: string;
    nDPS: string;
    dCompet: string;
    tpEmit: 1;
    cLocEmi: string;
    subst?: unknown;
    prest: {
      CNPJ?: string;
      CPF?: string;
      IM?: string;
      xNome: string;
      end: {
        endNac: {
          xLgr: string;
          nro: string;
          xCpl?: string;
          xBairro: string;
          CEP: string;
          cMun: string;
          UF: string;
        };
      };
    };
    toma: {
      CNPJ?: string;
      CPF?: string;
      xNome: string;
      email?: string;
      end?: {
        endNac: {
          xLgr: string;
          nro: string;
          xCpl?: string;
          xBairro: string;
          CEP: string;
          cMun: string;
          UF: string;
        };
      };
    };
    serv: {
      locPrest: { cLocPrestacao: string };
      cServ: {
        cTribNac: string;
        cTribMun?: string;
        CNAE?: string;
        xDescServ: string;
        cNBS?: string;
      };
    };
    valores: {
      vServPrest: { vServ: number };
      trib: {
        tribMun: {
          tribISSQN: 1 | 2 | 3 | 4;
          pAliq?: number;
          tpRetISSQN?: 1 | 2;
        };
        totTrib?: {
          pTotTribFed?: number;
          pTotTribEst?: number;
          pTotTribMun?: number;
        };
      };
    };
  };
}

function mapNuvemFiscalStatus(raw: string | undefined): ProviderResponse["status"] {
  if (!raw) return "pendente";
  const s = raw.toLowerCase();
  if (["autorizada", "processada", "emitida"].includes(s)) return "autorizada";
  if (["rejeitada", "negada", "erro"].includes(s)) return "rejeitada";
  return "pendente";
}

async function callNuvemFiscal(
  service: SupabaseClient,
  dps: NuvemFiscalDps,
): Promise<ProviderResponse> {
  let res: Response;
  try {
    res = await nuvemFiscalFetch(service, "/nfse/dps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dps),
    });
  } catch (e) {
    return {
      provider_nfse_id: "",
      link_pdf: null,
      xml_retorno: null,
      status: "rejeitada",
      error_message: e instanceof Error ? e.message : "Falha ao autenticar na Nuvem Fiscal",
    };
  }

  const baseUrl = res.url.replace(/\/nfse(?:\/.*)?$/, "");
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      (data as { message?: string; error?: string; mensagem?: string }).message ||
      (data as { error?: string }).error ||
      (data as { mensagem?: string }).mensagem ||
      `HTTP ${res.status}`;
    return {
      provider_nfse_id: "",
      link_pdf: null,
      xml_retorno: null,
      status: "rejeitada",
      error_message: msg,
      raw: data,
    };
  }

  const d = data as {
    id?: string;
    status?: string;
    numero?: string | number;
    mensagens?: { descricao?: string }[];
    DPS?: { infDPS?: unknown };
  };

  return {
    provider_nfse_id: d.id ?? "",
    link_pdf: d.id ? `${baseUrl}/nfse/${d.id}/pdf` : null,
    xml_retorno: null, // Nuvem Fiscal retorna XML via endpoint separado; gravado no webhook
    status: mapNuvemFiscalStatus(d.status),
    error_message: d.mensagens?.[0]?.descricao,
    raw: data,
  };
}

// ── Provider: generico (stub) ─────────────────────────────────────────────────

async function callGenericProvider(
  cfg: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<ProviderResponse> {
  const baseUrl = (cfg.api_base_url as string | null) ?? "";
  const token = cfg.api_token_enc as string;
  if (!baseUrl) {
    return {
      provider_nfse_id: "",
      link_pdf: null,
      xml_retorno: null,
      status: "rejeitada",
      error_message: "Provider generico requer api_base_url",
    };
  }
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
    return {
      provider_nfse_id: "",
      link_pdf: null,
      xml_retorno: null,
      status: "rejeitada",
      error_message: text,
    };
  }
  const data = await res.json();
  return {
    provider_nfse_id: data.id ?? data.nfse_id ?? "",
    link_pdf: data.link_pdf ?? data.url_pdf ?? null,
    xml_retorno: data.xml ?? null,
    status:
      data.status === "autorizada"
        ? "autorizada"
        : data.status === "rejeitada"
          ? "rejeitada"
          : "pendente",
    error_message: data.error_message ?? undefined,
  };
}

// ── DPS builder ───────────────────────────────────────────────────────────────

function buildNuvemFiscalDps(args: {
  ambiente: "producao" | "homologacao";
  cfg: Record<string, unknown>;
  fiscal: Record<string, unknown>;
  guardian: Record<string, unknown>;
  servico: {
    codigo_servico: string;
    cnae?: string | null;
    item_lc116?: string | null;
    discriminacao: string;
    aliq_iss: number;
    valor_servico: number;
  };
  numero: number;
  serie: string;
}): NuvemFiscalDps {
  const { ambiente, cfg, fiscal, guardian, servico, numero, serie } = args;
  const tpAmb = ambiente === "producao" ? 1 : 2;
  const cMunPrest = String(cfg.codigo_municipio_ibge ?? "");
  const now = new Date();
  const dhEmi = now.toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const dCompet = now.toISOString().slice(0, 10);

  const cnpjDigits = String(fiscal.cnpj ?? "").replace(/\D/g, "");
  const tomDoc = String(guardian.cpf_cnpj ?? "").replace(/\D/g, "");
  const tipoPessoa = (guardian.tipo_pessoa as string | undefined) ?? (tomDoc.length === 14 ? "J" : "F");

  const reterIss = Boolean(cfg.reter_iss);

  return {
    provedor: "padrao_nacional",
    ambiente,
    referencia: `${serie}-${numero}`,
    infDPS: {
      tpAmb,
      dhEmi,
      verAplic: "school-platform-1.0",
      serie,
      nDPS: String(numero),
      dCompet,
      tpEmit: 1,
      cLocEmi: cMunPrest,
      prest: {
        CNPJ: cnpjDigits || undefined,
        IM: (cfg.inscricao_municipal as string | null) ?? (fiscal.im as string | null) ?? undefined,
        xNome: String(fiscal.razao_social ?? ""),
        end: {
          endNac: {
            xLgr: String(fiscal.logradouro ?? ""),
            nro: String(fiscal.numero ?? ""),
            xCpl: (fiscal.complemento as string | null) ?? undefined,
            xBairro: String(fiscal.bairro ?? ""),
            CEP: String(fiscal.cep ?? "").replace(/\D/g, ""),
            cMun: cMunPrest,
            UF: String(fiscal.uf ?? ""),
          },
        },
      },
      toma: {
        CNPJ: tipoPessoa === "J" ? tomDoc : undefined,
        CPF: tipoPessoa === "F" ? tomDoc : undefined,
        xNome: String(guardian.full_name ?? ""),
        email: (guardian.email_fiscal as string | null) ?? undefined,
        end: {
          endNac: {
            xLgr: String(guardian.logradouro_fiscal ?? ""),
            nro: String(guardian.numero_fiscal ?? ""),
            xCpl: (guardian.complemento_fiscal as string | null) ?? undefined,
            xBairro: String(guardian.bairro_fiscal ?? ""),
            CEP: String(guardian.cep_fiscal ?? "").replace(/\D/g, ""),
            cMun: String(guardian.codigo_municipio_ibge_fiscal ?? cMunPrest),
            UF: String(guardian.uf_fiscal ?? ""),
          },
        },
      },
      serv: {
        locPrest: { cLocPrestacao: cMunPrest },
        cServ: {
          cTribNac: servico.item_lc116 ?? servico.codigo_servico,
          cTribMun: servico.codigo_servico,
          CNAE: servico.cnae ?? undefined,
          xDescServ: servico.discriminacao.slice(0, 2000),
        },
      },
      valores: {
        vServPrest: { vServ: servico.valor_servico },
        trib: {
          tribMun: {
            tribISSQN: 1,
            pAliq: servico.aliq_iss,
            tpRetISSQN: reterIss ? 1 : 2,
          },
        },
      },
    },
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

  let body: EmitRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { source, source_id, guardian_id, valor_servico, discriminacao, initiated_by } = body;
  if (!source || !source_id || !guardian_id || !valor_servico || !discriminacao || !initiated_by) {
    return json({ error: "Campos obrigatorios ausentes" }, 400);
  }

  // 1. Config NFS-e
  const { data: cfg, error: cfgErr } = await service
    .from("company_nfse_config")
    .select("*")
    .single();
  if (cfgErr || !cfg) return json({ error: "NFS-e nao configurado" }, 422);

  // 2. Responsavel + dados fiscais
  const { data: guardian, error: gErr } = await service
    .from("guardian_profiles")
    .select("*")
    .eq("id", guardian_id)
    .single();
  if (gErr || !guardian) return json({ error: "Responsavel nao encontrado" }, 404);

  if (!guardian.fiscal_data_complete) {
    const missing: string[] = [];
    if (!guardian.cpf_cnpj) missing.push("CPF/CNPJ");
    if (!guardian.logradouro_fiscal) missing.push("Logradouro");
    if (!guardian.numero_fiscal) missing.push("Numero");
    if (!guardian.bairro_fiscal) missing.push("Bairro");
    if (!guardian.cep_fiscal) missing.push("CEP");
    if (!guardian.municipio_fiscal) missing.push("Municipio");
    if (!guardian.uf_fiscal) missing.push("UF");
    return json({ error: "Dados fiscais incompletos do responsavel", missing_fields: missing }, 422);
  }

  // 3. Config fiscal (prestador)
  const { data: fiscal, error: fErr } = await service
    .from("company_fiscal_config")
    .select("*")
    .single();
  if (fErr || !fiscal) return json({ error: "Configuracao fiscal da empresa nao encontrada" }, 422);

  // 4. Montagem dos blocos
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

  const aliq_iss = Number(cfg.aliq_iss_padrao ?? 0);
  const servico = {
    codigo_servico: ((cfg as Record<string, unknown>).codigo_servico as string) ?? "",
    cnae: ((cfg as Record<string, unknown>).cnae as string) ?? null,
    item_lc116: ((cfg as Record<string, unknown>).item_lc116 as string) ?? null,
    discriminacao,
    aliq_iss,
    valor_servico,
  };

  const valor_iss = cfg.reter_iss ? 0 : +(valor_servico * aliq_iss / 100).toFixed(2);
  const valor_iss_retido = cfg.reter_iss ? +(valor_servico * aliq_iss / 100).toFixed(2) : 0;
  const valor_pis = cfg.reter_pis ? +(valor_servico * 0.0065).toFixed(2) : 0;
  const valor_cofins = cfg.reter_cofins ? +(valor_servico * 0.03).toFixed(2) : 0;
  const valor_csll = cfg.reter_csll ? +(valor_servico * 0.01).toFixed(2) : 0;
  const valor_irpj = cfg.reter_irpj ? +(valor_servico * 0.015).toFixed(2) : 0;
  const valor_inss = cfg.reter_inss ? +(valor_servico * 0.11).toFixed(2) : 0;
  const deducoes = valor_iss_retido + valor_pis + valor_cofins + valor_csll + valor_irpj + valor_inss;
  const valor_liquido = +(valor_servico - deducoes).toFixed(2);

  // 5. Reserva numero atomicamente
  const { data: numRow, error: numErr } = await service.rpc("increment_nfse_numero");
  if (numErr || numRow === null || numRow === undefined) {
    return json({ error: "Falha ao reservar numero da NFS-e", detail: numErr?.message }, 500);
  }
  const numero = Number(numRow);

  // 6. Insert pendente
  const nfseRecord = {
    numero,
    serie: cfg.serie ?? "RPS",
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

  // 7. Chamada do provider (dispatcher)
  let providerResult: ProviderResponse;
  let dadosEnv: Record<string, unknown>;
  try {
    if (cfg.provider === "nuvem_fiscal") {
      const dps = buildNuvemFiscalDps({
        ambiente: (cfg.ambiente as "producao" | "homologacao") ?? "homologacao",
        cfg: cfg as Record<string, unknown>,
        fiscal: fiscal as Record<string, unknown>,
        guardian: guardian as Record<string, unknown>,
        servico,
        numero,
        serie: (cfg.serie as string) ?? "RPS",
      });
      dadosEnv = dps as unknown as Record<string, unknown>;
      providerResult = await callNuvemFiscal(service, dps);
    } else {
      dadosEnv = { prestador, tomador, servico, numero, serie: cfg.serie };
      providerResult = await callGenericProvider(cfg as Record<string, unknown>, dadosEnv);
    }
  } catch (e) {
    providerResult = {
      provider_nfse_id: "",
      link_pdf: null,
      xml_retorno: null,
      status: "pendente",
      error_message: e instanceof Error ? e.message : "Erro desconhecido",
    };
    dadosEnv = { prestador, tomador, servico, numero, serie: cfg.serie };
  }

  // 8. Update nfse_emitidas
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

  // 9. Log
  await service.from("nfse_emission_log").insert({
    nfse_id,
    tentativa: 1,
    iniciado_por: initiated_by,
    dados_env: dadosEnv,
    resposta: providerResult as unknown as Record<string, unknown>,
    status:
      providerResult.status === "autorizada"
        ? "success"
        : providerResult.status === "rejeitada"
          ? "error"
          : "pending",
  });

  // 10. WhatsApp (se autorizada ja na chamada sincrona)
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
          body: `Sua NFS-e n. ${numero} foi emitida. Link: ${providerResult.link_pdf ?? "em breve disponivel"}`,
          priority: 1,
        }),
      });
    } catch {
      // falha de notificacao nao bloqueia
    }
  }

  return json({ success: true, nfse_id, status: providerResult.status, numero });
});
