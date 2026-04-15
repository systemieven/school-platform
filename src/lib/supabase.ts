import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// ── Fail-safe for missing env vars ────────────────────────────────────────────
// When the bundle is built without VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
// (typical on a fresh Lovable deploy before Secrets are configured), calling
// createClient(undefined, undefined) throws "supabaseUrl is required" at module
// init — which crashes main.tsx before React can mount. Result: blank page,
// title stuck on "Carregando...".
//
// Instead, we log a clear error, render a visible banner, and pass dummy values
// to createClient so the rest of the bundle can still mount. The UI will be
// non-functional (every query fails) but at least the user can see *why*.
if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    '[supabase] Variáveis de ambiente ausentes. ' +
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no host ' +
    '(Lovable → Project Settings → Environment Variables) e refaça o deploy.';
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
      'No painel do Lovable abra <em>Project Settings → Environment Variables</em>, ' +
      'adicione as chaves (ver <code>.env.example</code>) e refaça o deploy.';
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
