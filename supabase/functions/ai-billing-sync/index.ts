/**
 * ai-billing-sync
 *
 * POST /ai-billing-sync
 * Auth: X-Trigger-Secret (pg_cron) OU JWT admin/super_admin (chamada manual).
 *
 * Body (opcional):
 *   {
 *     provider?: 'anthropic' | 'openai',   // default: ambos
 *     date?: 'YYYY-MM-DD',                 // default: hoje UTC (snapshot do dia)
 *     force?: boolean                      // refaz mesmo se já existe
 *   }
 *
 * Fluxo por provider:
 *   1. Carrega admin key de company_ai_config.
 *   2. Consulta API oficial do provider para o dia solicitado.
 *       - Anthropic: /v1/organizations/usage_report/messages + /cost_report
 *         (filtrado por `workspace_ids[]` se company_ai_config.anthropic_workspace_id)
 *       - OpenAI:    /v1/organization/usage/completions + /organization/costs
 *   3. Calcula tokens_input/output, requests_count, total_spent_usd.
 *   4. UPSERT em ai_usage_snapshots por (provider, snapshot_date).
 *
 * Saldo/créditos restantes NÃO são expostos pelas Admin APIs dos providers
 * (tanto Anthropic quanto OpenAI só retornam usage + cost). Por isso esta
 * função registra apenas gasto real — saldo deve ser consultado no console.
 *
 * Retorna:
 *   { results: [{ provider, status: 'ok'|'error'|'skipped', snapshot?, error? }] }
 *
 * Dependências: company_ai_config.anthropic_admin_api_key / openai_admin_api_key
 * (+ openai_organization_id). Sem elas, o provider é pulado com status='skipped'.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function todayUtcISO(): string {
  return new Date().toISOString().split("T")[0];
}

interface SnapshotRow {
  provider: "anthropic" | "openai";
  snapshot_date: string;
  total_spent_usd: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  requests_count: number | null;
  raw_payload: unknown;
}

async function fetchAnthropic(
  adminKey: string,
  date: string,
  workspaceId: string | null,
): Promise<Omit<SnapshotRow, "provider" | "snapshot_date">> {
  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59Z`;
  const wsQs = workspaceId ? `&workspace_ids[]=${encodeURIComponent(workspaceId)}` : "";

  const [usageRes, costRes] = await Promise.all([
    fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(start)}&ending_at=${encodeURIComponent(end)}${wsQs}`,
      { headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" } },
    ),
    fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${encodeURIComponent(start)}&ending_at=${encodeURIComponent(end)}${wsQs}`,
      { headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" } },
    ),
  ]);

  const usage = usageRes.ok ? await usageRes.json() : { error: await usageRes.text() };
  const cost  = costRes.ok  ? await costRes.json()  : { error: await costRes.text() };

  let tokens_input = 0;
  let tokens_output = 0;
  let requests_count = 0;
  const buckets = (usage as { data?: Array<{ results?: Array<Record<string, number>> }> }).data ?? [];
  for (const b of buckets) {
    for (const r of b.results ?? []) {
      tokens_input  += Number(r.input_tokens  ?? r.uncached_input_tokens ?? 0);
      tokens_output += Number(r.output_tokens ?? 0);
      requests_count += Number(r.request_count ?? 0);
    }
  }

  let total_spent_usd = 0;
  const costBuckets = (cost as { data?: Array<{ results?: Array<{ amount?: { value?: number } }> }> }).data ?? [];
  for (const b of costBuckets) {
    for (const r of b.results ?? []) {
      total_spent_usd += Number(r.amount?.value ?? 0);
    }
  }

  return {
    total_spent_usd,
    tokens_input,
    tokens_output,
    requests_count,
    raw_payload: { usage, cost },
  };
}

async function fetchOpenAI(
  adminKey: string,
  orgId: string | null,
  date: string,
): Promise<Omit<SnapshotRow, "provider" | "snapshot_date">> {
  const startTs = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  const endTs   = Math.floor(Date.parse(`${date}T23:59:59Z`) / 1000);
  const headers: Record<string, string> = { Authorization: `Bearer ${adminKey}` };
  if (orgId) headers["OpenAI-Organization"] = orgId;

  const [usageRes, costRes] = await Promise.all([
    fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startTs}&end_time=${endTs}&bucket_width=1d`,
      { headers },
    ),
    fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${startTs}&end_time=${endTs}&bucket_width=1d`,
      { headers },
    ),
  ]);

  const usage = usageRes.ok ? await usageRes.json() : { error: await usageRes.text() };
  const cost  = costRes.ok  ? await costRes.json()  : { error: await costRes.text() };

  let tokens_input = 0;
  let tokens_output = 0;
  let requests_count = 0;
  const buckets = (usage as { data?: Array<{ results?: Array<Record<string, number>> }> }).data ?? [];
  for (const b of buckets) {
    for (const r of b.results ?? []) {
      tokens_input   += Number(r.input_tokens  ?? 0);
      tokens_output  += Number(r.output_tokens ?? 0);
      requests_count += Number(r.num_model_requests ?? 0);
    }
  }

  let total_spent_usd = 0;
  const costBuckets = (cost as { data?: Array<{ results?: Array<{ amount?: { value?: number } }> }> }).data ?? [];
  for (const b of costBuckets) {
    for (const r of b.results ?? []) {
      total_spent_usd += Number(r.amount?.value ?? 0);
    }
  }

  return {
    total_spent_usd,
    tokens_input,
    tokens_output,
    requests_count,
    raw_payload: { usage, cost },
  };
}

// deno-lint-ignore no-explicit-any
async function authOrBail(req: Request, service: any): Promise<{ ok: true } | Response> {
  // 1. trigger secret (cron)
  const incomingSecret = req.headers.get("x-trigger-secret") || "";
  if (incomingSecret) {
    const { data: secretRow } = await service
      .from("system_settings")
      .select("value")
      .eq("category", "internal")
      .eq("key", "trigger_secret")
      .single();
    const stored = typeof secretRow?.value === "string" ? secretRow.value : (secretRow?.value as string) || "";
    if (stored && incomingSecret === stored) return { ok: true };
    return json({ error: "Invalid trigger secret" }, 401);
  }
  // 2. admin JWT
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

  const authResult = await authOrBail(req, service);
  if (authResult instanceof Response) return authResult;

  const body = await req.json().catch(() => ({})) as {
    provider?: "anthropic" | "openai";
    date?: string;
    force?: boolean;
  };
  const date = body.date ?? todayUtcISO();
  const providers: Array<"anthropic" | "openai"> = body.provider
    ? [body.provider]
    : ["anthropic", "openai"];

  const { data: cfgRow } = await service
    .from("company_ai_config")
    .select("anthropic_admin_api_key, openai_admin_api_key, openai_organization_id, anthropic_workspace_id")
    .limit(1)
    .maybeSingle();

  const results: Array<Record<string, unknown>> = [];

  for (const provider of providers) {
    try {
      if (!body.force) {
        const { data: existing } = await service
          .from("ai_usage_snapshots")
          .select("id")
          .eq("provider", provider)
          .eq("snapshot_date", date)
          .maybeSingle();
        if (existing) {
          results.push({ provider, status: "skipped", reason: "already_synced" });
          continue;
        }
      }

      let payload: Omit<SnapshotRow, "provider" | "snapshot_date"> | null = null;

      if (provider === "anthropic") {
        const key = cfgRow?.anthropic_admin_api_key;
        if (!key) { results.push({ provider, status: "skipped", reason: "no_admin_key" }); continue; }
        const ws = cfgRow?.anthropic_workspace_id ?? null;
        payload = await fetchAnthropic(key, date, ws);
      } else {
        const key = cfgRow?.openai_admin_api_key;
        const org = cfgRow?.openai_organization_id ?? null;
        if (!key) { results.push({ provider, status: "skipped", reason: "no_admin_key" }); continue; }
        payload = await fetchOpenAI(key, org, date);
      }

      const row: SnapshotRow = { provider, snapshot_date: date, ...payload };

      const { error: upsertErr } = await service
        .from("ai_usage_snapshots")
        .upsert(row, { onConflict: "provider,snapshot_date" });
      if (upsertErr) throw upsertErr;

      results.push({
        provider,
        status: "ok",
        snapshot_date: date,
        tokens_input: row.tokens_input,
        tokens_output: row.tokens_output,
        requests_count: row.requests_count,
        total_spent_usd: row.total_spent_usd,
      });
    } catch (e) {
      console.error(`[ai-billing-sync] ${provider} failed`, e);
      results.push({
        provider,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({ results, date });
});
