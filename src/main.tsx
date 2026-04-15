import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BrandingProvider } from './contexts/BrandingContext';
import App from './App';
import './index.css';

// Wrap the boot in try/catch so an unexpected init-time throw (e.g. a missing
// env var that slipped past the supabase.ts fail-safe) renders a visible
// fallback instead of a completely blank page. Without this, the only signal
// of failure is the title stuck on "Carregando..." — which is impossible to
// diagnose from the outside.
try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <BrandingProvider>
          <App />
        </BrandingProvider>
      </BrowserRouter>
    </StrictMode>
  );
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[main] fatal error while mounting React:', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML =
      '<div style="padding:32px;font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:40px auto;color:#111">' +
      '<h1 style="font-size:20px;margin:0 0 12px">Não foi possível iniciar o site</h1>' +
      '<p style="font-size:14px;line-height:1.6;color:#555">' +
      'Ocorreu um erro ao inicializar a aplicação. Verifique as variáveis de ambiente no host ' +
      '(<code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>) e refaça o deploy.' +
      '</p>' +
      '<pre style="font-size:12px;background:#f5f5f5;padding:12px;border-radius:8px;overflow:auto;margin-top:16px;color:#b91c1c">' +
      String((err as Error)?.stack || err) +
      '</pre></div>';
  }
}
