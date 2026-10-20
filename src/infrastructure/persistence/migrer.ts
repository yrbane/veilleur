/**
 * Veilleur - Application des migrations Drizzle
 * Utilise le migrateur intégré à drizzle-orm : aucun besoin de drizzle-kit
 * (dépendance de développement) en production.
 */

import { pathToFileURL } from 'url';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { creerConnexion, fermerConnexion } from './connexion';
import { loggerBdd } from '../logging/logger';

/** Dossier des migrations, relatif au répertoire de travail */
export const DOSSIER_MIGRATIONS = 'drizzle/migrations';

/**
 * Applique les migrations en attente puis ferme la connexion
 */
export async function appliquerMigrations(dossier: string = DOSSIER_MIGRATIONS): Promise<void> {
  const db = await creerConnexion();
  try {
    loggerBdd.info({ dossier }, 'Application des migrations...');
    await migrate(db, { migrationsFolder: dossier });
    loggerBdd.info('Migrations appliquées');
  } finally {
    await fermerConnexion();
  }
}

// Point d'entrée si exécuté directement (node dist/migrer.js)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  appliquerMigrations().catch((erreur) => {
    loggerBdd.error({ erreur }, 'Échec des migrations');
    process.exit(1);
  });
}
