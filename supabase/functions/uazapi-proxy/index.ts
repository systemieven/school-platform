import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Auth verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["super_admin", "admin", "coordinator"].includes(profile.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Load WhatsApp API credentials (service role)
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await service
      .from("system_settings")
      .select("key, value")
      .eq("category", "whatsapp")
      .in("key", ["instance_url", "api_token"]);

    const map: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: unknown }) => {
      map[s.key] = typeof s.value === "string" ? s.value : String(s.value);
    });

    const instanceUrl = map["instance_url"]?.trim();
    const apiToken   = map["api_token"]?.trim();

    if (!instanceUrl || !apiToken) {
      return json({ error: "WhatsApp API not configured. Set instance_url and api_token in Configurações → WhatsApp." }, 400);
    }

    // Parse request
    const body = await req.json().catch(() => ({})) as {
      path: string;
      method?: string;
      payload?: unknown;
    };

    const { path, method = "GET", payload } = body;
    if (!path) return json({ error: "Missing field: path" }, 400);

    // Forward to WhatsApp API
    const base   = instanceUrl.replace(/\/$/, "");
    const target = `${base}${path}`;

    const apiRes = await fetch(target, {
      method,
      headers: {
        "Content-Type": "application/json",
        "token": apiToken,
      },
      body: method !== "GET" && payload !== undefined
        ? JSON.stringify(payload)
        : undefined,
    });

    const resData = await apiRes.json().catch(() => ({ _status: apiRes.status }));

    return json(resData, apiRes.status);
  } catch (err) {
    console.error("[whatsapp-proxy]", err);
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
