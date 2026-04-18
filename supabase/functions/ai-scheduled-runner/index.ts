/**
 * ai-scheduled-runner
 *
 * POST /ai-scheduled-runner
 * Auth: X-Trigger-Secret (pg_cron) OU JWT admin (chamada manual).
 *
 * Body (opcional): { cadence?: 'daily' | 'weekly' | 'period_close', run_agent?: string }
 *
 * Fluxo:
 *   1. Valida secret/JWT.
 *   2. Busca ai_agents WHERE run_on_cron IS NOT NULL AND enabled = true.
 *      - filtra pela cadence recebida (run_on_cron = cadence).
 *      - ou roda apenas `run_agent` quando fornecido.
 *   3. Para cada agente: chama ai-event-dispatcher com event_type='cron.<slug>'.
 *
 * Os agentes registrados com run_on_cron fazem seu próprio fan-out
 * (ex: student_weekly_summary itera alunos dentro do prompt/RPC e o dispatcher
 * cria um insight por destinatário via recipient_id).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-trigger-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function authOrBail(req: Request, service: any): Promise<{ ok: true } | Response> {
  const incoming = req.headers.get("x-trigger-secret") || "";
  if (incoming) {
    const { data } = await service
      .from("system_settings")
      .select("value")
      .eq("category", "internal")
      .eq("key", "trigger_secret")
      .single();
    const stored = typeof data?.value === "string" ? data.value : (data?.value as string) || "";
    if (stored && incoming === stored) return { ok: true };
    return json({ error: "Invalid trigger secret" }, 401);
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(jwt);
  if (!userData?.user) return json({ error: "Unauthorized" }, 401);
  const { data: profile } = await service
    .from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return json({ error: "Forbidden" }, 403);
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = await authOrBail(req, service);
  if (auth instanceof Response) return auth;

  let body: { cadence?: string; run_agent?: string } = {};
  try { body = await req.json(); } catch { /* body opcional */ }
  const { cadence, run_agent } = body;

  let query = service
    .from("ai_agents")
    .select("slug, run_on_cron, audience")
    .eq("enabled", true)
    .not("run_on_cron", "is", null);
  if (cadence) query = query.eq("run_on_cron", cadence);
  if (run_agent) query = query.eq("slug", run_agent);

  const { data: agents, error: aErr } = await query;
  if (aErr) return json({ error: "Falha ao carregar agentes", detail: aErr.message }, 500);
  if (!agents || agents.length === 0) {
    return json({ ok: true, cadence, triggered: 0 });
  }

  const { data: secretRow } = await service
    .from("system_settings")
    .select("value")
    .eq("category", "internal")
    .eq("key", "trigger_secret")
    .maybeSingle();
  const triggerSecret = (typeof secretRow?.value === "string"
    ? secretRow.value
    : (secretRow?.value as string) || "");

  const results = await Promise.all(agents.map(async (agent) => {
    const resp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-event-dispatcher`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-trigger-secret": triggerSecret,
        },
        body: JSON.stringify({
          event_type: `cron.${agent.slug}`,
          payload: { cadence: agent.run_on_cron },
        }),
      },
    );
    return { agent: agent.slug, status: resp.status, body: await resp.json().catch(() => ({})) };
  }));

  return json({ ok: true, cadence, triggered: agents.length, results });
});
