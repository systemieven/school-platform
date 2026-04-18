/**
 * nfse-certificado
 *
 * Proxy para upload/consulta/remocao do certificado digital A1 (PFX)
 * na Nuvem Fiscal. Evita expor o API token no frontend.
 *
 * Endpoints da Nuvem Fiscal:
 *   PUT    /empresas/{cpf_cnpj}/certificado  — upload
 *   GET    /empresas/{cpf_cnpj}/certificado  — status (validade, emissor, subject)
 *   DELETE /empresas/{cpf_cnpj}/certificado  — remocao
 *
 * Body: { action: "upload" | "status" | "delete", certificado?: string (base64), password?: string }
 *
 * Requer autenticacao via JWT (admin / super_admin).
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

interface RequestBody {
  action: "upload" | "status" | "delete";
  certificado?: string; // base64 do arquivo .pfx
  password?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Cliente com JWT do usuario — valida autenticacao
  const caller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Valida role admin / super_admin
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

  // Body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { action } = body;
  if (!["upload", "status", "delete"].includes(action)) {
    return json({ error: "action invalida" }, 400);
  }

  // Carrega config NFS-e
  const { data: cfg, error: cfgErr } = await service
    .from("company_nfse_config")
    .select("provider")
    .single();
  if (cfgErr || !cfg) return json({ error: "NFS-e nao configurado" }, 422);

  if (cfg.provider !== "nuvem_fiscal") {
    return json({ error: "Provider ativo nao e Nuvem Fiscal" }, 422);
  }

  // CNPJ do emitente
  const { data: fiscal } = await service
    .from("company_fiscal_config")
    .select("cnpj")
    .single();
  const cnpjDigits = String((fiscal as { cnpj?: string } | null)?.cnpj ?? "").replace(/\D/g, "");
  if (!cnpjDigits) return json({ error: "CNPJ do emitente nao configurado" }, 422);

  const path = `/empresas/${cnpjDigits}/certificado`;

  try {
    if (action === "status") {
      const res = await nuvemFiscalFetch(service, path);
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) {
        return json({ error: "Falha ao consultar certificado", detail: data, status: res.status }, 502);
      }
      return json({
        installed: res.ok,
        data: res.ok ? data : null,
      });
    }

    if (action === "delete") {
      const res = await nuvemFiscalFetch(service, path, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        return json({ error: "Falha ao remover certificado", detail: data, status: res.status }, 502);
      }
      await service.from("audit_logs").insert({
        action: "delete",
        module: "nfse-settings",
        description: "Certificado digital removido da Nuvem Fiscal",
        actor_id: userData.user.id,
      });
      return json({ ok: true });
    }

    // upload
    const { certificado, password } = body;
    if (!certificado || !password) {
      return json({ error: "certificado (base64) e password sao obrigatorios" }, 400);
    }

    const res = await nuvemFiscalFetch(service, path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certificado, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return json({
        error: "Falha no upload do certificado",
        detail: data,
        status: res.status,
      }, 502);
    }

    await service.from("audit_logs").insert({
      action: "update",
      module: "nfse-settings",
      description: "Certificado digital enviado para Nuvem Fiscal",
      actor_id: userData.user.id,
    });

    return json({ ok: true, data });
  } catch (e) {
    return json({
      error: "Erro inesperado",
      detail: e instanceof Error ? e.message : String(e),
    }, 500);
  }
});
