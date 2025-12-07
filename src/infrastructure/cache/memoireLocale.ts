/**
 * Veilleur - Cache mémoire locale haute performance
 * Complément au cache Redis pour données très fréquemment accédées
 *
 * Utilisation:
 * - Données de configuration
 * - Résultats de requêtes fréquentes
 * - Données de session en mémoire
 * - Métadonnées des sources
 *
 * Caractéristiques:
 * - LRU (Least Recently Used) pour éviction automatique
 * - TTL configurable par entrée
 * - Statistiques de hit/miss
 * - Invalidation par pattern
 * - Thread-safe via Map native
 */

import { logger } from '@/infrastructure/logging/logger';

const loggerCache = logger.child({ module: 'memoire-locale' });

/**
 * Entrée du cache
 */
interface EntreeCache<T> {
  valeur: T;
  expiration: number | null; // null = pas d'expiration
  dernierAcces: number;
  createdAt: number;
  taille: number; // Taille estimée en bytes
}

/**
 * Options du cache
 */
export interface OptionsCache {
  // Nombre maximum d'entrées
  tailleMax?: number;
  // Taille mémoire maximale en bytes (approximatif)
  memoireMax?: number;
  // TTL par défaut en ms (null = pas d'expiration)
  ttlDefaut?: number | null;
  // Intervalle de nettoyage automatique en ms
  intervalleNettoyage?: number;
  // Callback lors d'une éviction
  onEviction?: (cle: string, raison: 'ttl' | 'lru' | 'memoire' | 'manuel') => void;
}

/**
 * Statistiques du cache
 */
export interface StatistiquesCache {
  hits: number;
  misses: number;
  evictions: number;
  entries: number;
  memoireUtilisee: number;
  tauxHit: number;
}

const OPTIONS_DEFAUT: Required<Omit<OptionsCache, 'onEviction'>> = {
  tailleMax: 10000,
  memoireMax: 100 * 1024 * 1024, // 100 MB
  ttlDefaut: 5 * 60 * 1000, // 5 minutes
  intervalleNettoyage: 60 * 1000, // 1 minute
};

/**
 * Estime la taille d'une valeur en bytes
 */
function estimerTaille(valeur: unknown): number {
  if (valeur === null || valeur === undefined) return 0;
  if (typeof valeur === 'boolean') return 4;
  if (typeof valeur === 'number') return 8;
  if (typeof valeur === 'string') return valeur.length * 2;
  if (valeur instanceof Date) return 8;
  if (Array.isArray(valeur)) {
    return valeur.reduce((acc, item) => acc + estimerTaille(item), 8);
  }
  if (typeof valeur === 'object') {
    return Object.entries(valeur).reduce(
      (acc, [key, val]) => acc + key.length * 2 + estimerTaille(val),
      8,
    );
  }
  return 8;
}

/**
 * Cache mémoire locale LRU avec TTL
 */
export class CacheMemoire<T = unknown> {
  private cache = new Map<string, EntreeCache<T>>();
  private options: Required<Omit<OptionsCache, 'onEviction'>> & Pick<OptionsCache, 'onEviction'>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private memoireUtilisee = 0;
  private intervalleId: ReturnType<typeof setInterval> | null = null;

  constructor(options: OptionsCache = {}) {
    this.options = { ...OPTIONS_DEFAUT, ...options };
    this.demarrerNettoyage();
  }

  /**
   * Démarre le nettoyage automatique
   */
  private demarrerNettoyage(): void {
    if (this.intervalleId) return;

    this.intervalleId = setInterval(() => {
      this.nettoyer();
    }, this.options.intervalleNettoyage);
  }

  /**
   * Arrête le nettoyage automatique
   */
  arreterNettoyage(): void {
    if (this.intervalleId) {
      clearInterval(this.intervalleId);
      this.intervalleId = null;
    }
  }

  /**
   * Obtient une valeur du cache
   */
  obtenir(cle: string): T | undefined {
    const entree = this.cache.get(cle);

    if (!entree) {
      this.stats.misses++;
      return undefined;
    }

    // Vérifier expiration
    if (entree.expiration && Date.now() > entree.expiration) {
      this.supprimer(cle, 'ttl');
      this.stats.misses++;
      return undefined;
    }

    // Mettre à jour l'accès (LRU)
    entree.dernierAcces = Date.now();
    this.stats.hits++;

    return entree.valeur;
  }

