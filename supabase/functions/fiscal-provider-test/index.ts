/**
 * fiscal-provider-test
 *
 * Testa a conexão OAuth2 com a Nuvem Fiscal fazendo um token exchange a
 * partir das credenciais salvas em `fiscal_provider_credentials`.
 *
 * Body: {}
 * Auth: JWT admin/super_admin.
 * Return: { ok: boolean, environment?, expires_at?, error?, status? }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { testNuvemFiscalConnection } from "../_shared/nuvemFiscal.ts";

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

  const result = await testNuvemFiscalConnection(service);
  return json(result, result.ok ? 200 : 422);
});
