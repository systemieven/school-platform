/**
 * nfce-emitter
 *
 * Motor de emissao de NFC-e (modelo 65) a partir de store_orders.
 * Carrega config + emitente + consumidor + itens (com product_fiscal_data),
 * constroi payload infNFe, chama provider e persiste em nfce_emitidas.
 *
 * Providers: nuvem_fiscal (POST /nfce) | outros (stub).
 *
 * Body: { order_id: string, initiated_by?: string, action?: 'test' }
 * Auth: service-role ou JWT.
 *
 * CPF do consumidor: vem de store_orders.consumer_cpf_cnpj se preenchido,
 * senao de students.guardian_id -> guardian_profiles.cpf_cnpj.
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
  provider_nfce_id: string;
  chave_nfce: string | null;
  protocolo: string | null;
  link_danfe: string | null;
  link_xml: string | null;
  qrcode_url: string | null;
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

// ── Nuvem Fiscal NFC-e ────────────────────────────────────────────────────────
// POST /nfce — envelope `infNFe` (SEFAZ). Estrutura mais complexa que DPS
// porque NFC-e usa o mesmo layout do NF-e modelo 65. Payload minimo abaixo;
// campos opcionais/tributarios podem ser adicionados conforme necessidade.

async function callNuvemFiscal(
  cfg: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<ProviderResponse> {
  const baseUrl = (cfg.api_base_url as string | null) || "https://api.nuvemfiscal.com.br";
  const token = cfg.api_token_enc as string;

  if (!token) {
    return {
      provider_nfce_id: "",
      chave_nfce: null,
      protocolo: null,
      link_danfe: null,
      link_xml: null,
      qrcode_url: null,
      xml_retorno: null,
      status: "rejeitada",
      error_message: "API token da Nuvem Fiscal nao configurado",
    };
  }

  const res = await fetch(`${baseUrl}/nfce`, {
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
      provider_nfce_id: "",
      chave_nfce: null,
      protocolo: null,
      link_danfe: null,
      link_xml: null,
      qrcode_url: null,
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
    qrcode?: string;
    url_consulta?: string;
    mensagens?: { descricao?: string }[];
  };

  return {
    provider_nfce_id: d.id ?? "",
    chave_nfce: d.chave ?? null,
    protocolo: d.protocolo ?? d.autorizacao?.protocolo ?? null,
    link_danfe: d.id ? `${baseUrl}/nfce/${d.id}/pdf` : null,
    link_xml: d.id ? `${baseUrl}/nfce/${d.id}/xml` : null,
    qrcode_url: d.qrcode ?? d.url_consulta ?? null,
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
    provider_nfce_id: "",
    chave_nfce: null,
    protocolo: null,
    link_danfe: null,
    link_xml: null,
    qrcode_url: null,
    xml_retorno: null,
    status: "rejeitada",
    error_message: "Provider generico ainda nao implementado para NFC-e",
  };
}

// ── Payload builder ───────────────────────────────────────────────────────────

interface OrderItem {
  product_name: string;
  variant_description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_id: string | null;
  fiscal: Record<string, unknown> | null;
}

function buildNfcePayload(args: {
  cfg: Record<string, unknown>;
  fiscal: Record<string, unknown>;
  consumer: { cpf_cnpj: string | null; name: string | null };
  order: Record<string, unknown>;
  items: OrderItem[];
  numero: number;
}): Record<string, unknown> {
  const { cfg, fiscal, consumer, order, items, numero } = args;
  const ambiente = (cfg.ambiente as string) === "producao" ? "producao" : "homologacao";
  const tpAmb = ambiente === "producao" ? 1 : 2;
  const serie = Number(cfg.serie ?? 1);
  const cnpjEmit = String(fiscal.cnpj ?? "").replace(/\D/g, "");
  const now = new Date();
  const dhEmi = now.toISOString().replace(/\.\d{3}Z$/, "-03:00");

  const det = items.map((item, idx) => {
    const f = item.fiscal ?? {};
    return {
      nItem: idx + 1,
      prod: {
        cProd: item.variant_id ?? `ITEM-${idx + 1}`,
        cEAN: (f.ean as string | null) ?? "SEM GTIN",
        xProd: item.variant_description
          ? `${item.product_name} - ${item.variant_description}`
          : item.product_name,
        NCM: (f.ncm as string | null) ?? "00000000",
        CFOP: (f.cfop_saida as string | null) ?? "5102",
        uCom: (f.unidade_trib as string | null) ?? "UN",
        qCom: item.quantity,
        vUnCom: item.unit_price,
        vProd: item.total_price,
        cEANTrib: (f.ean as string | null) ?? "SEM GTIN",
        uTrib: (f.unidade_trib as string | null) ?? "UN",
        qTrib: item.quantity,
        vUnTrib: item.unit_price,
        indTot: 1,
      },
      imposto: {
        ICMS: {
          ICMSSN102: {
            orig: (f.origem as number | null) ?? 0,
            CSOSN: (f.csosn as string | null) ?? "102",
          },
        },
        PIS: {
          PISAliq: {
            CST: (f.cst_pis as string | null) ?? "01",
            vBC: item.total_price,
            pPIS: Number(f.aliq_pis ?? 0),
            vPIS: +(item.total_price * Number(f.aliq_pis ?? 0) / 100).toFixed(2),
          },
        },
        COFINS: {
          COFINSAliq: {
            CST: (f.cst_cofins as string | null) ?? "01",
            vBC: item.total_price,
            pCOFINS: Number(f.aliq_cofins ?? 0),
            vCOFINS: +(item.total_price * Number(f.aliq_cofins ?? 0) / 100).toFixed(2),
          },
        },
      },
    };
  });

  const vProd = items.reduce((s, i) => s + i.total_price, 0);
  const vDesc = Number(order.discount_amount ?? 0);
  const vNF = Number(order.total_amount ?? vProd - vDesc);

  return {
    provedor: "nuvem_fiscal",
    ambiente,
    infNFe: {
      versao: "4.00",
      ide: {
        cUF: Number(fiscal.uf_codigo_ibge ?? 0),
        natOp: "VENDA AO CONSUMIDOR",
        mod: 65,
        serie,
        nNF: numero,
        dhEmi,
        tpNF: 1,
        idDest: 1,
        cMunFG: String(fiscal.codigo_municipio_ibge ?? ""),
        tpImp: 4,
        tpEmis: 1,
        tpAmb,
        finNFe: 1,
        indFinal: 1,
        indPres: 1,
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
          UF: String(fiscal.uf ?? ""),
          CEP: String(fiscal.cep ?? "").replace(/\D/g, ""),
          cPais: 1058,
          xPais: "BRASIL",
        },
        IE: String(fiscal.ie ?? ""),
        CRT: Number(fiscal.crt ?? 1),
      },
      dest: consumer.cpf_cnpj ? {
        CPF: String(consumer.cpf_cnpj).replace(/\D/g, ""),
        xNome: consumer.name ?? undefined,
        indIEDest: 9,
      } : undefined,
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
          vDesc: +vDesc.toFixed(2),
          vII: 0,
          vIPI: 0,
          vPIS: 0,
          vCOFINS: 0,
          vOutro: 0,
          vNF: +vNF.toFixed(2),
        },
      },
      transp: { modFrete: 9 },
      pag: {
        detPag: [{
          tPag: mapPaymentMethod((order.payment_method as string | null) ?? ""),
          vPag: +vNF.toFixed(2),
        }],
      },
    },
  };
}

function mapPaymentMethod(m: string): string {
  const map: Record<string, string> = {
    dinheiro: "01",
    cash: "01",
    cheque: "02",
    credit_card: "03",
    debit_card: "04",
    boleto: "15",
    pix: "17",
    transferencia: "18",
  };
  return map[m.toLowerCase()] ?? "99";
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { order_id?: string; initiated_by?: string; action?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  // Ping de teste do painel de configs
  if (body.action === "test") {
    const { data: cfg } = await service
      .from("company_nfce_config")
      .select("provider, api_base_url, api_token_enc, ambiente, csc, id_csc")
      .maybeSingle();
    if (!cfg) return json({ ok: false, status: "none", message: "company_nfce_config nao configurado" });
    const missing: string[] = [];
    if (!cfg.api_token_enc) missing.push("api_token_enc");
    if (!cfg.csc) missing.push("csc");
    if (!cfg.id_csc) missing.push("id_csc");
    if (missing.length) {
      return json({ ok: false, status: "none", message: `Faltando: ${missing.join(", ")}` });
    }
    return json({
      ok: true,
      status: cfg.ambiente === "producao" ? "ativa" : "homologacao",
      message: `Config OK (${cfg.provider}, ${cfg.ambiente})`,
    });
  }

  const { order_id, initiated_by } = body;
  if (!order_id) return json({ error: "order_id obrigatorio" }, 400);

  // 1. Config NFC-e
  const { data: cfg, error: cfgErr } = await service
    .from("company_nfce_config")
    .select("*")
    .maybeSingle();
  if (cfgErr || !cfg) return json({ error: "NFC-e nao configurado" }, 422);

  // 2. Config fiscal da empresa (emitente)
  const { data: fiscal, error: fErr } = await service
    .from("company_fiscal_config")
    .select("*")
    .maybeSingle();
  if (fErr || !fiscal) return json({ error: "Configuracao fiscal da empresa nao encontrada" }, 422);

  // 3. Pedido + itens
  const { data: order, error: oErr } = await service
    .from("store_orders")
    .select("*")
    .eq("id", order_id)
    .single();
  if (oErr || !order) return json({ error: "Pedido nao encontrado" }, 404);

  const { data: items } = await service
    .from("store_order_items")
    .select("id, variant_id, product_name, variant_description, quantity, unit_price, total_price")
    .eq("order_id", order_id);

  if (!items || items.length === 0) {
    return json({ error: "Pedido sem itens" }, 422);
  }

  // 4. Dados fiscais dos produtos (join via variant -> product)
  const variantIds = items.map((i) => (i as { variant_id: string | null }).variant_id).filter(Boolean) as string[];
  const { data: variants } = variantIds.length
    ? await service
        .from("store_product_variants")
        .select("id, product_id")
        .in("id", variantIds)
    : { data: [] as { id: string; product_id: string }[] };

  const productIds = (variants ?? []).map((v) => v.product_id);
  const { data: fiscalData } = productIds.length
    ? await service
        .from("product_fiscal_data")
        .select("*")
        .in("store_product_id", productIds)
    : { data: [] as Record<string, unknown>[] };

  const variantToProduct = new Map((variants ?? []).map((v) => [v.id, v.product_id]));
  const productToFiscal = new Map(
    (fiscalData ?? []).map((f) => [(f as { store_product_id: string }).store_product_id, f]),
  );

  const itemsWithFiscal: OrderItem[] = items.map((i) => {
    const it = i as {
      variant_id: string | null;
      product_name: string;
      variant_description: string | null;
      quantity: number;
      unit_price: number;
      total_price: number;
    };
    const pid = it.variant_id ? variantToProduct.get(it.variant_id) : null;
    const f = pid ? productToFiscal.get(pid) : null;
    return {
      variant_id: it.variant_id,
      product_name: it.product_name,
      variant_description: it.variant_description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.total_price,
      fiscal: (f as Record<string, unknown> | null) ?? null,
    };
  });

  // 5. CPF do consumidor (prioridade: override no order > responsavel via student)
  let consumerCpf: string | null = (order as { consumer_cpf_cnpj: string | null }).consumer_cpf_cnpj ?? null;
  let consumerName: string | null = (order as { consumer_name: string | null }).consumer_name ?? null;

  if (!consumerCpf) {
    const studentId = (order as { student_id: string | null }).student_id;
    if (studentId) {
      const { data: student } = await service
        .from("students")
        .select("guardian_id")
        .eq("id", studentId)
        .maybeSingle();
      const guardianId = (student as { guardian_id: string | null } | null)?.guardian_id;
      if (guardianId) {
        const { data: guardian } = await service
          .from("guardian_profiles")
          .select("cpf_cnpj, full_name")
          .eq("id", guardianId)
          .maybeSingle();
        consumerCpf = (guardian as { cpf_cnpj: string | null } | null)?.cpf_cnpj ?? null;
        consumerName = consumerName ?? (guardian as { full_name: string | null } | null)?.full_name ?? null;
      }
    }
  }

  // 6. Reserva numero atomicamente
  const { data: numRow, error: numErr } = await service.rpc("increment_nfce_numero");
  if (numErr || numRow === null || numRow === undefined) {
    return json({ error: "Falha ao reservar numero da NFC-e", detail: numErr?.message }, 500);
  }
  const numero = Number(numRow);

  // 7. Insert pendente
  const nfceRecord = {
    order_id,
    numero,
    serie: Number(cfg.serie ?? 1),
    emitente: {
      razao_social: fiscal.razao_social,
      cnpj: fiscal.cnpj,
      ie: fiscal.ie,
    },
    consumidor: {
      cpf_cnpj: consumerCpf,
      nome: consumerName,
    },
    itens: itemsWithFiscal.map((i) => ({
      descricao: i.product_name + (i.variant_description ? ` - ${i.variant_description}` : ""),
      quantidade: i.quantity,
      valor_unitario: i.unit_price,
      valor_total: i.total_price,
    })),
    valor_total: Number((order as { total_amount: number }).total_amount ?? 0),
    valor_desconto: Number((order as { discount_amount: number }).discount_amount ?? 0),
    forma_pagamento: (order as { payment_method: string | null }).payment_method,
    status: "pendente",
    emitida_por: initiated_by ?? null,
  };

  const { data: nfce, error: insertErr } = await service
    .from("nfce_emitidas")
    .insert(nfceRecord)
    .select("id")
    .single();
  if (insertErr || !nfce) {
    return json({ error: "Falha ao registrar NFC-e", detail: insertErr?.message }, 500);
  }
  const nfce_id = nfce.id;

  // 8. Chamada do provider
  let providerResult: ProviderResponse;
  let dadosEnv: Record<string, unknown>;
  try {
    if (cfg.provider === "nuvem_fiscal") {
      dadosEnv = buildNfcePayload({
        cfg: cfg as Record<string, unknown>,
        fiscal: fiscal as Record<string, unknown>,
        consumer: { cpf_cnpj: consumerCpf, name: consumerName },
        order: order as Record<string, unknown>,
        items: itemsWithFiscal,
        numero,
      });
      providerResult = await callNuvemFiscal(cfg as Record<string, unknown>, dadosEnv);
    } else {
      dadosEnv = { numero, order_id, note: "provider generico" };
      providerResult = await callGenericProvider(cfg as Record<string, unknown>, dadosEnv);
    }
  } catch (e) {
    providerResult = {
      provider_nfce_id: "",
      chave_nfce: null,
      protocolo: null,
      link_danfe: null,
      link_xml: null,
      qrcode_url: null,
      xml_retorno: null,
      status: "pendente",
      error_message: e instanceof Error ? e.message : "Erro desconhecido",
    };
    dadosEnv = { numero, order_id, error: true };
  }

  // 9. Update nfce_emitidas
  const updatePayload: Record<string, unknown> = {
    status: providerResult.status,
    provider_nfce_id: providerResult.provider_nfce_id || null,
    chave_nfce: providerResult.chave_nfce,
    protocolo: providerResult.protocolo,
    link_danfe: providerResult.link_danfe,
    link_xml: providerResult.link_xml,
    qrcode_url: providerResult.qrcode_url,
    xml_retorno: providerResult.xml_retorno,
  };
  if (providerResult.status === "rejeitada" || providerResult.status === "denegada") {
    updatePayload.motivo_rejeicao = providerResult.error_message ?? null;
  }
  await service.from("nfce_emitidas").update(updatePayload).eq("id", nfce_id);

  // 10. Log
  await service.from("nfce_emission_log").insert({
    nfce_id,
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
    nfce_id,
    status: providerResult.status,
    numero,
    qrcode_url: providerResult.qrcode_url,
    link_danfe: providerResult.link_danfe,
    error: providerResult.error_message,
  });
});
