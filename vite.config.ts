/**
 * Veilleur - Configuration Vite
 * Build frontend Vanilla TypeScript avec compression
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';

export default defineConfig({
  root: 'src/client',
  base: '/',
  publicDir: 'public',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    sourcemap: true,
    // Optimisations de build
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Découpage des chunks
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/client/index.html'),
      },
      output: {
        // Séparation vendor/app pour meilleur caching
        manualChunks: {
          vendor: ['alpinejs'],
        },
        // Nommage des chunks avec hash pour cache busting
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Seuil de warning pour la taille des chunks
    chunkSizeWarningLimit: 500,
  },
  plugins: [
    // Compression gzip (pour serveurs nginx/apache)
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Compresser fichiers > 1kb
      deleteOriginFile: false,
    }),
    // Compression brotli (meilleure compression pour navigateurs modernes)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  resolve: {
    alias: {
      '@client': resolve(__dirname, 'src/client'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  css: {
    devSourcemap: true,
  },
  // Optimisations pour la production
  esbuild: {
    legalComments: 'none',
  },
});
