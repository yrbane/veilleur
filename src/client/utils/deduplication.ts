/**
 * Veilleur - Déduplication des requêtes API
 * Évite les requêtes réseau dupliquées en consolidant les appels identiques
 *
 * Fonctionnalités:
 * - Déduplication des requêtes GET identiques en cours
 * - Cache mémoire avec TTL configurable
 * - AbortController pour annulation
 * - Statistiques de cache
 */

/**
 * Options de configuration de la déduplication
 */
interface OptionsDeduplication {
  // TTL du cache en millisecondes (défaut: 0 = pas de cache)
  ttlCache?: number;
  // Ignorer les paramètres de requête pour la déduplication
  ignorerParams?: boolean;
}

/**
 * Entrée en cours de requête
 */
interface RequeteEnCours<T> {
  promesse: Promise<T>;
  abortController: AbortController;
  timestamp: number;
}

/**
 * Entrée de cache
 */
interface EntreeCache<T> {
  donnees: T;
  expiration: number;
}

/**
 * Statistiques de déduplication
 */
export interface StatistiquesDeduplication {
  requetesTotal: number;
  requetesEvitees: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Gestionnaire de déduplication des requêtes
 */
class GestionnaireDeduplication {
  private requetesEnCours = new Map<string, RequeteEnCours<unknown>>();
  private cache = new Map<string, EntreeCache<unknown>>();
  private stats: StatistiquesDeduplication = {
    requetesTotal: 0,
    requetesEvitees: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  /**
   * Génère une clé unique pour une requête
   */
  private genererCle(url: string, options?: RequestInit): string {
    const method = (options?.method || 'GET').toUpperCase();
    const body = options?.body ? String(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Exécute une requête avec déduplication
   */
  async executer<T>(
    url: string,
    executeur: (signal?: AbortSignal) => Promise<T>,
    options: OptionsDeduplication & { requestOptions?: RequestInit } = {},
  ): Promise<T> {
    const cle = this.genererCle(url, options.requestOptions);
    this.stats.requetesTotal++;

    // Vérifier le cache d'abord
    if (options.ttlCache && options.ttlCache > 0) {
      const entreeCache = this.cache.get(cle) as EntreeCache<T> | undefined;
      if (entreeCache && entreeCache.expiration > Date.now()) {
        this.stats.cacheHits++;
        return entreeCache.donnees;
      }
      this.stats.cacheMisses++;
    }

    // Vérifier si une requête identique est déjà en cours
    const requeteExistante = this.requetesEnCours.get(cle) as RequeteEnCours<T> | undefined;
    if (requeteExistante) {
      this.stats.requetesEvitees++;
      return requeteExistante.promesse;
    }

    // Créer une nouvelle requête
    const abortController = new AbortController();

    const promesse = (async () => {
      try {
        const resultat = await executeur(abortController.signal);

        // Mettre en cache si TTL spécifié
        if (options.ttlCache && options.ttlCache > 0) {
          this.cache.set(cle, {
            donnees: resultat,
            expiration: Date.now() + options.ttlCache,
          });
        }

        return resultat;
      } finally {
        // Nettoyer la requête en cours
        this.requetesEnCours.delete(cle);
      }
    })();

    this.requetesEnCours.set(cle, {
      promesse,
      abortController,
      timestamp: Date.now(),
    });

    return promesse;
  }

  /**
   * Annule toutes les requêtes en cours
   */
  annulerTout(): void {
    for (const [_cle, requete] of this.requetesEnCours) {
      requete.abortController.abort();
    }
    this.requetesEnCours.clear();
  }

  /**
   * Invalide le cache pour une URL
   */
  invaliderCache(url: string, options?: RequestInit): void {
    const cle = this.genererCle(url, options);
    this.cache.delete(cle);
  }

  /**
   * Invalide tout le cache correspondant à un pattern
   */
  invaliderCachePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const cle of this.cache.keys()) {
      if (regex.test(cle)) {
        this.cache.delete(cle);
      }
    }
  }

  /**
   * Vide tout le cache
   */
  viderCache(): void {
    this.cache.clear();
  }

  /**
   * Nettoie les entrées de cache expirées
   */
  nettoyerCache(): number {
    const maintenant = Date.now();
    let supprimees = 0;

    for (const [cle, entree] of this.cache) {
      if (entree.expiration <= maintenant) {
        this.cache.delete(cle);
        supprimees++;
      }
    }

    return supprimees;
  }

  /**
   * Obtient les statistiques
   */
  obtenirStatistiques(): StatistiquesDeduplication & {
    tauxEvitement: number;
    tauxCache: number;
  } {
    const totalCacheRequetes = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      ...this.stats,
      tauxEvitement: this.stats.requetesTotal > 0
        ? (this.stats.requetesEvitees / this.stats.requetesTotal) * 100
        : 0,
      tauxCache: totalCacheRequetes > 0
        ? (this.stats.cacheHits / totalCacheRequetes) * 100
        : 0,
    };
  }

  /**
   * Réinitialise les statistiques
   */
  reinitialiserStats(): void {
    this.stats = {
      requetesTotal: 0,
      requetesEvitees: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Obtient le nombre de requêtes en cours
   */
  nombreRequetesEnCours(): number {
    return this.requetesEnCours.size;
  }

  /**
   * Obtient la taille du cache
   */
  tailleCache(): number {
    return this.cache.size;
  }
}

/**
 * Instance singleton du gestionnaire
 */
export const deduplication = new GestionnaireDeduplication();

/**
 * Décorateur pour dédupliquer une fonction async
 */
export function deduplique<T>(
  options: OptionsDeduplication = {},
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const methodOriginal = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<T> {
      const cle = JSON.stringify(args);
      return deduplication.executer<T>(
        cle,
        () => methodOriginal.apply(this, args),
        options,
      );
    };

    return descriptor;
  };
}

/**
 * Wrapper pour fetch avec déduplication
 * Utiliser pour les requêtes GET qui peuvent être dédupliquées
 */
export async function fetchDeduplique<T>(
  url: string,
  options: RequestInit & OptionsDeduplication = {},
): Promise<T> {
  const { ttlCache, ignorerParams, ...fetchOptions } = options;

  // Ne dédupliquer que les requêtes GET
  const method = (fetchOptions.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    const response = await fetch(url, fetchOptions);
    return response.json();
  }

  const cleUrl = ignorerParams ? (url.split('?')[0] ?? url) : url;
  return deduplication.executer<T>(
    cleUrl,
    async (signal) => {
      const response = await fetch(url, { ...fetchOptions, signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    { ttlCache, requestOptions: fetchOptions },
  );
}

/**
 * Nettoie périodiquement le cache (à appeler au démarrage de l'app)
 */
export function demarrerNettoyageCache(intervalleMs = 60000): () => void {
  const intervalle = setInterval(() => {
    deduplication.nettoyerCache();
  }, intervalleMs);

  return () => clearInterval(intervalle);
}
