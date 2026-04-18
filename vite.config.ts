import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const schoolName = env.VITE_SCHOOL_NAME || 'Minha Escola';
  const schoolShort = env.VITE_SCHOOL_SHORT_NAME || 'Escola';
  const slogan = env.VITE_SCHOOL_SLOGAN || 'Plataforma escolar';

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.ico', 'robots.txt', 'pwa-icon.svg'],
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: schoolName,
        short_name: schoolShort,
        description: slogan,
        theme_color: '#003366',
        background_color: '#f8f7f4',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
  },
  build: {
    // `es2022` habilita top-level await (Chrome 89+, FF 89+, Safari 15+).
    // Necessário para o chunk dinâmico de pdfjs-dist 4.x (src/lib/extractPdfText.ts).
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'image-compression': ['browser-image-compression'],
          'xlsx': ['xlsx'],
          'sweetalert2': ['sweetalert2'],
          'dnd-kit': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  };
});
