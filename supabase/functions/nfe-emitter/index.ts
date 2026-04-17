/**
 * nfe-emitter
 *
 * Motor de emissao de NF-e modelo 55 (devolucao) a partir de nfe_entries.
 * Carrega config + emitente + fornecedor (destinatario) + itens e monta
 * envelope infNFe v4.00 com finNFe=4 (devolucao) e refNFe apontando para
 * a chave da NF-e original importada.
 *
 * Providers: nuvem_fiscal (POST /nfe) | outros (stub).
 *
 * Body: { nfe_entry_id: string, motivo_devolucao: string,
 *         itens_selecionados?: string[], initiated_by?: string,
 *         action?: 'test' }
 * Auth: service-role ou JWT.
 *
 * Destinatario: fornecedor em `fornecedores` com cnpj_cpf = nfe_entries.emitente_cnpj.
 * CFOP: 5.202 (mesma UF) ou 6.202 (interestadual) — devolucao de compra.
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

interface ProviderResponse {
  provider_nfe_id: string;
  chave_nfe: string | null;
  protocolo: string | null;
  link_danfe: string | null;
  link_xml: string | null;
  xml_retorno: string | null;
  status: "autorizada" | "pendente" | "rejeitada" | "denegada";
  error_message?: string;
  raw?: unknown;
}

function mapNuvemFiscalStatus(raw: string | undefined): ProviderResponse["status"] {
  if (!raw) return "pendente";
  const s = raw.toLowerCase();
  if (["autorizada", "autorizado", "emitida", "processada"].includes(s)) return "autorizada";
  if (["denegada"].includes(s)) return "denegada";
  if (["rejeitada", "erro", "negada"].includes(s)) return "rejeitada";
  return "pendente";
}

async function callNuvemFiscal(
  cfg: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<ProviderResponse> {
  const baseUrl = (cfg.api_base_url as string | null) || "https://api.nuvemfiscal.com.br";
  const token = cfg.api_token_enc as string;

  if (!token) {
    return {
      provider_nfe_id: "",
      chave_nfe: null,
      protocolo: null,
      link_danfe: null,
      link_xml: null,
      xml_retorno: null,
      status: "rejeitada",
      error_message: "API token da Nuvem Fiscal nao configurado",
    };
  }

  const res = await fetch(`${baseUrl}/nfe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const d = data as { message?: string; error?: string; mensagem?: string };
    return {
      provider_nfe_id: "",
      chave_nfe: null,
      protocolo: null,
      link_danfe: null,
      link_xml: null,
      xml_retorno: null,
      status: "rejeitada",
      error_message: d.message || d.error || d.mensagem || `HTTP ${res.status}`,
      raw: data,
    };
  }

  const d = data as {
    id?: string;
    status?: string;
    chave?: string;
    protocolo?: string;
    autorizacao?: { protocolo?: string };
    mensagens?: { descricao?: string }[];
  };

  return {
    provider_nfe_id: d.id ?? "",
    chave_nfe: d.chave ?? null,
    protocolo: d.protocolo ?? d.autorizacao?.protocolo ?? null,
    link_danfe: d.id ? `${baseUrl}/nfe/${d.id}/pdf` : null,
    link_xml: d.id ? `${baseUrl}/nfe/${d.id}/xml` : null,
    xml_retorno: null,
    status: mapNuvemFiscalStatus(d.status),
    error_message: d.mensagens?.[0]?.descricao,
    raw: data,
  };
}

async function callGenericProvider(
  _cfg: Record<string, unknown>,
  _payload: Record<string, unknown>,
): Promise<ProviderResponse> {
  return {
    provider_nfe_id: "",
    chave_nfe: null,
    protocolo: null,
    link_danfe: null,
    link_xml: null,
    xml_retorno: null,
    status: "rejeitada",
    error_message: "Provider generico ainda nao implementado para NF-e",
  };
}

interface NfeItem {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  ncm: string | null;
  cfop: string | null;
  ean: string | null;
  unidade_trib: string | null;
  origem: number | null;
  cst_icms: string | null;
  csosn: string | null;
  aliq_icms: number | null;
  cst_pis: string | null;
  aliq_pis: number | null;
  cst_cofins: string | null;
  aliq_cofins: number | null;
}

function cfopDevolucao(ufEmit: string | null, ufDest: string | null): string {
  if (!ufEmit || !ufDest) return "5202";
  return ufEmit.toUpperCase() === ufDest.toUpperCase() ? "5202" : "6202";
}

function buildNfePayload(args: {
  cfg: Record<string, unknown>;
  fiscal: Record<string, unknown>;
  fornecedor: Record<string, unknown>;
  nfeEntry: Record<string, unknown>;
  items: NfeItem[];
  motivo: string;
  numero: number;
}): Record<string, unknown> {
  const { cfg, fiscal, fornecedor, nfeEntry, items, motivo, numero } = args;
  const ambiente = (cfg.ambiente as string) === "producao" ? "producao" : "homologacao";
  const tpAmb = ambiente === "producao" ? 1 : 2;
  const serie = Number(cfg.serie ?? 1);
  const cnpjEmit = String(fiscal.cnpj ?? "").replace(/\D/g, "");
  const now = new Date();
  const dhEmi = now.toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const ufEmit = String(fiscal.uf ?? "");
  const ufDest = String(fornecedor.uf ?? "");
  const cfop = cfopDevolucao(ufEmit, ufDest);

  const det = items.map((item, idx) => ({
    nItem: idx + 1,
    prod: {
      cProd: item.id.slice(0, 8),
      cEAN: item.ean ?? "SEM GTIN",
      xProd: item.descricao.slice(0, 120),
      NCM: item.ncm ?? "00000000",
      CFOP: cfop,
      uCom: item.unidade_trib ?? "UN",
      qCom: item.quantidade,
      vUnCom: item.valor_unitario,
      vProd: item.valor_total,
      cEANTrib: item.ean ?? "SEM GTIN",
      uTrib: item.unidade_trib ?? "UN",
      qTrib: item.quantidade,
      vUnTrib: item.valor_unitario,
      indTot: 1,
    },
    imposto: {
      ICMS: {
        ICMSSN102: {
          orig: item.origem ?? 0,
          CSOSN: item.csosn ?? "102",
        },
      },
      PIS: {
        PISAliq: {
          CST: item.cst_pis ?? "01",
          vBC: item.valor_total,
          pPIS: Number(item.aliq_pis ?? 0),
          vPIS: +(item.valor_total * Number(item.aliq_pis ?? 0) / 100).toFixed(2),
        },
      },
      COFINS: {
        COFINSAliq: {
          CST: item.cst_cofins ?? "01",
          vBC: item.valor_total,
          pCOFINS: Number(item.aliq_cofins ?? 0),
          vCOFINS: +(item.valor_total * Number(item.aliq_cofins ?? 0) / 100).toFixed(2),
        },
      },
    },
  }));

  const vProd = items.reduce((s, i) => s + i.valor_total, 0);
  const vNF = +vProd.toFixed(2);
  const chaveRef = String(nfeEntry.chave_acesso ?? "").replace(/\D/g, "");

  return {
    provedor: "nuvem_fiscal",
    ambiente,
    infNFe: {
      versao: "4.00",
      ide: {
        cUF: Number(fiscal.uf_codigo_ibge ?? 0),
        natOp: `DEVOLUCAO DE COMPRA - ${motivo}`.slice(0, 60),
        mod: 55,
        serie,
        nNF: numero,
        dhEmi,
        tpNF: 1,
        idDest: ufEmit === ufDest ? 1 : 2,
        cMunFG: String(fiscal.codigo_municipio_ibge ?? ""),
        tpImp: 1,
        tpEmis: 1,
        tpAmb,
        finNFe: 4,
        indFinal: 0,
        indPres: 0,
        NFref: chaveRef ? [{ refNFe: chaveRef }] : undefined,
      },
      emit: {
        CNPJ: cnpjEmit,
        xNome: String(fiscal.razao_social ?? ""),
        xFant: (fiscal.nome_fantasia as string | null) ?? undefined,
        enderEmit: {
          xLgr: String(fiscal.logradouro ?? ""),
          nro: String(fiscal.numero ?? ""),
          xCpl: (fiscal.complemento as string | null) ?? undefined,
          xBairro: String(fiscal.bairro ?? ""),
          cMun: String(fiscal.codigo_municipio_ibge ?? ""),
          xMun: String(fiscal.municipio ?? ""),
          UF: ufEmit,
          CEP: String(fiscal.cep ?? "").replace(/\D/g, ""),
          cPais: 1058,
          xPais: "BRASIL",
        },
        IE: String(fiscal.ie ?? ""),
        CRT: Number(fiscal.crt ?? 1),
      },
      dest: {
        CNPJ: String(fornecedor.cnpj_cpf ?? "").replace(/\D/g, ""),
        xNome: String(fornecedor.razao_social ?? ""),
        enderDest: {
          xLgr: String(fornecedor.logradouro ?? ""),
          nro: String(fornecedor.numero ?? ""),
          xCpl: (fornecedor.complemento as string | null) ?? undefined,
          xBairro: String(fornecedor.bairro ?? ""),
          cMun: String(fornecedor.codigo_municipio_ibge ?? ""),
          xMun: String(fornecedor.municipio ?? ""),
          UF: ufDest,
          CEP: String(fornecedor.cep ?? "").replace(/\D/g, ""),
          cPais: 1058,
          xPais: "BRASIL",
        },
        indIEDest: fornecedor.ie ? 1 : 9,
        IE: fornecedor.ie ? String(fornecedor.ie) : undefined,
      },
      det,
      total: {
        ICMSTot: {
          vBC: 0,
          vICMS: 0,
          vICMSDeson: 0,
          vBCST: 0,
          vST: 0,
          vProd: +vProd.toFixed(2),
          vFrete: 0,
          vSeg: 0,
          vDesc: 0,
          vII: 0,
          vIPI: 0,
          vPIS: 0,
          vCOFINS: 0,
          vOutro: 0,
          vNF,
        },
      },
      transp: { modFrete: 9 },
      infAdic: {
        infCpl: `Devolucao referente a NF-e ${chaveRef}. Motivo: ${motivo}`.slice(0, 500),
      },
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: {
    nfe_entry_id?: string;
    motivo_devolucao?: string;
    itens_selecionados?: string[];
    initiated_by?: string;
    action?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  // Ping de teste do painel de configs
  if (body.action === "test") {
    const { data: cfg } = await service
      .from("company_nfe_config")
      .select("provider, api_base_url, api_token_enc, ambiente")
      .maybeSingle();
    if (!cfg) return json({ ok: false, status: "none", message: "company_nfe_config nao configurado" });
    const missing: string[] = [];
    if (!cfg.api_token_enc) missing.push("api_token_enc");
    if (missing.length) {
      return json({ ok: false, status: "none", message: `Faltando: ${missing.join(", ")}` });
    }
    return json({
      ok: true,
      status: cfg.ambiente === "producao" ? "ativa" : "homologacao",
      message: `Config OK (${cfg.provider}, ${cfg.ambiente})`,
    });
  }

  const { nfe_entry_id, motivo_devolucao, itens_selecionados, initiated_by } = body;
  if (!nfe_entry_id) return json({ error: "nfe_entry_id obrigatorio" }, 400);
  if (!motivo_devolucao || motivo_devolucao.trim().length < 10) {
    return json({ error: "motivo_devolucao obrigatorio (minimo 10 caracteres)" }, 400);
  }

  // 1. Config NF-e
  const { data: cfg, error: cfgErr } = await service
    .from("company_nfe_config")
    .select("*")
    .maybeSingle();
  if (cfgErr || !cfg) return json({ error: "NF-e nao configurada" }, 422);

  // 2. Config fiscal (emitente)
  const { data: fiscal, error: fErr } = await service
    .from("company_fiscal_config")
    .select("*")
    .maybeSingle();
  if (fErr || !fiscal) return json({ error: "Configuracao fiscal da empresa nao encontrada" }, 422);

  // 3. NF-e de entrada (origem da devolucao)
  const { data: entry, error: eErr } = await service
    .from("nfe_entries")
    .select("id, emitente_cnpj, emitente_nome, chave_acesso, data_emissao, valor_total")
    .eq("id", nfe_entry_id)
    .single();
  if (eErr || !entry) return json({ error: "NF-e de entrada nao encontrada" }, 404);
  if (!entry.chave_acesso) {
    return json({ error: "NF-e de entrada sem chave_acesso — nao e possivel referenciar" }, 422);
  }

  // 4. Fornecedor (destinatario da devolucao)
  const { data: fornecedor, error: fnErr } = await service
    .from("fornecedores")
    .select("*")
    .eq("cnpj_cpf", entry.emitente_cnpj)
    .maybeSingle();
  if (fnErr || !fornecedor) {
    return json({
      error: "Fornecedor nao cadastrado. Cadastre o fornecedor antes de emitir devolucao.",
      cnpj: entry.emitente_cnpj,
    }, 422);
  }

  // 5. Itens
  let itensQuery = service
    .from("nfe_entry_items")
    .select("*")
    .eq("nfe_entry_id", nfe_entry_id);
  if (itens_selecionados && itens_selecionados.length > 0) {
    itensQuery = itensQuery.in("id", itens_selecionados);
  }
  const { data: items } = await itensQuery;
  if (!items || items.length === 0) {
    return json({ error: "Nenhum item encontrado para devolucao" }, 422);
  }

  const nfeItems: NfeItem[] = items.map((i) => ({
    id: (i as { id: string }).id,
    descricao: (i as { descricao: string | null }).descricao ?? "ITEM",
    quantidade: Number((i as { quantidade: number | null }).quantidade ?? 0),
    valor_unitario: Number((i as { valor_unitario: number | null }).valor_unitario ?? 0),
    valor_total: Number((i as { valor_total: number | null }).valor_total ?? 0),
    ncm: (i as { ncm: string | null }).ncm,
    cfop: (i as { cfop: string | null }).cfop,
    ean: (i as { ean: string | null }).ean,
    unidade_trib: (i as { unidade_trib: string | null }).unidade_trib,
    origem: (i as { origem: number | null }).origem,
    cst_icms: (i as { cst_icms: string | null }).cst_icms,
    csosn: (i as { csosn: string | null }).csosn,
    aliq_icms: (i as { aliq_icms: number | null }).aliq_icms,
    cst_pis: (i as { cst_pis: string | null }).cst_pis,
    aliq_pis: (i as { aliq_pis: number | null }).aliq_pis,
    cst_cofins: (i as { cst_cofins: string | null }).cst_cofins,
    aliq_cofins: (i as { aliq_cofins: number | null }).aliq_cofins,
  }));

  // 6. Reserva numero atomicamente
  const { data: numRow, error: numErr } = await service.rpc("increment_nfe_numero");
  if (numErr || numRow === null || numRow === undefined) {
    return json({ error: "Falha ao reservar numero da NF-e", detail: numErr?.message }, 500);
  }
  const numero = Number(numRow);

  // 7. Insert pendente
  const valorTotal = nfeItems.reduce((s, i) => s + i.valor_total, 0);
  const nfeRecord = {
    nfe_entry_id,
    tipo_operacao: "devolucao",
    numero,
    serie: Number(cfg.serie ?? 1),
    emitente: {
      razao_social: fiscal.razao_social,
      cnpj: fiscal.cnpj,
      ie: fiscal.ie,
    },
    destinatario: {
      cnpj_cpf: fornecedor.cnpj_cpf,
      razao_social: fornecedor.razao_social,
      ie: fornecedor.ie,
      uf: fornecedor.uf,
      municipio: fornecedor.municipio,
    },
    itens: nfeItems.map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      valor_total: i.valor_total,
      ncm: i.ncm,
    })),
    referencia: {
      chave_nfe_original: entry.chave_acesso,
      nfe_entry_id,
    },
    valor_total: +valorTotal.toFixed(2),
    motivo_operacao: motivo_devolucao,
    status: "pendente",
    emitida_por: initiated_by ?? null,
  };

  const { data: nfe, error: insertErr } = await service
    .from("nfe_emitidas")
    .insert(nfeRecord)
    .select("id")
    .single();
  if (insertErr || !nfe) {
    return json({ error: "Falha ao registrar NF-e", detail: insertErr?.message }, 500);
  }
  const nfe_id = nfe.id;

  // 8. Chamada do provider
  let providerResult: ProviderResponse;
  let dadosEnv: Record<string, unknown>;
  try {
    if (cfg.provider === "nuvem_fiscal") {
      dadosEnv = buildNfePayload({
        cfg: cfg as Record<string, unknown>,
        fiscal: fiscal as Record<string, unknown>,
        fornecedor: fornecedor as Record<string, unknown>,
        nfeEntry: entry as Record<string, unknown>,
        items: nfeItems,
        motivo: motivo_devolucao,
        numero,
      });
      providerResult = await callNuvemFiscal(cfg as Record<string, unknown>, dadosEnv);
    } else {
      dadosEnv = { numero, nfe_entry_id, note: "provider generico" };
      providerResult = await callGenericProvider(cfg as Record<string, unknown>, dadosEnv);
    }
  } catch (e) {
    providerResult = {
      provider_nfe_id: "",
      chave_nfe: null,
      protocolo: null,
      link_danfe: null,
      link_xml: null,
      xml_retorno: null,
      status: "pendente",
      error_message: e instanceof Error ? e.message : "Erro desconhecido",
    };
    dadosEnv = { numero, nfe_entry_id, error: true };
  }

  // 9. Update nfe_emitidas
  const updatePayload: Record<string, unknown> = {
    status: providerResult.status,
    provider_nfe_id: providerResult.provider_nfe_id || null,
    chave_nfe: providerResult.chave_nfe,
    protocolo: providerResult.protocolo,
    link_danfe: providerResult.link_danfe,
    link_xml: providerResult.link_xml,
    xml_retorno: providerResult.xml_retorno,
  };
  if (providerResult.status === "autorizada") {
    updatePayload.autorizada_em = new Date().toISOString();
  }
  if (providerResult.status === "rejeitada" || providerResult.status === "denegada") {
    updatePayload.motivo_rejeicao = providerResult.error_message ?? null;
  }
  await service.from("nfe_emitidas").update(updatePayload).eq("id", nfe_id);

  // 10. Log
  await service.from("nfe_emission_log").insert({
    nfe_id,
    tentativa: 1,
    iniciado_por: initiated_by ?? null,
    dados_env: dadosEnv,
    resposta: providerResult as unknown as Record<string, unknown>,
    status:
      providerResult.status === "autorizada"
        ? "success"
        : providerResult.status === "pendente"
          ? "pending"
          : "error",
  });

  return json({
    success: providerResult.status !== "rejeitada" && providerResult.status !== "denegada",
    nfe_id,
    status: providerResult.status,
    numero,
    link_danfe: providerResult.link_danfe,
    error: providerResult.error_message,
  });
});
