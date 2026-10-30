#!/usr/bin/env node
/**
 * Veilleur - Bundle du serveur avec esbuild
 *
 * `tsc` seul produit du JavaScript que Node ne peut pas exécuter : les alias
 * « @/ » et les imports sans extension restent tels quels. esbuild résout tout
 * cela et produit des fichiers ESM autonomes (les paquets de node_modules
 * restent externes) :
 *   - dist/serveur.js : API + workers (point d'entrée de production)
 *   - dist/migrer.js  : application des migrations Drizzle
 *   - dist/seed.js    : sources par défaut
 *   - dist/rattraper-images.js : ré-enfile les images d'articles absentes du cache
 */
import { build } from 'esbuild';

const pointsEntree = {
  serveur: 'src/index.ts',
  migrer: 'src/infrastructure/persistence/migrer.ts',
  seed: 'src/infrastructure/persistence/seed.ts',
  'rattraper-images': 'src/infrastructure/workers/rattraperImages.ts',
  'rattraper-images-manquantes': 'src/infrastructure/workers/rattraperImagesManquantes.ts',
  'rattraper-mots-cles': 'src/infrastructure/workers/rattraperMotsCles.ts',
  'rattraper-sources': 'src/infrastructure/workers/rattraperSources.ts',
  'promouvoir-admin': 'src/infrastructure/workers/promouvoirAdmin.ts',
};

await build({
  entryPoints: pointsEntree,
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
});
