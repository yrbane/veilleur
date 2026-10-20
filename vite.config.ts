/**
 * Veilleur - Configuration Vite
 * Build frontend Vanilla TypeScript avec compression
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';
import { readFileSync } from 'fs';
import type { AcceptedPlugin } from 'postcss';

/**
 * Lunar Aurora déclare « Material Symbols Outlined » depuis fonts.gstatic.com : Veilleur
 * héberge sa propre police d'icônes et sa CSP interdit les polices tierces, on retire la
 * déclaration après l'inlining des @import pour éviter une requête bloquée à chaque chargement.
 */
const sansPoliceGoogle: AcceptedPlugin = {
  postcssPlugin: 'veilleur-sans-police-google',
  AtRule: {
    'font-face': (regle) => {
      if (regle.toString().includes('fonts.gstatic.com')) regle.remove();
    },
  },
};

const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string };

export default defineConfig({
  root: 'src/client',
  base: '/',
  // Version injectée dans le client (affichée dans le pied de page)
  define: {
    __VERSION_APP__: JSON.stringify(version),
  },
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
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  css: {
    devSourcemap: true,
    postcss: { plugins: [sansPoliceGoogle] },
  },
  // Optimisations pour la production
  esbuild: {
    legalComments: 'none',
  },
});
