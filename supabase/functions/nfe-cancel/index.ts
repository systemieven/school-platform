/**
 * nfe-cancel
 *
 * Cancela NF-e autorizada. Dispatcher por provider.
 * Nuvem Fiscal: POST /nfe/{id}/cancelamento { justificativa }
 *
 * Body: { nfe_id: string, motivo?: string }
 * Auth: JWT admin/super_admin.
 *
 * NOTA: SEFAZ exige justificativa com 15–255 caracteres.
 * Janela de cancelamento da NF-e modelo 55: 24 horas apos autorizacao.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const caller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (!profile || !["admin", "super_admin"].includes((profile as { role?: string }).role ?? "")) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: { nfe_id?: string; motivo?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { nfe_id, motivo } = body;
  if (!nfe_id) return json({ error: "nfe_id obrigatorio" }, 400);

  const justificativa = motivo ?? "Cancelamento solicitado pelo estabelecimento";
  if (justificativa.length < 15 || justificativa.length > 255) {
    return json({ error: "Justificativa deve ter entre 15 e 255 caracteres" }, 400);
  }

  const { data: cfg } = await service
    .from("company_nfe_config")
    .select("provider")
    .maybeSingle();
  if (!cfg) return json({ error: "NF-e nao configurada" }, 422);

  const { data: nfe, error: nfErr } = await service
    .from("nfe_emitidas")
    .select("id, provider_nfe_id, status, numero, chave_nfe, autorizada_em")
    .eq("id", nfe_id)
    .single();
  if (nfErr || !nfe) return json({ error: "NF-e nao encontrada" }, 404);

  if (nfe.status !== "autorizada") {
    return json({ error: "Somente NF-e autorizada pode ser cancelada", status_atual: nfe.status }, 422);
  }
  if (!nfe.provider_nfe_id) {
    return json({ error: "NF-e sem provider_nfe_id" }, 422);
  }

  // Janela SEFAZ de 24h para NF-e modelo 55
  if (nfe.autorizada_em) {
    const autorizada = new Date(nfe.autorizada_em as string).getTime();
    const limite = autorizada + 24 * 60 * 60 * 1000;
    if (Date.now() > limite) {
      return json({
        error: "Prazo de cancelamento SEFAZ expirado (24h apos autorizacao)",
        autorizada_em: nfe.autorizada_em,
      }, 422);
    }
  }

  let providerResponse: unknown = null;
  if (cfg.provider === "nuvem_fiscal") {
    try {
      const res = await nuvemFiscalFetch(service, `/nfe/${nfe.provider_nfe_id}/cancelamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justificativa }),
      });
      providerResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        return json({
          error: "Falha ao cancelar na Nuvem Fiscal",
          detail: providerResponse,
          status: res.status,
        }, 502);
      }
    } catch (e) {
      return json({
        error: "Falha ao autenticar na Nuvem Fiscal",
        detail: e instanceof Error ? e.message : String(e),
      }, 502);
    }
  } else {
    return json({ error: `Cancelamento nao suportado para provider=${cfg.provider}` }, 422);
  }

  const { error: upErr } = await service
    .from("nfe_emitidas")
    .update({
      status: "cancelada",
      motivo_cancelamento: justificativa,
      cancelada_em: new Date().toISOString(),
      cancelada_por: userData.user.id,
    })
    .eq("id", nfe_id);

  await service.from("nfe_emission_log").insert({
    nfe_id,
    tentativa: 1,
    iniciado_por: userData.user.id,
    dados_env: { justificativa },
    resposta: providerResponse as Record<string, unknown>,
    status: upErr ? "error" : "success",
  });

  await service.from("audit_logs").insert({
    action: "update",
    module: "fiscal",
    description: `Cancelamento da NF-e n. ${nfe.numero}`,
    actor_id: userData.user.id,
  });

  return json({ ok: true, nfe_id, status: "cancelada" });
});
