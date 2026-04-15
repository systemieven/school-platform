import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BrandingProvider } from './contexts/BrandingContext';
import App from './App';
import './index.css';

// Defensive mount: if anything in the import chain throws at init time
// (e.g., a misconfigured dependency, missing env var not caught upstream),
// render a legible error overlay instead of a silent blank page.
const rootEl = document.getElementById('root');

if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:24px;font-family:system-ui,sans-serif;color:#b91c1c">' +
    '<strong>Erro crítico:</strong> elemento #root não encontrado no HTML.' +
    '</div>';
} else {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <BrowserRouter>
          <BrandingProvider>
            <App />
          </BrandingProvider>
        </BrowserRouter>
      </StrictMode>,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[boot] React falhou ao montar:', err);
    const stack = err instanceof Error ? err.stack || err.message : String(err);
    rootEl.innerHTML =
      '<div style="padding:24px;font-family:system-ui,sans-serif;max-width:900px;margin:40px auto">' +
      '<h1 style="color:#b91c1c;margin:0 0 12px">Falha ao iniciar o app</h1>' +
      '<p style="color:#374151;margin:0 0 16px">Um erro ocorreu antes da interface ser renderizada. ' +
      'Verifique as variáveis de ambiente do deploy e o console do navegador.</p>' +
      '<pre style="background:#f3f4f6;padding:16px;border-radius:8px;overflow:auto;font-size:12px;color:#111827;white-space:pre-wrap">' +
      stack.replace(/</g, '&lt;') +
      '</pre></div>';
  }
}
