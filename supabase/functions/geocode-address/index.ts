/**
 * geocode-address
 *
 * Proxy autenticado para a Google Maps Geocoding API. Recebe os campos do
 * endereco institucional, monta a query e devolve lat/lng + formatted_address.
 * A chave GOOGLE_MAPS_API_KEY fica somente nos secrets do Supabase.
 *
 * Requer JWT de um usuario com role super_admin ou admin.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface AddressParts {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

function buildQuery(parts: AddressParts): string {
  const bits = [
    parts.rua && parts.numero ? `${parts.rua}, ${parts.numero}` : parts.rua,
    parts.bairro,
    parts.cidade,
    parts.estado,
    parts.cep,
    "Brasil",
  ].filter(Boolean);
  return bits.join(", ");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  // Verificar que o usuario e admin
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data: profile } = await supabaseService
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (!profile || !["super_admin", "admin"].includes(profile.role as string)) {
    return json({ error: "forbidden" }, 403);
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return json(
      {
        error: "api_key_missing",
        message:
          "GOOGLE_MAPS_API_KEY nao configurada nos secrets do Supabase. Adicione no dashboard.",
      },
      500,
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parts = (body.address_parts || body) as AddressParts;
    const query = buildQuery(parts);
    if (!query || query.length < 5) {
      return json({ error: "invalid_address" }, 400);
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&region=br`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return json(
        {
          error: "geocode_failed",
          google_status: data.status,
          message: data.error_message || "Endereco nao encontrado.",
        },
        404,
      );
    }

    const first = data.results[0];
    const loc = first.geometry.location;
    return json({
      lat: loc.lat,
      lng: loc.lng,
      formatted_address: first.formatted_address,
    });
  } catch (err) {
    return json({ error: "unexpected", message: (err as Error).message }, 500);
  }
});
