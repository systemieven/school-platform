/**
 * fiscal-provider-quotas
 *
 * Lista as cotas de uso da conta Nuvem Fiscal (GET /conta/cotas).
 * Resposta Nuvem Fiscal: { data: [{ nome, consumo, limite }] }
 *
 * Body: {}
 * Auth: JWT admin/super_admin.
 * Return: { ok: true, data: [...], fetched_at } | { ok: false, error, status? }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { nuvemFiscalFetch } from "../_shared/nuvemFiscal.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const caller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (!profile || !["admin", "super_admin"].includes((profile as { role?: string }).role ?? "")) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const res = await nuvemFiscalFetch(service, "/conta/cotas");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ ok: false, error: "Falha ao consultar cotas", detail: data, status: res.status }, 502);
    }
    const list = (data as { data?: Array<{ nome: string; consumo: number; limite: number }> }).data ?? [];
    return json({ ok: true, data: list, fetched_at: new Date().toISOString() });
  } catch (e) {
    return json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, 502);
  }
});
