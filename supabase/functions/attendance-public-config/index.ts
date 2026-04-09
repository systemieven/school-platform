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
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
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
    map[r.category][r.key] = r.value;
  }

  // Filtrar apenas chaves publicas seguras
  const result = {
    client_screen_fields: map.attendance?.client_screen_fields ?? null,
    ticket_format: map.attendance?.ticket_format ?? null,
    sound: map.attendance?.sound ?? null,
    estimated_service_time: map.attendance?.estimated_service_time ?? null,
    allow_walkins: map.attendance?.allow_walkins ?? { enabled: false },
    feedback: map.attendance?.feedback ?? null,
    geolocation: map.general?.geolocation ?? null,
    sectors: map.visit?.reasons ?? [],
  };

  return json(result);
});
