/**
 * attendance-public-config
 *
 * Devolve as configuracoes minimas que a pagina publica /atendimento
 * precisa para renderizar a tela do cliente e tocar o som. Mantem a RLS
 * restrita: a categoria 'attendance' nao e exposta diretamente.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * Alguns settings foram gravados pelo admin UI como JSON.stringify em cima
 * de um JSONB — ou seja, a coluna guarda uma string contendo JSON valido
 * (ex: visit.reasons, general.geolocation). Quando for string tentamos
 * desserializar; caso contrario devolvemos o valor como veio.
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

interface VisitReason {
  key: string;
  label: string;
  icon?: string;
  duration_minutes?: number;
}

/**
 * Deriva o tempo estimado de atendimento por setor. Preferencia:
 *   1. media real do dia (attendance_tickets.service_seconds dos finalizados);
 *   2. duration_minutes configurado no motivo da visita;
 *   3. 30 minutos como ultimo recurso.
 *
 * Sempre arredondamos para cima para o proximo minuto — preferimos
 * superestimar a espera do que subestimar e frustrar o cliente.
 */
async function computeEstimatedServiceTime(
  supabase: ReturnType<typeof createClient>,
  reasons: VisitReason[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  // Base: duration_minutes cadastrado em visit.reasons.
  for (const r of reasons) {
    if (r?.key) {
      result[r.key] = Math.max(1, Math.round(r.duration_minutes || 30));
    }
  }

  // Override com media real dos atendimentos finalizados de hoje.
  // Filtramos por issued_at::date = today no lado do cliente porque
  // PostgREST nao suporta cast .::date diretamente; usamos gte/lte com
  // o range do dia atual em UTC (o trigger grava em now() UTC).
  const now = new Date();
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0,
  )).toISOString();
  const todayEnd = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59,
  )).toISOString();

  const { data: todayTickets, error: ticketsErr } = await supabase
    .from("attendance_tickets")
    .select("sector_key, service_seconds")
    .eq("status", "finished")
    .not("service_seconds", "is", null)
    .gte("issued_at", todayStart)
    .lte("issued_at", todayEnd);

  if (ticketsErr) {
    console.error("[attendance-public-config] tickets avg error", ticketsErr);
    return result; // cai para o fallback de duration_minutes
  }

  // Agrega em JS: { sector_key: { total, count } }
  const buckets: Record<string, { total: number; count: number }> = {};
  for (const row of (todayTickets || []) as Array<{ sector_key: string; service_seconds: number }>) {
    if (!row.sector_key || typeof row.service_seconds !== "number") continue;
    if (!buckets[row.sector_key]) buckets[row.sector_key] = { total: 0, count: 0 };
    buckets[row.sector_key].total += row.service_seconds;
    buckets[row.sector_key].count += 1;
  }

  // Exige amostra minima de 2 atendimentos para confiar na media do dia
  // (evita que um unico outlier desconfigure a estimativa).
  for (const [sectorKey, stat] of Object.entries(buckets)) {
    if (stat.count >= 2) {
      const avgMinutes = Math.max(1, Math.ceil(stat.total / stat.count / 60));
      result[sectorKey] = avgMinutes;
    }
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

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

  // Normaliza school_name: pode estar salvo como string direta ou objeto { value }
  // (padrao do SettingsCard). A pagina publica consome sempre string.
  const rawSchoolName = map.general?.school_name;
  let schoolName: string | null = null;
  if (typeof rawSchoolName === "string") {
    schoolName = rawSchoolName;
  } else if (rawSchoolName && typeof rawSchoolName === "object") {
    const asObj = rawSchoolName as { value?: unknown };
    if (typeof asObj.value === "string") schoolName = asObj.value;
  }

  const sectors: VisitReason[] = Array.isArray(map.visit?.reasons)
    ? (map.visit?.reasons as VisitReason[])
    : [];

  const estimatedServiceTime = await computeEstimatedServiceTime(supabase, sectors);

  // Filtrar apenas chaves publicas seguras
  const result = {
    school_name: schoolName,
    client_screen_fields: map.attendance?.client_screen_fields ?? null,
    ticket_format: map.attendance?.ticket_format ?? null,
    sound: map.attendance?.sound ?? null,
    estimated_service_time: estimatedServiceTime,
    allow_walkins: map.attendance?.allow_walkins ?? { enabled: false },
    feedback: map.attendance?.feedback ?? null,
    geolocation: map.general?.geolocation ?? null,
    sectors,
  };

  return json(result);
});
