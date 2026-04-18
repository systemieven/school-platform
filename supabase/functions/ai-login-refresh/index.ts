/**
 * ai-login-refresh
 *
 * POST /ai-login-refresh
 * Auth: JWT do usuário autenticado (chamado fire-and-forget pelo AdminAuthContext).
 *
 * Body: { user_id?: string, role?: string }  (ignorado — deriva do JWT)
 *
 * Fluxo:
 *   1. Valida JWT; carrega role do profile.
 *   2. Busca ai_agents WHERE run_on_login = true AND enabled = true
 *      E audience array contém o role (ou é vazio → todos).
 *   3. Chama ai-event-dispatcher com event_type = 'login_refresh'
 *      para cada agente (ou invoca o orchestrator direto quando o agente
 *      requer contexto do próprio usuário).
 *
 * Essa função é intencionalmente leve: não bloqueia o login. Se nada estiver
 * configurado, retorna 200 imediato.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
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

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(jwt);
  if (!userData?.user) return json({ error: "Unauthorized" }, 401);

  const userId = userData.user.id;
  const { data: profile } = await service
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return json({ error: "Profile not found" }, 404);

  const { data: agents, error: aErr } = await service
    .from("ai_agents")
    .select("slug, audience")
    .eq("run_on_login", true)
    .eq("enabled", true);
  if (aErr) return json({ error: "Falha ao carregar agentes", detail: aErr.message }, 500);
  if (!agents || agents.length === 0) return json({ ok: true, triggered: 0 });

  const matching = agents.filter(
    (a) => !a.audience || a.audience.length === 0 || a.audience.includes(profile.role),
  );

  const secret = await service
    .from("system_settings")
    .select("value")
    .eq("category", "internal")
    .eq("key", "trigger_secret")
    .maybeSingle();
  const triggerSecret = (typeof secret.data?.value === "string"
    ? secret.data.value
    : (secret.data?.value as string) || "");

  const dispatches = matching.map((agent) =>
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-event-dispatcher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trigger-secret": triggerSecret,
      },
      body: JSON.stringify({
        event_type: `login_refresh.${agent.slug}`,
        entity_type: "user",
        entity_id: userId,
        payload: { user_id: userId, role: profile.role },
      }),
    }).then((r) => r.json().catch(() => ({}))).catch((e) => ({ error: String(e) })),
  );

  const settled = await Promise.all(dispatches);
  return json({ ok: true, triggered: matching.length, results: settled });
});
