/**
 * Veilleur - DataLoader pour prévenir les requêtes N+1
 * Batching et caching des requêtes de base de données
 *
 * Le DataLoader collecte les requêtes d'une même tick d'event loop
 * et les exécute en une seule requête batch.
 */

/**
 * Options de configuration du DataLoader
 */
export interface OptionsDataLoader {
  // Activer le cache (par défaut: true)
  cache?: boolean;
  // Taille maximale du cache (par défaut: 1000)
  tailleMaxCache?: number;
  // TTL du cache en ms (par défaut: 0 = pas d'expiration dans la requête)
  ttlCache?: number;
  // Activer le batching (par défaut: true)
  batch?: boolean;
  // Taille maximale d'un batch (par défaut: 100)
  tailleMaxBatch?: number;
  // Délai d'attente avant exécution du batch en ms (par défaut: 0 = prochain tick)
  delaieBatch?: number;
}

/**
 * Entrée du cache avec timestamp
 */
interface EntreeCache<V> {
  valeur: V;
  timestamp: number;
}

/**
 * Requête en attente de batch
 */
interface RequeteEnAttente<K, V> {
  cle: K;
  resolve: (valeur: V) => void;
  reject: (erreur: Error) => void;
}

/**
 * Fonction de chargement batch
 */
export type FonctionChargementBatch<K, V> = (cles: K[]) => Promise<(V | Error)[]>;

/**
 * Fonction de génération de clé de cache
 */
export type FonctionCleCache<K> = (cle: K) => string;

/**
 * DataLoader générique pour batching et caching
 */
export class DataLoader<K, V> {
  private options: Required<OptionsDataLoader>;
  private cache = new Map<string, EntreeCache<V>>();
  private requetesEnAttente: RequeteEnAttente<K, V>[] = [];
  private batchPlanifie = false;
  private cleCache: FonctionCleCache<K>;

  constructor(
    private chargerBatch: FonctionChargementBatch<K, V>,
    options?: OptionsDataLoader,
    cleCache?: FonctionCleCache<K>,
  ) {
    this.options = {
      cache: true,
      tailleMaxCache: 1000,
      ttlCache: 0,
      batch: true,
      tailleMaxBatch: 100,
      delaieBatch: 0,
      ...options,
    };

    // Fonction de génération de clé par défaut
    this.cleCache = cleCache ?? ((cle: K) => {
      if (typeof cle === 'string') return cle;
      if (typeof cle === 'number') return String(cle);
      return JSON.stringify(cle);
    });
  }

  /**
   * Charge une valeur par sa clé
   * Utilise le cache si disponible, sinon ajoute au batch
   */
  async charger(cle: K): Promise<V> {
    const cleString = this.cleCache(cle);

    // Vérifier le cache
    if (this.options.cache) {
      const entree = this.cache.get(cleString);
      if (entree) {
        // Vérifier le TTL si défini
        if (this.options.ttlCache === 0 ||
            Date.now() - entree.timestamp < this.options.ttlCache) {
          return entree.valeur;
        }
        // Entrée expirée
        this.cache.delete(cleString);
      }
    }

    // Si batching désactivé, charger directement
    if (!this.options.batch) {
      const resultats = await this.chargerBatch([cle]);
      const resultat = resultats[0];
      if (resultat instanceof Error) {
        throw resultat;
      }
      this.mettreEnCache(cleString, resultat as V);
      return resultat as V;
    }

    // Ajouter au batch
    return new Promise<V>((resolve, reject) => {
      this.requetesEnAttente.push({ cle, resolve, reject });
      this.planifierBatch();
    });
  }

  /**
   * Charge plusieurs valeurs par leurs clés
   */
  async chargerPlusieurs(cles: K[]): Promise<V[]> {
    return Promise.all(cles.map(cle => this.charger(cle)));
  }

  /**
   * Précharge des valeurs dans le cache
   */
  precharger(cle: K, valeur: V): this {
    const cleString = this.cleCache(cle);
    this.mettreEnCache(cleString, valeur);
    return this;
  }

  /**
   * Invalide une entrée du cache
   */
  invalider(cle: K): this {
    const cleString = this.cleCache(cle);
    this.cache.delete(cleString);
    return this;
  }

  /**
   * Vide tout le cache
   */
  viderCache(): this {
    this.cache.clear();
    return this;
  }

  /**
   * Retourne les statistiques du loader
   */
  obtenirStatistiques(): {
    tailleCache: number;
    requetesEnAttente: number;
    batchPlanifie: boolean;
  } {
    return {
      tailleCache: this.cache.size,
      requetesEnAttente: this.requetesEnAttente.length,
      batchPlanifie: this.batchPlanifie,
    };
  }

  /**
   * Met une valeur en cache
   */
  private mettreEnCache(cleString: string, valeur: V): void {
    if (!this.options.cache) return;

    // Limiter la taille du cache (FIFO simple)
    if (this.cache.size >= this.options.tailleMaxCache) {
      const premiereCle = this.cache.keys().next().value;
      if (premiereCle) {
        this.cache.delete(premiereCle);
      }
    }

    this.cache.set(cleString, {
      valeur,
      timestamp: Date.now(),
    });
  }

