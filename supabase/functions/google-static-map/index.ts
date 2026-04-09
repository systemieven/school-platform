/**
 * google-static-map
 *
 * Proxy autenticado para a Google Static Maps API. Recebe { lat, lng, radius_m }
 * e devolve um PNG com marcador + circulo do raio. Mantem a GOOGLE_MAPS_API_KEY
 * exclusivamente nos secrets do Supabase: o client nunca ve a chave porque a
 * funcao busca o PNG no Google e retransmite os bytes.
 *
 * Requer JWT de um usuario com role super_admin ou admin.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonError(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Aproxima um circulo geografico por um poligono de 36 vertices. */
function circlePolyline(lat: number, lng: number, radiusM: number): string {
  const earthRadius = 6378137;
  const lat0 = (lat * Math.PI) / 180;
  const points: string[] = [];
  for (let i = 0; i <= 36; i++) {
    const angle = (i * 10 * Math.PI) / 180;
    const dx = (radiusM * Math.cos(angle)) / (earthRadius * Math.cos(lat0));
    const dy = (radiusM * Math.sin(angle)) / earthRadius;
    const plat = lat + (dy * 180) / Math.PI;
    const plng = lng + (dx * 180) / Math.PI;
    points.push(`${plat.toFixed(6)},${plng.toFixed(6)}`);
  }
  return points.join("|");
}

function zoomFromRadius(radiusM: number): number {
  if (radiusM <= 80) return 18;
  if (radiusM <= 160) return 17;
  if (radiusM <= 320) return 16;
  if (radiusM <= 640) return 15;
  return 14;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonError({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError({ error: "unauthorized", reason: "missing_bearer" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: userData, error: userErr } = await supabaseService.auth.getUser(token);
  if (userErr || !userData.user) {
    return jsonError(
      { error: "unauthorized", reason: "invalid_token", details: userErr?.message ?? null },
      401,
    );
  }

  const { data: profile, error: profileErr } = await supabaseService
    .from("profiles")
    .select("role, is_active")
    .eq("id", userData.user.id)
    .single();
  if (profileErr) {
    return jsonError(
      { error: "forbidden", reason: "profile_lookup_failed", details: profileErr.message },
      403,
    );
  }
  if (!profile || !["super_admin", "admin"].includes(profile.role as string)) {
    return jsonError(
      { error: "forbidden", reason: "role_not_admin", role: profile?.role ?? null },
      403,
    );
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return jsonError(
      {
        error: "api_key_missing",
        message: "GOOGLE_MAPS_API_KEY nao configurada nos secrets do Supabase.",
      },
      500,
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const radius = Number.isFinite(Number(body.radius_m)) ? Number(body.radius_m) : 150;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return jsonError({ error: "invalid_coordinates" }, 400);
    }

    // O client pode mandar um zoom explicito (botoes +/-) ou deixar auto.
    // Limites do Google Static Maps: 0-21. Mantemos um range util 10-21.
    const rawZoom = Number(body.zoom);
    const zoom = Number.isFinite(rawZoom)
      ? Math.max(10, Math.min(21, Math.round(rawZoom)))
      : zoomFromRadius(radius);
    const polyline = circlePolyline(lat, lng, radius);
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: String(zoom),
      size: "640x320",
      scale: "2",
      maptype: "roadmap",
      markers: `color:red|${lat},${lng}`,
      key: apiKey,
    });
    // path precisa ser anexado fora do URLSearchParams porque tem caracteres
    // como `|` e `:` que o URLSearchParams encoda de forma indesejada para o
    // parser do Google.
    const mapUrl =
      `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}` +
      `&path=color:0x003876ff%7Cweight:2%7Cfillcolor:0x00387633%7C${encodeURIComponent(polyline)}`;

    const res = await fetch(mapUrl);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return jsonError(
        { error: "google_static_map_failed", status: res.status, message: txt },
        502,
      );
    }
    const buf = await res.arrayBuffer();
    // IMPORTANTE: usamos application/octet-stream (e nao image/png) porque o
    // supabase.functions.invoke() do supabase-js so trata octet-stream como
    // Blob no parsing. Se devolvermos image/png ele cai no fallback de
    // text() e corrompe os bytes. O client re-wrappa em image/png antes de
    // gerar o blob URL.
    return new Response(buf, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return jsonError({ error: "unexpected", message: (err as Error).message }, 500);
  }
});
