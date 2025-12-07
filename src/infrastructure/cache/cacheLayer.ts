/**
 * Veilleur - Cache Layer pour les requêtes BDD
 * Patterns de cache avancés: cache-aside, read-through, write-through
 *
 * Fournit une couche d'abstraction pour mettre en cache les requêtes
 * de base de données avec invalidation par tags et TTL.
 */

import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { loggerCache } from '../logging/logger';

/**
 * Options de cache pour une requête
 */
export interface OptionsCacheRequete {
  // TTL en secondes (0 = infini)
  ttl?: number;
  // Tags pour l'invalidation groupée
  tags?: string[];
  // Force la mise à jour du cache
  forcer?: boolean;
  // Ne pas mettre en cache si la valeur est null/undefined
  ignoreNull?: boolean;
}

/**
 * Options de cache globales
 */
interface ConfigCacheLayer {
  // Préfixe pour toutes les clés
  prefixe: string;
  // TTL par défaut
  ttlDefaut: number;
  // Activer les logs de debug
  debug: boolean;
  // Fonction de sérialisation personnalisée
  serialiser?: (value: unknown) => string;
  // Fonction de désérialisation personnalisée
  deserialiser?: (value: string) => unknown;
}

/**
 * Statistiques du cache
 */
interface StatistiquesCacheLayer {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  errors: number;
}

/**
 * Préfixe pour les clés de tags
 */
const PREFIXE_TAG = 'tag:';

/**
 * Cache Layer pour les requêtes de base de données
 */
export class CacheLayer {
  private config: ConfigCacheLayer;
  private stats: StatistiquesCacheLayer = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    errors: 0,
  };

  constructor(
    private readonly cache: ServiceCache,
    config?: Partial<ConfigCacheLayer>,
  ) {
    this.config = {
      prefixe: 'db:',
      ttlDefaut: 300, // 5 minutes
      debug: false,
      ...config,
    };
  }

  /**
   * Génère une clé de cache
   */
  private genererCle(entite: string, identifiant: string | Record<string, unknown>): string {
    const id = typeof identifiant === 'string'
      ? identifiant
      : JSON.stringify(identifiant);
    return `${this.config.prefixe}${entite}:${id}`;
  }

  /**
   * Récupère une valeur du cache
   */
  async obtenir<T>(entite: string, identifiant: string | Record<string, unknown>): Promise<T | null> {
    const cle = this.genererCle(entite, identifiant);

    try {
      const valeur = await this.cache.obtenir<T>(cle);

      if (valeur !== null) {
        this.stats.hits++;
        if (this.config.debug) {
          loggerCache.debug({ cle }, 'Cache hit');
        }
        return valeur;
      }

      this.stats.misses++;
      if (this.config.debug) {
        loggerCache.debug({ cle }, 'Cache miss');
      }
      return null;
    } catch (error) {
      this.stats.errors++;
      loggerCache.error({ error, cle }, 'Erreur lecture cache');
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache
   */
  async stocker<T>(
    entite: string,
    identifiant: string | Record<string, unknown>,
    valeur: T,
    options?: OptionsCacheRequete,
  ): Promise<void> {
    if (options?.ignoreNull && (valeur === null || valeur === undefined)) {
      return;
    }

    const cle = this.genererCle(entite, identifiant);
    const ttl = options?.ttl ?? this.config.ttlDefaut;

    try {
      await this.cache.stocker(cle, valeur, { ttl });
      this.stats.sets++;

      // Associer les tags à cette clé
      if (options?.tags && options.tags.length > 0) {
        await this.associerTags(cle, options.tags);
      }

      if (this.config.debug) {
        loggerCache.debug({ cle, ttl, tags: options?.tags }, 'Cache set');
      }
    } catch (error) {
      this.stats.errors++;
      loggerCache.error({ error, cle }, 'Erreur écriture cache');
    }
  }

  /**
   * Récupère une valeur du cache ou la calcule
   * Pattern: cache-aside / read-through
   */
  async obtenirOuCalculer<T>(
    entite: string,
    identifiant: string | Record<string, unknown>,
    fabrique: () => Promise<T>,
    options?: OptionsCacheRequete,
  ): Promise<T> {
    // Forcer la mise à jour si demandé
    if (!options?.forcer) {
      const cached = await this.obtenir<T>(entite, identifiant);
      if (cached !== null) {
        return cached;
      }
    }

    // Calculer la valeur
    const valeur = await fabrique();

    // Stocker dans le cache
    await this.stocker(entite, identifiant, valeur, options);

    return valeur;
  }

  /**
   * Met à jour le cache et exécute la mise à jour
   * Pattern: write-through
   */
  async ecrireAvecCache<T, R>(
    entite: string,
    identifiant: string | Record<string, unknown>,
    operation: () => Promise<R>,
    nouvelleValeur: T | null,
    options?: OptionsCacheRequete,
  ): Promise<R> {
    // Exécuter l'opération d'écriture
    const resultat = await operation();

    // Mettre à jour ou invalider le cache
    if (nouvelleValeur !== null) {
      await this.stocker(entite, identifiant, nouvelleValeur, options);
    } else {
      await this.invalider(entite, identifiant);
    }

    return resultat;
  }

  /**
   * Invalide une entrée du cache
   */
  async invalider(entite: string, identifiant: string | Record<string, unknown>): Promise<void> {
    const cle = this.genererCle(entite, identifiant);

    try {
      await this.cache.supprimer(cle);
      this.stats.invalidations++;

      if (this.config.debug) {
        loggerCache.debug({ cle }, 'Cache invalidé');
      }
    } catch (error) {
      this.stats.errors++;
      loggerCache.error({ error, cle }, 'Erreur invalidation cache');
    }
  }

  /**
   * Invalide toutes les entrées d'une entité
   */
  async invaliderEntite(entite: string): Promise<number> {
    const pattern = `${this.config.prefixe}${entite}:*`;

    try {
      const count = await this.cache.supprimerPattern(pattern);
      this.stats.invalidations += count;

      if (this.config.debug) {
        loggerCache.debug({ pattern, count }, 'Cache entité invalidé');
      }

      return count;
    } catch (error) {
      this.stats.errors++;
      loggerCache.error({ error, pattern }, 'Erreur invalidation entité');
      return 0;
    }
  }

  /**
   * Associe des tags à une clé de cache
   */
  private async associerTags(cle: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const cleTag = `${this.config.prefixe}${PREFIXE_TAG}${tag}`;

      // Récupérer les clés existantes pour ce tag
      const clesExistantes = await this.cache.obtenir<string[]>(cleTag) ?? [];

      // Ajouter la nouvelle clé si pas déjà présente
      if (!clesExistantes.includes(cle)) {
        clesExistantes.push(cle);
        // Stocker avec un TTL long (1 jour) - les tags persistent
        await this.cache.stocker(cleTag, clesExistantes, { ttl: 86400 });
      }
    }
  }

  /**
   * Invalide toutes les entrées associées à un tag
   */
  async invaliderTag(tag: string): Promise<number> {
    const cleTag = `${this.config.prefixe}${PREFIXE_TAG}${tag}`;

    try {
      // Récupérer les clés associées au tag
      const cles = await this.cache.obtenir<string[]>(cleTag);

      if (!cles || cles.length === 0) {
        return 0;
      }

      // Supprimer chaque clé
      let count = 0;
      for (const cle of cles) {
        const deleted = await this.cache.supprimer(cle);
        if (deleted) count++;
      }

      // Supprimer le tag lui-même
      await this.cache.supprimer(cleTag);

      this.stats.invalidations += count;

      if (this.config.debug) {
        loggerCache.debug({ tag, count }, 'Cache tag invalidé');
      }

      return count;
    } catch (error) {
      this.stats.errors++;
      loggerCache.error({ error, tag }, 'Erreur invalidation tag');
      return 0;
    }
  }

  /**
   * Invalide plusieurs tags à la fois
   */
  async invaliderTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) {
      total += await this.invaliderTag(tag);
    }
    return total;
  }

  /**
   * Récupère les statistiques du cache
   */
  obtenirStatistiques(): StatistiquesCacheLayer & { tauxHit: number } {
    const total = this.stats.hits + this.stats.misses;
    const tauxHit = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      tauxHit: Math.round(tauxHit * 100) / 100,
    };
  }

  /**
   * Réinitialise les statistiques
   */
  reinitialiserStatistiques(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0,
    };
  }

  /**
   * Préchauffe le cache avec des données
   */
  async prechauffer<T>(
    entite: string,
    donnees: Array<{ identifiant: string | Record<string, unknown>; valeur: T }>,
    options?: OptionsCacheRequete,
  ): Promise<number> {
    let count = 0;

    for (const { identifiant, valeur } of donnees) {
      try {
        await this.stocker(entite, identifiant, valeur, options);
        count++;
      } catch {
        // Continuer avec les autres entrées
      }
    }

    if (this.config.debug) {
      loggerCache.debug({ entite, count, total: donnees.length }, 'Cache préchauffé');
    }

    return count;
  }
}

