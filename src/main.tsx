import { createRoot } from 'react-dom/client';

console.log('[BOOT] starting dynamic imports...');

async function boot() {
  try {
    console.log('[BOOT] importing BrandingContext...');
    const { BrandingProvider } = await import('./contexts/BrandingContext');
    console.log('[BOOT] BrandingContext OK');

    console.log('[BOOT] importing App...');
    const { default: App } = await import('./App');
    console.log('[BOOT] App OK');

    console.log('[BOOT] importing BrowserRouter...');
    const { BrowserRouter } = await import('react-router-dom');
    console.log('[BOOT] BrowserRouter OK');

    console.log('[BOOT] importing CSS...');
    await import('./index.css');
    console.log('[BOOT] CSS OK');

    const { StrictMode } = await import('react');

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <BrandingProvider>
            <App />
          </BrandingProvider>
        </BrowserRouter>
      </StrictMode>
    );
    console.log('[BOOT] render done!');
  } catch (err) {
    console.error('[BOOT] ERROR:', err);
    document.getElementById('root')!.innerHTML =
      '<pre style="color:red;padding:2rem;white-space:pre-wrap">' +
      String(err) + '\n\n' + ((err as Error).stack || '') +
      '</pre>';
  }
}

boot();
