/**
 * nfce-cancel
 *
 * Cancela NFC-e autorizada. Dispatcher por provider.
 * Nuvem Fiscal: POST /nfce/{id}/cancelamento { motivo, justificativa }
 *
 * Body: { nfce_id: string, motivo?: string }
 * Auth: JWT admin/super_admin.
 *
 * NOTA: SEFAZ exige justificativa com 15–255 caracteres.
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

  let body: { nfce_id?: string; motivo?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { nfce_id, motivo } = body;
  if (!nfce_id) return json({ error: "nfce_id obrigatorio" }, 400);

  const justificativa = motivo ?? "Cancelamento solicitado pelo estabelecimento";
  if (justificativa.length < 15) {
    return json({ error: "Justificativa deve ter no minimo 15 caracteres" }, 400);
  }

  const { data: cfg } = await service
    .from("company_nfce_config")
    .select("provider, api_base_url, api_token_enc")
    .maybeSingle();
  if (!cfg) return json({ error: "NFC-e nao configurado" }, 422);

  const { data: nfce, error: nfErr } = await service
    .from("nfce_emitidas")
    .select("id, provider_nfce_id, status, numero, chave_nfce")
    .eq("id", nfce_id)
    .single();
  if (nfErr || !nfce) return json({ error: "NFC-e nao encontrada" }, 404);

  if (nfce.status !== "autorizada") {
    return json({ error: "Somente NFC-e autorizada pode ser cancelada", status_atual: nfce.status }, 422);
  }
  if (!nfce.provider_nfce_id) {
    return json({ error: "NFC-e sem provider_nfce_id" }, 422);
  }

  const baseUrl = (cfg.api_base_url as string | null) || "https://api.nuvemfiscal.com.br";
  const token = cfg.api_token_enc as string;

  let providerResponse: unknown = null;
  if (cfg.provider === "nuvem_fiscal") {
    const res = await fetch(`${baseUrl}/nfce/${nfce.provider_nfce_id}/cancelamento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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
  } else {
    return json({ error: `Cancelamento nao suportado para provider=${cfg.provider}` }, 422);
  }

  const { error: upErr } = await service
    .from("nfce_emitidas")
    .update({
      status: "cancelada",
      motivo_cancelamento: justificativa,
      cancelada_em: new Date().toISOString(),
      cancelada_por: userData.user.id,
    })
    .eq("id", nfce_id);

  await service.from("nfce_emission_log").insert({
    nfce_id,
    tentativa: null,
    iniciado_por: userData.user.id,
    dados_env: { justificativa },
    resposta: providerResponse as Record<string, unknown>,
    status: upErr ? "error" : "success",
  });

  await service.from("audit_logs").insert({
    action: "update",
    module: "nfce-emitidas",
    description: `Cancelamento da NFC-e n. ${nfce.numero}`,
    actor_id: userData.user.id,
  });

  return json({ ok: true, nfce_id, status: "cancelada" });
});
