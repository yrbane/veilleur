/**
 * Veilleur - Configuration du logger Pino
 * Logs JSON en production, console colorée en développement
 */

import pino from 'pino';
import { env, estDeveloppement } from '@/config/environnement';

/**
 * Configuration du transport selon l'environnement
 */
const transportConfig = estDeveloppement()
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    }
  : undefined;

/**
 * Logger principal de l'application
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: transportConfig,
  base: {
    service: 'veilleur',
    version: '0.1.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: label => ({ niveau: label }),
  },
});

/**
 * Crée un logger enfant avec contexte
 */
export function creerLoggerEnfant(contexte: Record<string, unknown>): pino.Logger {
  return logger.child(contexte);
}

/**
 * Logger pour les requêtes HTTP
 */
export const loggerHttp = creerLoggerEnfant({ module: 'http' });

/**
 * Logger pour la base de données
 */
export const loggerBdd = creerLoggerEnfant({ module: 'bdd' });

/**
 * Logger pour le cache Redis
 */
export const loggerCache = creerLoggerEnfant({ module: 'cache' });

/**
 * Logger pour le scraping
 */
export const loggerScraping = creerLoggerEnfant({ module: 'scraping' });

/**
 * Logger pour les jobs BullMQ
 */
export const loggerJobs = creerLoggerEnfant({ module: 'jobs' });

/**
 * Log une erreur avec contexte
 */
export function logErreur(
  logger: pino.Logger,
  erreur: Error,
  message: string,
  contexte?: Record<string, unknown>,
): void {
  logger.error(
    {
      erreur: {
        nom: erreur.name,
        message: erreur.message,
        stack: erreur.stack,
      },
      ...contexte,
    },
    message,
  );
}

/**
 * Mesure le temps d'exécution d'une opération
 */
export async function mesurerTemps<T>(
  logger: pino.Logger,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const debut = performance.now();
  try {
    const resultat = await fn();
    const duree = Math.round(performance.now() - debut);
    logger.info({ operation, dureeMs: duree }, `${operation} terminé`);
    return resultat;
  } catch (erreur) {
    const duree = Math.round(performance.now() - debut);
    logger.error({ operation, dureeMs: duree, erreur }, `${operation} échoué`);
    throw erreur;
  }
}
