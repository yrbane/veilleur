/**
 * Veilleur - Optimisation des patterns de clés Redis
 * Gestion standardisée et efficace des clés de cache
 *
 * Bonnes pratiques implémentées:
 * - Convention de nommage cohérente (namespace:type:id)
 * - Préfixes courts pour réduire la mémoire
 * - TTL par type de données
 * - Évitement des clés KEYS (utilise SCAN)
 * - Support des slots Redis Cluster (hashtags)
 */

import type Redis from 'ioredis';
import { obtenirRedis } from './connexionRedis';

/**
 * Configuration des namespaces Redis
 * Format: prefixe court pour économiser la mémoire
 */
export const NAMESPACES = {
  // Application
  APP: 'v', // veilleur

  // Types de données
  SESSION: 's',      // sessions utilisateur
  CACHE: 'c',        // cache générique
  RATE_LIMIT: 'r',   // rate limiting
  LOCK: 'l',         // verrous distribués
  QUEUE: 'q',        // files d'attente
  PUBSUB: 'p',       // pub/sub channels
  TEMP: 't',         // données temporaires
} as const;

/**
 * Types de données avec leurs préfixes
 */
export const TYPES = {
  // Entités
  ARTICLE: 'art',
  SOURCE: 'src',
  UTILISATEUR: 'usr',
  ABONNEMENT: 'abo',

  // Cache
  FIL: 'fil',
  LISTE: 'lst',
  COMPTE: 'cnt',

  // Sécurité
  JWT_BLACKLIST: 'jbl',
  TENTATIVES_LOGIN: 'tln',
  VERROUILLAGE: 'lck',

  // Sessions
  ACCESS_TOKEN: 'acc',
  REFRESH_TOKEN: 'rfr',

  // Rate limiting
  IP: 'ip',
  USER: 'user',
  ENDPOINT: 'ep',
} as const;

/**
 * TTL prédéfinis par type (en secondes)
 */
export const TTL = {
  // Sessions
  SESSION: 24 * 60 * 60,         // 24h
  ACCESS_TOKEN: 15 * 60,         // 15min
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 jours

  // Cache
  CACHE_COURT: 60,               // 1min
  CACHE_MOYEN: 5 * 60,           // 5min
  CACHE_LONG: 60 * 60,           // 1h
  CACHE_JOUR: 24 * 60 * 60,      // 24h

  // Sécurité
  RATE_LIMIT_FENETRE: 60,        // 1min
  JWT_BLACKLIST_MAX: 15 * 60,    // durée max access token
  TENTATIVES_LOGIN: 15 * 60,     // 15min
  VERROUILLAGE: 30 * 60,         // 30min
  VERROUILLAGE_ETENDU: 24 * 60 * 60, // 24h

  // Locks
  LOCK: 30,                      // 30s
  LOCK_LONG: 5 * 60,             // 5min
} as const;

/**
 * Génère une clé Redis optimisée
 *
 * Format: namespace:type:identifiant
 *
 * @example
 * genererCle('c', 'art', 'abc123') => 'v:c:art:abc123'
 * genererCle('s', 'usr', '456', 'session') => 'v:s:usr:456:session'
 */
export function genererCle(
  namespace: string,
  type: string,
  ...parties: (string | number)[]
): string {
  const segments = [NAMESPACES.APP, namespace, type, ...parties];
  return segments.join(':');
}

/**
 * Générateurs de clés par domaine
 */
export const cles = {
  // Cache d'articles
  article: {
    parId: (id: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.ARTICLE, id),

    parSource: (sourceId: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.ARTICLE, 'src', sourceId),

    fil: (utilisateurId: string, page: number = 1) =>
      genererCle(NAMESPACES.CACHE, TYPES.FIL, utilisateurId, page),

    compteur: (sourceId: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.COMPTE, 'art', sourceId),
  },

  // Cache de sources
  source: {
    parId: (id: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.SOURCE, id),

    listeUtilisateur: (utilisateurId: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.LISTE, 'src', utilisateurId),
  },

  // Utilisateurs
  utilisateur: {
    parId: (id: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.UTILISATEUR, id),

    parEmail: (email: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.UTILISATEUR, 'email', email),
  },

  // Sessions et tokens
  session: {
    access: (jti: string) =>
      genererCle(NAMESPACES.SESSION, TYPES.ACCESS_TOKEN, jti),

    refresh: (tokenId: string) =>
      genererCle(NAMESPACES.SESSION, TYPES.REFRESH_TOKEN, tokenId),

    utilisateur: (utilisateurId: string) =>
      genererCle(NAMESPACES.SESSION, TYPES.UTILISATEUR, utilisateurId),
  },

  // Sécurité
  securite: {
    jwtBlacklist: (jti: string) =>
      genererCle(NAMESPACES.CACHE, TYPES.JWT_BLACKLIST, jti),

    tentativesLogin: (identifiant: string) =>
      genererCle(NAMESPACES.TEMP, TYPES.TENTATIVES_LOGIN, identifiant),

    verrouillage: (identifiant: string) =>
      genererCle(NAMESPACES.TEMP, TYPES.VERROUILLAGE, identifiant),

    recidive: (identifiant: string) =>
      genererCle(NAMESPACES.TEMP, TYPES.VERROUILLAGE, 'rec', identifiant),
  },

  // Rate limiting
  rateLimit: {
    ip: (ip: string, fenetre: number) =>
      genererCle(NAMESPACES.RATE_LIMIT, TYPES.IP, ip, fenetre),

    utilisateur: (utilisateurId: string, fenetre: number) =>
      genererCle(NAMESPACES.RATE_LIMIT, TYPES.USER, utilisateurId, fenetre),

    endpoint: (endpoint: string, identifiant: string, fenetre: number) =>
      genererCle(NAMESPACES.RATE_LIMIT, TYPES.ENDPOINT, endpoint, identifiant, fenetre),
  },

  // Verrous distribués
  lock: {
    ressource: (type: string, id: string) =>
      genererCle(NAMESPACES.LOCK, type, id),

    synchronisation: (sourceId: string) =>
      genererCle(NAMESPACES.LOCK, 'sync', sourceId),
  },
};

