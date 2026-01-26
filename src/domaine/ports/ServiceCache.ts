/**
 * Veilleur - Port ServiceCache
 * Interface pour le service de cache Redis
 */

/**
 * Options de stockage en cache
 */
export interface OptionsCache {
  /** Durée de vie en secondes */
  ttl?: number;
  /** Préfixe de clé */
  prefixe?: string;
}

/**
 * Interface du service de cache
 */
export interface ServiceCache {
  /**
   * Récupère une valeur du cache
   */
  obtenir<T>(cle: string): Promise<T | null>;

  /**
   * Stocke une valeur dans le cache
   */
  stocker<T>(cle: string, valeur: T, options?: OptionsCache): Promise<void>;

  /**
   * Supprime une valeur du cache
   */
  supprimer(cle: string): Promise<boolean>;

  /**
   * Supprime toutes les clés correspondant au pattern
   */
  supprimerPattern(pattern: string): Promise<number>;

  /**
   * Vérifie si une clé existe
   */
  existe(cle: string): Promise<boolean>;

  /**
   * Récupère le TTL restant d'une clé (en secondes)
   */
  ttl(cle: string): Promise<number>;

  /**
   * Incrémente une valeur numérique
   */
  incrementer(cle: string, valeur?: number): Promise<number>;

  /**
   * Décrémente une valeur numérique
   */
  decrementer(cle: string, valeur?: number): Promise<number>;

  /**
   * Récupère ou stocke une valeur (cache-aside)
   */
  obtenirOuStocker<T>(
    cle: string,
    fabrique: () => Promise<T>,
    options?: OptionsCache,
  ): Promise<T>;

  /**
   * Vérifie la connexion au cache
   */
  ping(): Promise<boolean>;

  /**
   * Ferme la connexion
   */
  fermer(): Promise<void>;
}

/**
 * Préfixes de clés pour le cache
 */
export const PREFIXES_CACHE = {
  ARTICLES: 'articles:',
  SOURCES: 'sources:',
  UTILISATEUR: 'utilisateur:',
  METADATA: 'metadata:',
  SESSION: 'session:',
  RATELIMIT: 'ratelimit:',
} as const;

/**
 * TTL par défaut en secondes
 */
export const TTL_DEFAUT = {
  ARTICLES: 3600, // 1 heure
  SOURCES: 300, // 5 minutes
  METADATA: 86400, // 24 heures
  SESSION: 604800, // 7 jours
  RATELIMIT: 60, // 1 minute
} as const;

/**
 * Génère une clé de cache pour les articles d'une source
 */
export function cleArticlesSource(sourceId: string): string {
  return `${PREFIXES_CACHE.ARTICLES}${sourceId}`;
}

/**
 * Génère une clé de cache pour les sources d'un utilisateur
 */
export function cleSourcesUtilisateur(utilisateurId: string): string {
  return `${PREFIXES_CACHE.SOURCES}${utilisateurId}`;
}

/**
 * Génère une clé de cache pour les métadonnées d'un article
 */
export function cleMetadataArticle(articleUrl: string): string {
  return `${PREFIXES_CACHE.METADATA}${articleUrl}`;
}

/**
 * Génère une clé de cache pour le rate limiting
 */
export function cleRateLimit(identifiant: string, type: 'ip' | 'user'): string {
  return `${PREFIXES_CACHE.RATELIMIT}${type}:${identifiant}`;
}
