/**
 * ai-event-dispatcher
 *
 * POST /ai-event-dispatcher
 * Auth: X-Trigger-Secret (pg_cron / Postgres trigger) OU JWT admin (uso manual).
 *
 * Body: {
 *   event_type: string,             // ex: 'diary_attendance.after_insert'
 *   row_id?: string | null,
 *   entity_type?: string,
 *   entity_id?: string,
 *   payload?: Record<string, unknown>,
 * }
 *
 * Fluxo:
 *   1. Valida secret/JWT.
 *   2. Busca bindings enabled em ai_event_bindings por event_type.
 *   3. Para cada binding: debounce via SELECT em ai_insights (context_hash).
 *   4. Invoca ai-orchestrator com agent_slug + context.
 *   5. Parse JSON da resposta; espera `{ should_alert: boolean, ... }`.
 *   6. UPSERT em ai_insights (dedup via UNIQUE INDEX on (agent_slug, context_hash) WHERE status='new').
 *   7. Se severity IN ('high','critical'), dispara push-send para a audience.
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

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Binding {
  agent_slug: string;
  debounce_hours: number;
  enabled: boolean;
}

interface OrchestratorResp {
  text?: string;
  error?: string;
}

interface AgentVerdict {
  should_alert?: boolean;
  severity?: "low" | "medium" | "high" | "critical";
  audience?: string[];
  recipient_id?: string | null;
  related_entity_type?: string;
  related_entity_id?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  actions?: unknown[];
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
  if (auth !== true && "ok" in auth === false) return auth as Response;

  let body: {
    event_type?: string;
    row_id?: string | null;
    entity_type?: string;
    entity_id?: string;
    payload?: Record<string, unknown>;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { event_type, entity_type, entity_id, payload = {} } = body;
  if (!event_type) return json({ error: "event_type obrigatorio" }, 400);

  const { data: bindings, error: bErr } = await service
    .from("ai_event_bindings")
    .select("agent_slug, debounce_hours, enabled")
    .eq("event_type", event_type)
    .eq("enabled", true);
  if (bErr) return json({ error: "Falha ao carregar bindings", detail: bErr.message }, 500);
  if (!bindings || bindings.length === 0) {
    return json({ ok: true, skipped: "no_bindings", event_type });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const binding of bindings as Binding[]) {
    const baseHash = await sha256Hex(
      JSON.stringify({ agent: binding.agent_slug, event: event_type, entity_type, entity_id }),
    );

    // debounce: pular se já existe insight 'new' OR recente dentro da janela
    const cutoff = new Date(Date.now() - binding.debounce_hours * 3600_000).toISOString();
    const { data: recent } = await service
      .from("ai_insights")
      .select("id, status, created_at")
      .eq("agent_slug", binding.agent_slug)
      .eq("context_hash", baseHash)
      .gte("created_at", cutoff)
      .limit(1);
    if (recent && recent.length > 0) {
      results.push({ agent_slug: binding.agent_slug, skipped: "debounced", insight_id: recent[0].id });
      continue;
    }

    // Invoca orchestrator
    const orchResp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-orchestrator`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          agent_slug: binding.agent_slug,
          context: { event_type, entity_type, entity_id, ...payload },
        }),
      },
    );
    const orch = (await orchResp.json().catch(() => ({}))) as OrchestratorResp;
    if (!orchResp.ok || orch.error || !orch.text) {
      results.push({ agent_slug: binding.agent_slug, error: orch.error ?? `HTTP ${orchResp.status}` });
      continue;
    }

    let verdict: AgentVerdict;
    try { verdict = JSON.parse(orch.text); } catch {
      results.push({ agent_slug: binding.agent_slug, error: "parse_error", raw: orch.text });
      continue;
    }
    if (!verdict.should_alert) {
      results.push({ agent_slug: binding.agent_slug, skipped: "no_alert" });
      continue;
    }

    const severity = verdict.severity ?? "medium";
    const audience = verdict.audience ?? [];
    const { data: insertedRow, error: insErr } = await service
      .from("ai_insights")
      .upsert(
        {
          agent_slug: binding.agent_slug,
          severity,
          status: "new",
          audience,
          recipient_id: verdict.recipient_id ?? null,
          related_module: (payload.module as string) ?? entity_type ?? "unknown",
          related_entity_type: verdict.related_entity_type ?? entity_type ?? null,
          related_entity_id: verdict.related_entity_id ?? entity_id ?? null,
          title: verdict.title ?? "Novo insight",
          summary: verdict.summary ?? "",
          payload: verdict.payload ?? {},
          actions: verdict.actions ?? [],
          context_hash: baseHash,
        },
        { onConflict: "agent_slug,context_hash", ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();

    if (insErr) {
      results.push({ agent_slug: binding.agent_slug, error: insErr.message });
      continue;
    }

    // Push para high/critical
    if (insertedRow && (severity === "high" || severity === "critical")) {
      const targetRecipient = insertedRow.recipient_id;
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/push-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          recipient_id: targetRecipient,
          audience: targetRecipient ? undefined : audience,
          title: insertedRow.title,
          body: insertedRow.summary,
          url: `/admin?insight=${insertedRow.id}`,
        }),
      }).catch(() => {});
    }

    results.push({
      agent_slug: binding.agent_slug,
      insight_id: insertedRow?.id ?? null,
      severity,
      inserted: !!insertedRow,
    });
  }

  return json({ ok: true, event_type, results });
});
