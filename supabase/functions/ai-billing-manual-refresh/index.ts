/**
 * ai-billing-manual-refresh
 *
 * POST /ai-billing-manual-refresh
 * Auth: JWT admin/super_admin.
 *
 * Body: { provider?: 'anthropic' | 'openai', date?: 'YYYY-MM-DD' }
 *
 * Dispara ai-billing-sync com force=true. Rate-limitado a 1 chamada por
 * 5 minutos: checa o `fetched_at` mais recente em `ai_usage_snapshots`
 * — se < 5 min atrás, responde 429 com `retry_after_seconds`.
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

const RATE_LIMIT_SECONDS = 300;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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

  const body = await req.json().catch(() => ({})) as {
    provider?: "anthropic" | "openai";
    date?: string;
  };

  const { data: lastSnap } = await service
    .from("ai_usage_snapshots")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSnap?.fetched_at) {
    const age = (Date.now() - new Date(lastSnap.fetched_at).getTime()) / 1000;
    if (age < RATE_LIMIT_SECONDS) {
      return json({
        error: "rate_limited",
        retry_after_seconds: Math.ceil(RATE_LIMIT_SECONDS - age),
      }, 429);
    }
  }

  const { data: secretRow } = await service
    .from("system_settings")
    .select("value")
    .eq("category", "internal")
    .eq("key", "trigger_secret")
    .single();
  const triggerSecret = typeof secretRow?.value === "string"
    ? secretRow.value
    : (secretRow?.value as string) || "";

  const syncRes = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-billing-sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trigger-secret": triggerSecret,
      },
      body: JSON.stringify({ ...body, force: true }),
    },
  );
  const data = await syncRes.json().catch(() => ({}));
  return json(data, syncRes.status);
});
