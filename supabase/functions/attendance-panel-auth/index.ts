/**
 * attendance-panel-auth
 *
 * Valida a senha de acesso ao painel público de chamadas (/painel-atendimento).
 * Em caso de sucesso devolve a configuração completa do painel (sem a senha)
 * mais o nome da escola e os setores cadastrados — tudo num único round-trip.
 *
 * Chamado sem JWT pela página pública. Usa SERVICE_ROLE_KEY internamente.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { rateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * Alguns settings podem estar double-stringified (JSON dentro de JSONB).
 */
function normalizeSettingValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Rate limit: 5 auth attempts per minute per IP (brute force protection)
  const rl = rateLimit(req, { maxRequests: 5, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl, CORS);

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (!password) return json({ error: "password_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Buscar configurações necessárias: display_panel, general.school_name, visit.reasons
  const { data: settings, error } = await supabase
    .from("system_settings")
    .select("category, key, value")
    .in("category", ["attendance", "general", "visit"]);

  if (error) return json({ error: error.message }, 500);

  const map: Record<string, Record<string, unknown>> = {};
  for (const row of settings || []) {
    const r = row as { category: string; key: string; value: unknown };
    if (!map[r.category]) map[r.category] = {};
    map[r.category][r.key] = normalizeSettingValue(r.value);
  }

  const panelConfig = (map.attendance?.display_panel ?? null) as Record<
    string,
    unknown
  > | null;

  if (!panelConfig || !panelConfig.password) {
    return json({ error: "panel_not_configured" }, 404);
  }

  if (password !== panelConfig.password) {
    return json({ authorized: false }, 401);
  }

  // Normaliza school_name (pode ser string ou { value: string })
  const rawSchoolName = map.general?.school_name;
  let schoolName: string | null = null;
  if (typeof rawSchoolName === "string") {
    schoolName = rawSchoolName;
  } else if (rawSchoolName && typeof rawSchoolName === "object") {
    const asObj = rawSchoolName as { value?: unknown };
    if (typeof asObj.value === "string") schoolName = asObj.value;
  }

  interface Sector {
    key: string;
    label: string;
  }
  const sectors: Sector[] = Array.isArray(map.visit?.reasons)
    ? (map.visit.reasons as Sector[]).map((s) => ({
        key: s.key,
        label: s.label,
      }))
    : [];

  // Devolver config sem a senha
  const { password: _pwd, ...safeConfig } = panelConfig;
  void _pwd;

  return json({
    authorized: true,
    config: safeConfig,
    school_name: schoolName,
    sectors,
  });
});