  /**
   * Définit une valeur dans le cache
   */
  definir(cle: string, valeur: T, ttl?: number | null): void {
    const maintenant = Date.now();
    const taille = estimerTaille(valeur);
    const ttlEffectif = ttl === undefined ? this.options.ttlDefaut : ttl;

    // Supprimer l'ancienne entrée si elle existe
    if (this.cache.has(cle)) {
      const ancienne = this.cache.get(cle)!;
      this.memoireUtilisee -= ancienne.taille;
    }

    // Vérifier les limites avant d'ajouter
    this.fairePlace(taille);

    const entree: EntreeCache<T> = {
      valeur,
      expiration: ttlEffectif ? maintenant + ttlEffectif : null,
      dernierAcces: maintenant,
      createdAt: maintenant,
      taille,
    };

    this.cache.set(cle, entree);
    this.memoireUtilisee += taille;
  }

  /**
   * Supprime une entrée du cache
   */
  supprimer(cle: string, raison: 'ttl' | 'lru' | 'memoire' | 'manuel' = 'manuel'): boolean {
    const entree = this.cache.get(cle);
    if (!entree) return false;

    this.cache.delete(cle);
    this.memoireUtilisee -= entree.taille;
    this.stats.evictions++;

    this.options.onEviction?.(cle, raison);
    return true;
  }

  /**
   * Vérifie si une clé existe
   */
  existe(cle: string): boolean {
    const entree = this.cache.get(cle);
    if (!entree) return false;

    if (entree.expiration && Date.now() > entree.expiration) {
      this.supprimer(cle, 'ttl');
      return false;
    }

    return true;
  }

  /**
   * Obtient ou définit une valeur (cache-aside pattern)
   */
  async obtenirOuDefinir(
    cle: string,
    fetcher: () => Promise<T> | T,
    ttl?: number | null,
  ): Promise<T> {
    const existante = this.obtenir(cle);
    if (existante !== undefined) {
      return existante;
    }

    const valeur = await fetcher();
    this.definir(cle, valeur, ttl);
    return valeur;
  }

  /**
   * Fait de la place pour une nouvelle entrée
   */
  private fairePlace(tailleRequise: number): void {
    // Éviction par nombre d'entrées
    while (this.cache.size >= this.options.tailleMax) {
      this.evincerLRU();
    }

    // Éviction par mémoire
    while (this.memoireUtilisee + tailleRequise > this.options.memoireMax && this.cache.size > 0) {
      this.evincerLRU();
    }
  }

  /**
   * Évince l'entrée la moins récemment utilisée
   */
  private evincerLRU(): void {
    let clePlusAncienne: string | null = null;
    let accesMin = Infinity;

    for (const [cle, entree] of this.cache) {
      if (entree.dernierAcces < accesMin) {
        accesMin = entree.dernierAcces;
        clePlusAncienne = cle;
      }
    }

    if (clePlusAncienne) {
      this.supprimer(clePlusAncienne, 'lru');
    }
  }

  /**
   * Nettoie les entrées expirées
   */
  nettoyer(): number {
    const maintenant = Date.now();
    let supprimees = 0;

    for (const [cle, entree] of this.cache) {
      if (entree.expiration && entree.expiration < maintenant) {
        this.supprimer(cle, 'ttl');
        supprimees++;
      }
    }

    if (supprimees > 0) {
      loggerCache.debug({ supprimees }, 'Nettoyage cache mémoire');
    }

    return supprimees;
  }

  /**
   * Invalide les entrées par pattern
   */
  invaliderPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let supprimees = 0;

    for (const cle of this.cache.keys()) {
      if (regex.test(cle)) {
        this.supprimer(cle, 'manuel');
        supprimees++;
      }
    }

    return supprimees;
  }

  /**
   * Vide entièrement le cache
   */
  vider(): void {
    this.cache.clear();
    this.memoireUtilisee = 0;
    loggerCache.debug('Cache mémoire vidé');
  }

  /**
   * Obtient les statistiques
   */
  obtenirStatistiques(): StatistiquesCache {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      entries: this.cache.size,
      memoireUtilisee: this.memoireUtilisee,
      tauxHit: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  /**
   * Réinitialise les statistiques
   */
  reinitialiserStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Obtient toutes les clés
   */
  cles(): string[] {
    return [...this.cache.keys()];
  }

  /**
   * Obtient le nombre d'entrées
   */
  taille(): number {
    return this.cache.size;
  }
}

/**
 * Cache par namespace pour organisation
 */
