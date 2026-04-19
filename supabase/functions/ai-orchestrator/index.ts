/**
 * ai-orchestrator
 *
 * POST /ai-orchestrator
 * Auth: JWT (qualquer usuario autenticado).
 *
 * Body: { agent_slug: string, context?: Record<string, unknown>, dry_run?: boolean }
 *
 * 1. Carrega ai_agents por slug (deve existir e enabled=true)
 * 2. Renderiza user_prompt_template com context via {{var}} substitution
 * 3. Dispatcha para ai-worker-anthropic ou ai-worker-openai
 * 4. Loga em ai_usage_log (tokens, latencia, status)
 * 5. Retorna { text, input_tokens, output_tokens, latency_ms, agent_slug }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // supabase-js client envia apikey + x-client-info além de content-type/authorization;
  // sem isso na allow-list o preflight passa (OPTIONS 200) mas o browser bloqueia o POST
  // e o invoke() devolve "Failed to send a request to the Edge Function".
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function renderTemplate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, key) => {
    const v = ctx[key];
    if (v == null) return "";
    if (typeof v === "string") return v;
    try { return JSON.stringify(v); } catch { return String(v); }
  });
}

async function hashContext(ctx: unknown): Promise<string> {
  const enc = new TextEncoder().encode(JSON.stringify(ctx ?? {}));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Agent {
  slug: string;
  provider: "anthropic" | "openai";
  model: string;
  system_prompt: string;
  user_prompt_template: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Função é `verify_jwt=false` no platform; aceitamos qualquer bearer presente.
  // Chamadas internas (careers-interview-turn, ai-event-dispatcher, ai-scheduled-runner)
  // passam service-role; chamadas do admin passam user JWT. Em ambos os casos
  // registramos a identidade (best-effort) em `ai_usage_log.caller_user_id`.
  // Uso é logado + rate limit upstream por caller.
  let callerUserId: string | null = null;
  try {
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await caller.auth.getUser();
    callerUserId = userData?.user?.id ?? null;
  } catch {
    callerUserId = null;
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  let body: { agent_slug?: string; context?: Record<string, unknown>; dry_run?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { agent_slug, context = {}, dry_run } = body;
  if (!agent_slug) return json({ error: "agent_slug obrigatorio" }, 400);

  const { data: agentRow, error: agentErr } = await service
    .from("ai_agents")
    .select("slug, provider, model, system_prompt, user_prompt_template, temperature, max_tokens, enabled")
    .eq("slug", agent_slug)
    .maybeSingle();

  if (agentErr || !agentRow) return json({ error: "Agente nao encontrado" }, 404);
  const agent = agentRow as Agent;
  if (!agent.enabled) return json({ error: "Agente desabilitado" }, 422);

  const { data: cfgRow } = await service
    .from("company_ai_config")
    .select("anthropic_api_key, openai_api_key")
    .limit(1)
    .maybeSingle();
  const apiKey = agent.provider === "anthropic"
    ? cfgRow?.anthropic_api_key
    : cfgRow?.openai_api_key;
  if (!apiKey) {
    return json({
      error: `Chave de API (${agent.provider}) nao configurada. Acesse /admin/configuracoes?tab=ia para cadastrar.`,
    }, 422);
  }

  const user = renderTemplate(agent.user_prompt_template, context);
  const ctxHash = await hashContext(context);

  if (dry_run) {
    return json({
      agent_slug: agent.slug,
      provider: agent.provider,
      model: agent.model,
      system: agent.system_prompt,
      user,
      dry_run: true,
    });
  }

  const workerName = agent.provider === "anthropic" ? "ai-worker-anthropic" : "ai-worker-openai";
  const start = Date.now();
  let workerResp: Response;
  try {
    workerResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${workerName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        model: agent.model,
        system: agent.system_prompt,
        user,
        temperature: Number(agent.temperature),
        max_tokens: agent.max_tokens,
        api_key: apiKey,
      }),
    });
  } catch (e) {
    const msg = (e as Error).message;
    await service.from("ai_usage_log").insert({
      agent_slug: agent.slug, provider: agent.provider, model: agent.model,
      caller_user_id: callerUserId, latency_ms: Date.now() - start,
      status: "error", error_message: msg, context_hash: ctxHash,
    });
    return json({ error: "Falha ao chamar worker", detail: msg }, 502);
  }

  const latency = Date.now() - start;
  const workerBody = await workerResp.json().catch(() => ({}));
  const ok = workerResp.ok && !workerBody?.error;

  await service.from("ai_usage_log").insert({
    agent_slug: agent.slug,
    provider: agent.provider,
    model: agent.model,
    caller_user_id: callerUserId,
    input_tokens: workerBody?.input_tokens ?? null,
    output_tokens: workerBody?.output_tokens ?? null,
    latency_ms: latency,
    status: ok ? "ok" : "error",
    error_message: ok ? null : (workerBody?.error ?? `HTTP ${workerResp.status}`),
    context_hash: ctxHash,
  });

  if (!ok) {
    return json({
      error: workerBody?.error ?? "Worker retornou erro",
      status: workerResp.status,
      detail: workerBody,
    }, 502);
  }

  return json({
    text: workerBody.text ?? "",
    input_tokens: workerBody.input_tokens ?? null,
    output_tokens: workerBody.output_tokens ?? null,
    latency_ms: latency,
    agent_slug: agent.slug,
    provider: agent.provider,
    model: agent.model,
  });
});