/**
 * Décorateur pour mettre en cache automatiquement les méthodes
 */
export function cacheable(
  entite: string,
  options?: OptionsCacheRequete,
) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: { cacheLayer?: CacheLayer }, ...args: unknown[]) {
      if (!this.cacheLayer) {
        return originalMethod.apply(this, args);
      }

      const identifiant = args.length === 1 && typeof args[0] === 'string'
        ? args[0]
        : JSON.stringify(args);

      return this.cacheLayer.obtenirOuCalculer(
        entite,
        identifiant,
        () => originalMethod.apply(this, args),
        options,
      );
    } as T;

    return descriptor;
  };
}

/**
 * TTL prédéfinis pour différents types de données
 */
export const TTL_CACHE = {
  // Données statiques (configuration, catégories)
  STATIQUE: 3600, // 1 heure
  // Données semi-dynamiques (listes, compteurs)
  LISTE: 300, // 5 minutes
  // Données dynamiques (détails, sessions)
  DYNAMIQUE: 60, // 1 minute
  // Données très dynamiques (temps réel)
  TEMPS_REEL: 10, // 10 secondes
  // Données permanentes (jusqu'à invalidation explicite)
  PERMANENT: 0,
} as const;

/**
 * Tags prédéfinis pour l'invalidation groupée
 */
export const TAGS_CACHE = {
  ARTICLES: 'articles',
  SOURCES: 'sources',
  UTILISATEURS: 'utilisateurs',
  ABONNEMENTS: 'abonnements',
  FIL: 'fil',
} as const;

/**
 * Instance singleton du cache layer
 */
let instanceCacheLayer: CacheLayer | null = null;

/**
 * Initialise le cache layer
 */
export function initialiserCacheLayer(
  cache: ServiceCache,
  config?: Partial<ConfigCacheLayer>,
): CacheLayer {
  instanceCacheLayer = new CacheLayer(cache, config);
  return instanceCacheLayer;
}

/**
 * Récupère l'instance du cache layer
 */
export function obtenirCacheLayer(): CacheLayer {
  if (!instanceCacheLayer) {
    throw new Error('CacheLayer non initialisé. Appelez initialiserCacheLayer() d\'abord.');
  }
  return instanceCacheLayer;
}
