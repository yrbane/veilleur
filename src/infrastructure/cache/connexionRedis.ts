/**
 * Veilleur - Connexion Redis
 * Client ioredis pour le cache et les sessions
 */

import Redis from 'ioredis';
import { obtenirUrlRedis } from '@/config/environnement';
import { loggerCache } from '../logging/logger';

let redisClient: Redis | null = null;

/**
 * Crée la connexion à Redis
 */
export async function creerConnexionRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  loggerCache.info('Connexion à Redis...');

  redisClient = new Redis(obtenirUrlRedis(), {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number): number | null => {
      if (times > 10) {
        loggerCache.error('Nombre maximum de tentatives Redis atteint');
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      loggerCache.warn({ tentative: times, delaiMs: delay }, 'Reconnexion Redis...');
      return delay;
    },
    reconnectOnError: (err: Error): boolean => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some(e => err.message.includes(e));
    },
  });

  redisClient.on('connect', () => {
    loggerCache.info('Connexion à Redis établie');
  });

  redisClient.on('error', (err: Error) => {
    loggerCache.error({ erreur: err.message }, 'Erreur Redis');
  });

  redisClient.on('close', () => {
    loggerCache.warn('Connexion Redis fermée');
  });

  // Tester la connexion
  try {
    await redisClient.ping();
    loggerCache.info('Ping Redis réussi');
  } catch (erreur) {
    loggerCache.error({ erreur }, 'Échec du ping Redis');
    throw erreur;
  }

  return redisClient;
}

/**
 * Récupère l'instance Redis
 */
export function obtenirRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis n\'est pas initialisé. Appelez creerConnexionRedis() d\'abord.');
  }
  return redisClient;
}

/**
 * Ferme la connexion Redis
 */
export async function fermerConnexionRedis(): Promise<void> {
  if (redisClient) {
    loggerCache.info('Fermeture de la connexion Redis...');
    await redisClient.quit();
    redisClient = null;
    loggerCache.info('Connexion Redis fermée');
  }
}

/**
 * Vérifie l'état de la connexion Redis
 */
export async function verifierConnexionRedis(): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Récupère les statistiques Redis
 */
export async function obtenirStatsRedis(): Promise<{
  connecte: boolean;
  memoire: string;
  clients: number;
  cles: number;
}> {
  if (!redisClient) {
    return { connecte: false, memoire: '0', clients: 0, cles: 0 };
  }

  try {
    const info = await redisClient.info('memory');
    const clients = await redisClient.info('clients');
    const keyspace = await redisClient.info('keyspace');

    const memoireLigne = info.split('\n').find(l => l.startsWith('used_memory_human:'));
    const clientsLigne = clients.split('\n').find(l => l.startsWith('connected_clients:'));
    const db0Ligne = keyspace.split('\n').find(l => l.startsWith('db0:'));

    const memoire = memoireLigne?.split(':')[1]?.trim() ?? '0';
    const nbClients = parseInt(clientsLigne?.split(':')[1] ?? '0');
    const nbCles = db0Ligne ? parseInt(db0Ligne.match(/keys=(\d+)/)?.[1] ?? '0') : 0;

    return {
      connecte: true,
      memoire,
      clients: nbClients,
      cles: nbCles,
    };
  } catch {
    return { connecte: false, memoire: '0', clients: 0, cles: 0 };
  }
}
