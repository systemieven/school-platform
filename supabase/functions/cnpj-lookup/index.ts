/**
 * cnpj-lookup
 *
 * Consulta CNPJ na Nuvem Fiscal (GET /cnpj/{cnpj}) retornando os dados
 * cadastrais da empresa para auto-preencher formulários (fornecedores,
 * cadastro de empresa, etc.).
 *
 * Body: { cnpj: string }  (com ou sem máscara — normalizamos p/ 14 dígitos)
 * Auth: JWT de qualquer usuário autenticado (admin/super_admin/coordinator/etc).
 * Return: { ok: true, data: <payload Nuvem Fiscal> } | { ok: false, error, status? }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { nuvemFiscalFetch } from "../_shared/nuvemFiscal.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  let body: { cnpj?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const digits = String(body.cnpj ?? "").replace(/\D/g, "");
  if (digits.length !== 14) {
    return json({ ok: false, error: "CNPJ inválido — informe 14 dígitos." }, 400);
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const res = await nuvemFiscalFetch(service, `/cnpj/${digits}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof (data as { message?: string }).message === "string"
        ? (data as { message: string }).message
        : res.status === 404
          ? "CNPJ não encontrado na base da Receita."
          : "Falha ao consultar CNPJ.";
      return json({ ok: false, error: msg, status: res.status, detail: data }, res.status);
    }
    return json({ ok: true, data });
  } catch (e) {
    return json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, 502);
  }
});
