/**
 * nfse-cancel
 *
 * Cancela uma NFS-e autorizada. Dispatcher por provider:
 *   - nuvem_fiscal: POST /nfse/{id}/cancelamento (ou DELETE conforme doc)
 *   - outros: stub
 *
 * Body: { nfse_id: string, motivo?: string }
 * Auth: JWT (admin / super_admin).
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

  let body: { nfse_id?: string; motivo?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { nfse_id, motivo } = body;
  if (!nfse_id) return json({ error: "nfse_id obrigatorio" }, 400);

  // Config + NFS-e
  const { data: cfg } = await service
    .from("company_nfse_config")
    .select("provider, api_base_url, api_token_enc")
    .single();
  if (!cfg) return json({ error: "NFS-e nao configurado" }, 422);

  const { data: nfse, error: nfErr } = await service
    .from("nfse_emitidas")
    .select("id, provider_nfse_id, status, numero")
    .eq("id", nfse_id)
    .single();
  if (nfErr || !nfse) return json({ error: "NFS-e nao encontrada" }, 404);

  if (nfse.status !== "autorizada") {
    return json({ error: "Somente NFS-e autorizada pode ser cancelada", status_atual: nfse.status }, 422);
  }
  if (!nfse.provider_nfse_id) {
    return json({ error: "NFS-e sem provider_nfse_id" }, 422);
  }

  const baseUrl = (cfg.api_base_url as string | null) || "https://api.nuvemfiscal.com.br";
  const token = cfg.api_token_enc as string;

  let providerResponse: unknown = null;
  if (cfg.provider === "nuvem_fiscal") {
    const res = await fetch(`${baseUrl}/nfse/${nfse.provider_nfse_id}/cancelamento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        motivo: motivo ?? "Cancelamento solicitado pelo contribuinte",
      }),
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

  // Atualiza status local
  const { error: upErr } = await service
    .from("nfse_emitidas")
    .update({
      status: "cancelada",
      motivo_cancelamento: motivo ?? null,
      cancelada_em: new Date().toISOString(),
    })
    .eq("id", nfse_id);

  await service.from("nfse_emission_log").insert({
    nfse_id,
    tentativa: null,
    iniciado_por: "cancel",
    dados_env: { motivo },
    resposta: providerResponse as Record<string, unknown>,
    status: upErr ? "error" : "success",
  });

  await service.from("audit_logs").insert({
    action: "update",
    module: "nfse-emitidas",
    description: `Cancelamento da NFS-e nº ${nfse.numero}`,
    actor_id: userData.user.id,
  });

  return json({ ok: true, nfse_id, status: "cancelada" });
});
