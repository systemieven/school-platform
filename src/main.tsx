import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BrandingProvider } from './contexts/BrandingContext';
import App from './App';
import './index.css';

console.log('[DEBUG] main.tsx executing');
console.log('[DEBUG] VITE_SUPABASE_URL =', import.meta.env.VITE_SUPABASE_URL);

try {
  const root = document.getElementById('root');
  console.log('[DEBUG] root element:', root);
  createRoot(root!).render(
    <StrictMode>
      <BrowserRouter>
        <BrandingProvider>
          <App />
        </BrandingProvider>
      </BrowserRouter>
    </StrictMode>
  );
  console.log('[DEBUG] render() called successfully');
} catch (err) {
  console.error('[DEBUG] RENDER ERROR:', err);
  document.getElementById('root')!.innerHTML = '<pre style="color:red;padding:2rem">' + String(err) + '</pre>';
}
