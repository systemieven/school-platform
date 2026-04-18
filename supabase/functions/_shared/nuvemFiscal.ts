/**
 * Nuvem Fiscal — cliente OAuth2 compartilhado para todas as Edge Functions.
 *
 * A Nuvem Fiscal usa OAuth2 client_credentials:
 *   POST https://auth.nuvemfiscal.com.br/oauth/token
 *     Content-Type: application/x-www-form-urlencoded
 *     Body: grant_type=client_credentials&client_id=...&client_secret=...&scope=...
 *
 * Resposta:
 *   { access_token: "<JWT>", token_type: "bearer", expires_in: 2592000, scope: "..." }
 *
 * O token vive 30 dias. Não há refresh_token — renovamos trocando as credenciais
 * de novo. O helper cacheia o token em `fiscal_provider_token_cache` e só
 * re-autentica quando faltam menos de 5 minutos para expirar (ou em resposta 401).
 *
 * Uso:
 *
 *   import { nuvemFiscalFetch } from "../_shared/nuvemFiscal.ts";
 *   const res = await nuvemFiscalFetch(service, "/nfe", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 *   const data = await res.json();
 *
 * O helper injeta `Authorization: Bearer <token>` e resolve a base URL conforme
 * o ambiente (sandbox/production). Em 401, invalida o cache e repete 1x.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token";

const API_URLS = {
  sandbox:    "https://api.sandbox.nuvemfiscal.com.br",
  production: "https://api.nuvemfiscal.com.br",
} as const;

// Margem de segurança antes da expiração para re-emitir o token.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export interface NuvemFiscalCredentials {
  provider: string;
  client_id: string;
  client_secret_enc: string;
  environment: "sandbox" | "production";
  scopes: string;
}

export interface NuvemFiscalTokenInfo {
  token: string;
  baseUrl: string;
  environment: "sandbox" | "production";
}

export class NuvemFiscalAuthError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "NuvemFiscalAuthError";
    this.status = status;
    this.detail = detail;
  }
}

async function loadCredentials(
  service: SupabaseClient,
): Promise<NuvemFiscalCredentials> {
  const { data, error } = await service
    .from("fiscal_provider_credentials")
    .select("provider, client_id, client_secret_enc, environment, scopes")
    .eq("provider", "nuvem_fiscal")
    .maybeSingle();

  if (error) {
    throw new NuvemFiscalAuthError(
      `Falha ao ler fiscal_provider_credentials: ${error.message}`,
      500,
      error,
    );
  }
  if (!data) {
    throw new NuvemFiscalAuthError(
      "Credenciais Nuvem Fiscal não configuradas. Configure em /admin/configuracoes → Fiscal.",
      422,
    );
  }
  if (!data.client_id || !data.client_secret_enc) {
    throw new NuvemFiscalAuthError(
      "client_id/client_secret ausentes em fiscal_provider_credentials.",
      422,
    );
  }
  return data as NuvemFiscalCredentials;
}

async function loadCachedToken(
  service: SupabaseClient,
): Promise<{ access_token: string; expires_at: string; environment: string } | null> {
  const { data } = await service
    .from("fiscal_provider_token_cache")
    .select("access_token, expires_at, environment")
    .eq("provider", "nuvem_fiscal")
    .maybeSingle();
  return (data as { access_token: string; expires_at: string; environment: string } | null) ?? null;
}

async function persistToken(
  service: SupabaseClient,
  environment: string,
  accessToken: string,
  expiresInSec: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
  const { error } = await service
    .from("fiscal_provider_token_cache")
    .upsert(
      {
        provider: "nuvem_fiscal",
        environment,
        access_token: accessToken,
        token_type: "bearer",
        expires_at: expiresAt,
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: "provider" },
    );
  if (error) {
    // Não é fatal — pior caso, re-autentica na próxima chamada.
    console.warn("Nuvem Fiscal: falha ao gravar token cache:", error.message);
  }
}

async function invalidateCache(service: SupabaseClient): Promise<void> {
  await service
    .from("fiscal_provider_token_cache")
    .delete()
    .eq("provider", "nuvem_fiscal");
}

async function exchangeToken(
  creds: NuvemFiscalCredentials,
): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     creds.client_id,
    client_secret: creds.client_secret_enc,
    scope:         creds.scopes,
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const d = data as { error?: string; error_description?: string; message?: string };
    throw new NuvemFiscalAuthError(
      d.error_description ?? d.error ?? d.message ?? `HTTP ${res.status}`,
      res.status,
      data,
    );
  }

  const d = data as { access_token?: string; expires_in?: number };
  if (!d.access_token) {
    throw new NuvemFiscalAuthError(
      "Resposta OAuth sem access_token",
      502,
      data,
    );
  }
  return {
    accessToken: d.access_token,
    // Default: 30 dias caso o provider omita expires_in.
    expiresIn: d.expires_in ?? 30 * 24 * 60 * 60,
  };
}

/**
 * Devolve um bearer token válido + a base URL da API correspondente ao ambiente.
 * Usa cache se `expires_at` está a mais de 5 minutos no futuro; caso contrário,
 * faz um novo token exchange.
 */
export async function getNuvemFiscalToken(
  service: SupabaseClient,
  opts: { forceRefresh?: boolean } = {},
): Promise<NuvemFiscalTokenInfo> {
  const creds = await loadCredentials(service);
  const env = creds.environment;
  const baseUrl = API_URLS[env];

  if (!opts.forceRefresh) {
    const cached = await loadCachedToken(service);
    if (
      cached &&
      cached.environment === env &&
      new Date(cached.expires_at).getTime() - Date.now() > EXPIRY_MARGIN_MS
    ) {
      return { token: cached.access_token, baseUrl, environment: env };
    }
  }

  const { accessToken, expiresIn } = await exchangeToken(creds);
  await persistToken(service, env, accessToken, expiresIn);
  return { token: accessToken, baseUrl, environment: env };
}

/**
 * Fetch autenticado para a API Nuvem Fiscal. Em 401, invalida o cache e
 * repete a chamada 1x com token novo.
 */
export async function nuvemFiscalFetch(
  service: SupabaseClient,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const pathWithSlash = path.startsWith("/") ? path : `/${path}`;

  async function doFetch(forceRefresh: boolean): Promise<Response> {
    const { token, baseUrl } = await getNuvemFiscalToken(service, { forceRefresh });
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${baseUrl}${pathWithSlash}`, { ...init, headers });
  }

  const first = await doFetch(false);
  if (first.status !== 401) return first;

  // 401 → invalida cache e tenta de novo com token fresco.
  await invalidateCache(service);
  return doFetch(true);
}

/**
 * Testa a conexão fazendo apenas um token exchange (sem chamar API).
 * Usado pelo botão "Testar conexão" no painel de Configurações.
 */
export async function testNuvemFiscalConnection(
  service: SupabaseClient,
): Promise<{ ok: true; environment: string; expires_at: string } | { ok: false; error: string; status?: number }> {
  try {
    const info = await getNuvemFiscalToken(service, { forceRefresh: true });
    const cached = await loadCachedToken(service);
    return {
      ok: true,
      environment: info.environment,
      expires_at: cached?.expires_at ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch (e) {
    if (e instanceof NuvemFiscalAuthError) {
      return { ok: false, error: e.message, status: e.status };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