/**
 * Pattern pour recherche de clés (utiliser avec SCAN, pas KEYS)
 */
export const patterns = {
  // Tous les articles d'une source
  articlesSource: (sourceId: string) =>
    `${NAMESPACES.APP}:${NAMESPACES.CACHE}:${TYPES.ARTICLE}:src:${sourceId}*`,

  // Tous les fils d'un utilisateur
  filsUtilisateur: (utilisateurId: string) =>
    `${NAMESPACES.APP}:${NAMESPACES.CACHE}:${TYPES.FIL}:${utilisateurId}*`,

  // Tous les rate limits d'une IP
  rateLimitIp: (ip: string) =>
    `${NAMESPACES.APP}:${NAMESPACES.RATE_LIMIT}:${TYPES.IP}:${ip}*`,

  // Toutes les sessions d'un utilisateur
  sessionsUtilisateur: (utilisateurId: string) =>
    `${NAMESPACES.APP}:${NAMESPACES.SESSION}:*:${utilisateurId}*`,
};

/**
 * Supprime les clés par pattern en utilisant SCAN (non-bloquant)
 * Contrairement à KEYS, SCAN n'impacte pas les performances en production
 *
 * @param pattern - Pattern de clés à supprimer
 * @param batchSize - Nombre de clés par itération SCAN
 * @returns Nombre de clés supprimées
 */
export async function supprimerParPattern(
  pattern: string,
  batchSize: number = 100,
): Promise<number> {
  const redis = obtenirRedis();
  let cursor = '0';
  let totalSupprimees = 0;

  do {
    const [nouveauCurseur, clesPage] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      batchSize,
    );
    cursor = nouveauCurseur;

    if (clesPage.length > 0) {
      const supprimees = await redis.del(...clesPage);
      totalSupprimees += supprimees;
    }
  } while (cursor !== '0');

  return totalSupprimees;
}

/**
 * Compte les clés par pattern en utilisant SCAN
 */
export async function compterParPattern(
  pattern: string,
  batchSize: number = 100,
): Promise<number> {
  const redis = obtenirRedis();
  let cursor = '0';
  let total = 0;

  do {
    const [nouveauCurseur, clesPage] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      batchSize,
    );
    cursor = nouveauCurseur;
    total += clesPage.length;
  } while (cursor !== '0');

  return total;
}

/**
 * Exécute une opération sur des clés par pattern avec SCAN
 */
export async function pourChaquePattern<T>(
  pattern: string,
  operation: (cles: string[]) => Promise<T>,
  batchSize: number = 100,
): Promise<T[]> {
  const redis = obtenirRedis();
  let cursor = '0';
  const resultats: T[] = [];

  do {
    const [nouveauCurseur, clesPage] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      batchSize,
    );
    cursor = nouveauCurseur;

    if (clesPage.length > 0) {
      const resultat = await operation(clesPage);
      resultats.push(resultat);
    }
  } while (cursor !== '0');

  return resultats;
}

/**
 * Récupère des infos sur l'utilisation des clés par namespace
 */
export async function analyserUtilisation(): Promise<
  Record<string, { count: number; memoire: number }>
> {
  const redis = obtenirRedis();
  const stats: Record<string, { count: number; memoire: number }> = {};

  // Analyser chaque namespace
  for (const [nom, prefixe] of Object.entries(NAMESPACES)) {
    if (nom === 'APP') continue;

    const pattern = `${NAMESPACES.APP}:${prefixe}:*`;
    const count = await compterParPattern(pattern);

    stats[nom] = {
      count,
      memoire: 0, // Serait calculé avec DEBUG OBJECT mais désactivé en production
    };
  }

  return stats;
}

/**
 * Hashtag pour Redis Cluster
 * Garantit que les clés liées sont sur le même slot
 *
 * @example
 * avecHashtag('user', 'abc123', 'session') => '{user:abc123}:session'
 */
export function avecHashtag(groupe: string, id: string, ...suffixes: string[]): string {
  const hashtag = `{${groupe}:${id}}`;
  if (suffixes.length === 0) {
    return hashtag;
  }
  return `${hashtag}:${suffixes.join(':')}`;
}
