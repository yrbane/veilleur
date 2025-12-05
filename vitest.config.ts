/**
 * Veilleur - Configuration Vitest
 * Tests unitaires et d'intégration
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unitaires/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/client/**/*'],
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@domaine': resolve(__dirname, 'src/domaine'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@api': resolve(__dirname, 'src/api'),
      '@client': resolve(__dirname, 'src/client'),
    },
  },
});
