import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        matricula: 'matricula.html',
        biblioteca: 'biblioteca-virtual.html',
        educacaoInfantil: 'educacao-infantil.html',
        ensinoFundamental1: 'ensino-fundamental-1.html',
        ensinoFundamental2: 'ensino-fundamental-2.html',
        ensinoMedio: 'ensino-medio.html',
        sustentabilidade: 'sustentabilidade.html',
        agendamento: 'agendamento.html'
      },
      output: {
        manualChunks: {
          'vendor': ['js-cookie', 'lucide', 'sweetalert2']
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'assets/styles.[hash].css';
          }
          return 'assets/[name].[hash][extname]';
        },
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js'
      }
    },
    sourcemap: false
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer
      ]
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true
  }
});