export class CacheNamespace<T = unknown> {
  private caches = new Map<string, CacheMemoire<T>>();
  private optionsDefaut: OptionsCache;

  constructor(optionsDefaut: OptionsCache = {}) {
    this.optionsDefaut = optionsDefaut;
  }

  /**
   * Obtient ou crée un cache pour un namespace
   */
  namespace(nom: string, options?: OptionsCache): CacheMemoire<T> {
    if (!this.caches.has(nom)) {
      this.caches.set(nom, new CacheMemoire<T>({ ...this.optionsDefaut, ...options }));
    }
    return this.caches.get(nom)!;
  }

  /**
   * Supprime un namespace
   */
  supprimerNamespace(nom: string): boolean {
    const cache = this.caches.get(nom);
    if (cache) {
      cache.arreterNettoyage();
      cache.vider();
      this.caches.delete(nom);
      return true;
    }
    return false;
  }

  /**
   * Obtient les statistiques globales
   */
  obtenirStatistiquesGlobales(): Record<string, StatistiquesCache> {
    const stats: Record<string, StatistiquesCache> = {};
    for (const [nom, cache] of this.caches) {
      stats[nom] = cache.obtenirStatistiques();
    }
    return stats;
  }

  /**
   * Vide tous les caches
   */
  viderTout(): void {
    for (const cache of this.caches.values()) {
      cache.vider();
    }
  }
}

/**
 * Instances singleton par domaine
 */
export const cachesMemoire = new CacheNamespace({
  tailleMax: 5000,
  ttlDefaut: 5 * 60 * 1000, // 5 minutes
});

// Caches pré-configurés
export const cacheConfig = cachesMemoire.namespace('config', {
  ttlDefaut: 30 * 60 * 1000, // 30 minutes pour la config
  tailleMax: 100,
});

export const cacheSources = cachesMemoire.namespace('sources', {
  ttlDefaut: 10 * 60 * 1000, // 10 minutes
  tailleMax: 1000,
});

export const cacheUtilisateurs = cachesMemoire.namespace('utilisateurs', {
  ttlDefaut: 5 * 60 * 1000, // 5 minutes
  tailleMax: 2000,
});

export const cacheArticles = cachesMemoire.namespace('articles', {
  ttlDefaut: 2 * 60 * 1000, // 2 minutes
  tailleMax: 5000,
});

/**
 * Décorateur pour mettre en cache le résultat d'une méthode
 */
export function memoize<T>(
  options: { ttl?: number; cle?: string } = {},
) {
  const cache = new CacheMemoire<T>({ ttlDefaut: options.ttl ?? 60000 });

  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const methodOriginal = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<T> {
      const cleCache = options.cle ?? `${propertyKey}:${JSON.stringify(args)}`;

      return cache.obtenirOuDefinir(cleCache, () =>
        methodOriginal.apply(this, args),
      );
    };

    return descriptor;
  };
}

/**
 * Wrapper fonctionnel pour memoization
 */
export function memoizeFn<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult | Promise<TResult>,
  options: { ttl?: number; genererCle?: (...args: TArgs) => string } = {},
): (...args: TArgs) => Promise<TResult> {
  const cache = new CacheMemoire<TResult>({ ttlDefaut: options.ttl ?? 60000 });

  return async (...args: TArgs): Promise<TResult> => {
    const cle = options.genererCle
      ? options.genererCle(...args)
      : JSON.stringify(args);

    return cache.obtenirOuDefinir(cle, () => fn(...args));
  };
}

/**
 * Cache avec write-through (écriture synchrone)
 */
export class CacheWriteThrough<T> {
  private cache: CacheMemoire<T>;

  constructor(
    private persister: (cle: string, valeur: T) => Promise<void>,
    private charger: (cle: string) => Promise<T | undefined>,
    options: OptionsCache = {},
  ) {
    this.cache = new CacheMemoire<T>(options);
  }

  async obtenir(cle: string): Promise<T | undefined> {
    // Chercher en mémoire d'abord
    let valeur = this.cache.obtenir(cle);
    if (valeur !== undefined) return valeur;

    // Charger depuis la source
    valeur = await this.charger(cle);
    if (valeur !== undefined) {
      this.cache.definir(cle, valeur);
    }

    return valeur;
  }

  async definir(cle: string, valeur: T): Promise<void> {
    // Écrire en parallèle dans le cache et la persistance
    this.cache.definir(cle, valeur);
    await this.persister(cle, valeur);
  }

  invalider(cle: string): void {
    this.cache.supprimer(cle);
  }
}
