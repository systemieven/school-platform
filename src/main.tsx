import { createRoot } from 'react-dom/client';

console.log('[BOOT] main.tsx loaded');

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <div style={{ padding: '2rem', background: 'red', color: 'white', fontSize: '2rem' }}>
      HELLO WORLD - App is working
    </div>
  );
  console.log('[BOOT] render called');
} else {
  console.error('[BOOT] #root not found');
}
