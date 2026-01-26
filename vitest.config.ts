/**
 * Veilleur - Configuration Vitest
 * Tests unitaires et d'intégration
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  plugins: [],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@client': resolve(__dirname, './src/client'),
      '@api': resolve(__dirname, './src/api'),
      '@domain': resolve(__dirname, './src/domain'),
      '@domaine': resolve(__dirname, './src/domaine'),
      '@infrastructure': resolve(__dirname, './src/infrastructure'),
      '@shared': resolve(__dirname, './src/shared'),
    },
  },

  test: {
    // Environnement par défaut
    environment: 'node',

    // Fichiers de test
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/unitaires/**/*.{test,spec}.{ts,tsx}',
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
    ],

    // Fichiers à exclure
    exclude: [
      'node_modules',
      'dist',
      'tests/e2e/**',
      '**/*.d.ts',
    ],

    // Setup global
    setupFiles: ['./tests/setup.ts'],

    // Globals (describe, it, expect)
    globals: true,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/index.ts',
        'src/client/main.tsx',
        'src/api/index.ts',
      ],
      thresholds: {
        global: {
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 70,
        },
      },
    },

    // Reporters
    reporters: ['default'],

    // Timeout
    testTimeout: 10000,
    hookTimeout: 10000,

    // Watch mode
    watch: false,

    // Mocks
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
    },

    // Specific configurations par environment
    environmentMatchGlobs: [
      ['tests/integration/**', 'node'],
      ['**/*.tsx', 'jsdom'],
      ['src/client/**', 'jsdom'],
    ],
  },
});