  /**
   * Planifie l'exécution du batch
   */
  private planifierBatch(): void {
    if (this.batchPlanifie) return;
    this.batchPlanifie = true;

    // Exécuter le batch au prochain tick ou après le délai
    const executerBatch = () => {
      this.batchPlanifie = false;
      this.executerBatch();
    };

    if (this.options.delaieBatch > 0) {
      setTimeout(executerBatch, this.options.delaieBatch);
    } else {
      // Utiliser queueMicrotask pour le prochain microtask
      queueMicrotask(executerBatch);
    }
  }

  /**
   * Exécute le batch de requêtes en attente
   */
  private async executerBatch(): Promise<void> {
    // Récupérer toutes les requêtes en attente
    const requetes = this.requetesEnAttente.splice(0);
    if (requetes.length === 0) return;

    // Diviser en sous-batches si nécessaire
    const sousBatches: RequeteEnAttente<K, V>[][] = [];
    for (let i = 0; i < requetes.length; i += this.options.tailleMaxBatch) {
      sousBatches.push(requetes.slice(i, i + this.options.tailleMaxBatch));
    }

    // Exécuter chaque sous-batch
    for (const sousBatch of sousBatches) {
      await this.executerSousBatch(sousBatch);
    }
  }

  /**
   * Exécute un sous-batch
   */
  private async executerSousBatch(requetes: RequeteEnAttente<K, V>[]): Promise<void> {
    const cles = requetes.map(r => r.cle);

    try {
      const resultats = await this.chargerBatch(cles);

      // Vérifier que le nombre de résultats correspond
      if (resultats.length !== cles.length) {
        const erreur = new Error(
          `DataLoader: le nombre de résultats (${resultats.length}) ne correspond pas au nombre de clés (${cles.length})`,
        );
        requetes.forEach(r => r.reject(erreur));
        return;
      }

      // Distribuer les résultats
      requetes.forEach((requete, index) => {
        const resultat = resultats[index];
        const cleString = this.cleCache(requete.cle);

        if (resultat instanceof Error) {
          requete.reject(resultat);
        } else {
          this.mettreEnCache(cleString, resultat as V);
          requete.resolve(resultat as V);
        }
      });
    } catch (erreur) {
      // En cas d'erreur globale, rejeter toutes les requêtes
      const erreurTypee = erreur instanceof Error ? erreur : new Error(String(erreur));
      requetes.forEach(r => r.reject(erreurTypee));
    }
  }
}

/**
 * Factory pour créer des DataLoaders courants
 */
export const dataLoaderFactory = {
  /**
   * Crée un DataLoader pour charger des entités par ID
   */
  pourEntites<T extends { id: string }>(
    chargerParIds: (ids: string[]) => Promise<T[]>,
    options?: OptionsDataLoader,
  ): DataLoader<string, T | null> {
    return new DataLoader<string, T | null>(
      async (ids: string[]) => {
        const entites = await chargerParIds(ids);
        const map = new Map(entites.map(e => [e.id, e]));
        return ids.map(id => map.get(id) ?? null);
      },
      options,
    );
  },

  /**
   * Crée un DataLoader pour charger des listes d'entités par clé parente
   */
  pourRelations<T>(
    chargerParClesParentes: (cles: string[]) => Promise<Map<string, T[]>>,
    options?: OptionsDataLoader,
  ): DataLoader<string, T[]> {
    return new DataLoader<string, T[]>(
      async (cles: string[]) => {
        const map = await chargerParClesParentes(cles);
        return cles.map(cle => map.get(cle) ?? []);
      },
      options,
    );
  },

  /**
   * Crée un DataLoader pour compter des éléments par clé
   */
  pourComptage(
    compterParCles: (cles: string[]) => Promise<Map<string, number>>,
    options?: OptionsDataLoader,
  ): DataLoader<string, number> {
    return new DataLoader<string, number>(
      async (cles: string[]) => {
        const map = await compterParCles(cles);
        return cles.map(cle => map.get(cle) ?? 0);
      },
      options,
    );
  },
};

/**
 * Contexte pour gérer les DataLoaders par requête
 * Chaque requête HTTP devrait avoir son propre contexte
 */
export class ContexteDataLoaders {
  private loaders = new Map<string, DataLoader<unknown, unknown>>();

  /**
   * Récupère ou crée un DataLoader
   */
  obtenir<K, V>(
    nom: string,
    creer: () => DataLoader<K, V>,
  ): DataLoader<K, V> {
    let loader = this.loaders.get(nom);
    if (!loader) {
      loader = creer() as DataLoader<unknown, unknown>;
      this.loaders.set(nom, loader);
    }
    return loader as DataLoader<K, V>;
  }

  /**
   * Vide tous les caches des loaders
   */
  viderTousLesCaches(): void {
    for (const loader of this.loaders.values()) {
      loader.viderCache();
    }
  }

  /**
   * Retourne les statistiques de tous les loaders
   */
  obtenirStatistiques(): Record<string, ReturnType<DataLoader<unknown, unknown>['obtenirStatistiques']>> {
    const stats: Record<string, ReturnType<DataLoader<unknown, unknown>['obtenirStatistiques']>> = {};
    for (const [nom, loader] of this.loaders) {
      stats[nom] = loader.obtenirStatistiques();
    }
    return stats;
  }
}

/**
 * Crée un nouveau contexte de DataLoaders
 * À appeler au début de chaque requête HTTP
 */
export function creerContexteDataLoaders(): ContexteDataLoaders {
  return new ContexteDataLoaders();
}
