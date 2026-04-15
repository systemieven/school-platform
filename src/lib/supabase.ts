import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// ── Fail-safe for missing env vars ────────────────────────────────────────────
// When the bundle is built without VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
// (typical when Secrets aren't configured on the host — e.g., fresh Lovable deploy
// after the multi-tenancy refactor, or a new client repo without .env.production),
// calling createClient(undefined, undefined) throws "supabaseUrl is required" at
// module init. That crashes main.tsx before React mounts → silent blank page.
//
// Instead: log a clear error, render a visible red banner telling the operator
// exactly what to configure, and pass stub values to createClient so the bundle
// can still load. The UI will be non-functional (queries fail) but the user
// sees *why* instead of a silent blank screen.
if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    '[supabase] Variáveis de ambiente ausentes. ' +
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.production ' +
    'do repositório do cliente (ou nos Secrets do host) e refaça o deploy.';
  // eslint-disable-next-line no-console
  console.error(msg);

  if (typeof document !== 'undefined' && !document.getElementById('__env_error_banner')) {
    const banner = document.createElement('div');
    banner.id = '__env_error_banner';
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;' +
      'padding:16px 20px;background:#dc2626;color:#fff;' +
      'font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;' +
      'box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:left';
    banner.innerHTML =
      '<strong>Variáveis de ambiente ausentes.</strong><br/>' +
      'O site não consegue conectar ao Supabase porque ' +
      '<code style="background:rgba(0,0,0,.25);padding:1px 6px;border-radius:4px">VITE_SUPABASE_URL</code> ' +
      'e/ou ' +
      '<code style="background:rgba(0,0,0,.25);padding:1px 6px;border-radius:4px">VITE_SUPABASE_PUBLISHABLE_KEY</code> ' +
      'não foram definidas no build. ' +
      'Adicione as chaves em <code>.env.production</code> (ver <code>.env.example</code>) ' +
      'ou configure nos Secrets do host e refaça o deploy.';
    const attach = () => (document.body || document.documentElement).appendChild(banner);
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://missing-env.invalid',
  supabaseAnonKey || 'missing-env-key',
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    },
  },
);

// Process OAuth hash immediately on page load (before React mounts).
// This ensures access_token fragments from OAuth redirects are consumed
// and the session is stored in localStorage before any component renders.
if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
  supabase.auth.getSession();
}
