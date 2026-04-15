import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

console.log('[BOOT] before BrandingProvider import');

import { BrandingProvider } from './contexts/BrandingContext';

console.log('[BOOT] before App import');

import App from './App';

console.log('[BOOT] before CSS import');

import './index.css';

console.log('[BOOT] all imports loaded, rendering...');

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
  console.log('[BOOT] render() done');
} catch (err) {
  console.error('[BOOT] RENDER ERROR:', err);
  document.getElementById('root')!.innerHTML = '<pre style="color:red;padding:2rem">' + String(err) + '\n' + (err as Error).stack + '</pre>';
}
