/**
 * Veilleur - Système d'événements typé
 * Event emitter type-safe pour communication inter-composants
 *
 * Fonctionnalités:
 * - Événements typés avec TypeScript
 * - Abonnement/désabonnement
 * - Handlers once
 * - Wildcard listeners
 * - Statistiques d'utilisation
 */

// ============================================================
// TYPES
// ============================================================

/**
 * Type pour un handler d'événement
 */
type Handler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Map des événements avec leurs types de données
 */
export interface MapEvenements extends Record<string, unknown> {
  // Événements d'articles
  'article:lu': { articleId: string };
  'article:favori': { articleId: string; estFavori: boolean };
  'article:archive': { articleId: string };
  'articles:rafraichis': { sourceId?: string; nombre: number };
  'articles:tous-lus': { sourceId?: string };

  // Événements de sources
  'source:ajoutee': { sourceId: string; url: string };
  'source:supprimee': { sourceId: string };
  'source:sync-debut': { sourceId: string };
  'source:sync-fin': { sourceId: string; succes: boolean; nouveaux?: number };
  'source:erreur': { sourceId: string; erreur: string };

  // Événements utilisateur
  'utilisateur:connecte': { utilisateurId: string };
  'utilisateur:deconnecte': void;
  'utilisateur:preferences-maj': { preferences: Record<string, unknown> };

  // Événements UI
  'ui:theme-change': { theme: 'clair' | 'sombre' | 'auto' };
  'ui:sidebar-toggle': { ouvert: boolean };
  'ui:notification': { type: 'succes' | 'erreur' | 'info' | 'warning'; message: string };
  'ui:modal-ouverte': { id: string };
  'ui:modal-fermee': { id: string };

  // Événements réseau
  'reseau:online': void;
  'reseau:offline': void;
  'reseau:lent': void;

  // Événements génériques
  [key: `custom:${string}`]: unknown;
}

// ============================================================
// EVENT EMITTER
// ============================================================

/**
 * Émetteur d'événements typé
 */
export class EmetteurEvenements<T extends Record<string, unknown> = MapEvenements> {
  private handlers = new Map<keyof T | '*', Set<Handler<unknown>>>();
  private handlersOnce = new Map<keyof T, Set<Handler<unknown>>>();
  private stats = {
    emis: 0,
    abonnements: 0,
    desabonnements: 0,
  };

  /**
   * S'abonne à un événement
   */
  on<K extends keyof T>(event: K, handler: Handler<T[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as Handler<unknown>);
    this.stats.abonnements++;

    // Retourne une fonction de désabonnement
    return () => this.off(event, handler);
  }

  /**
   * S'abonne à un événement une seule fois
   */
  once<K extends keyof T>(event: K, handler: Handler<T[K]>): () => void {
    if (!this.handlersOnce.has(event)) {
      this.handlersOnce.set(event, new Set());
    }
    this.handlersOnce.get(event)!.add(handler as Handler<unknown>);
    this.stats.abonnements++;

    return () => {
      this.handlersOnce.get(event)?.delete(handler as Handler<unknown>);
      this.stats.desabonnements++;
    };
  }

  /**
   * Se désabonne d'un événement
   */
  off<K extends keyof T>(event: K, handler: Handler<T[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
    this.handlersOnce.get(event)?.delete(handler as Handler<unknown>);
    this.stats.desabonnements++;
  }

  /**
   * S'abonne à tous les événements
   */
  onAny(handler: Handler<{ event: keyof T; data: unknown }>): () => void {
    if (!this.handlers.has('*')) {
      this.handlers.set('*', new Set());
    }
    this.handlers.get('*')!.add(handler as Handler<unknown>);
    this.stats.abonnements++;

    return () => {
      this.handlers.get('*')?.delete(handler as Handler<unknown>);
      this.stats.desabonnements++;
    };
  }

  /**
   * Émet un événement
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.stats.emis++;

    // Handlers réguliers
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Erreur handler événement ${String(event)}:`, error);
        }
      });
    }

    // Handlers once
    const handlersOnce = this.handlersOnce.get(event);
    if (handlersOnce) {
      handlersOnce.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Erreur handler once événement ${String(event)}:`, error);
        }
      });
      this.handlersOnce.delete(event);
    }

    // Wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          (handler as Handler<{ event: keyof T; data: unknown }>)({ event, data });
        } catch (error) {
          console.error(`Erreur handler wildcard:`, error);
        }
      });
    }
  }

  /**
   * Émet un événement et attend tous les handlers async
   */
  async emitAsync<K extends keyof T>(event: K, data: T[K]): Promise<void> {
    this.stats.emis++;

    const promises: Promise<void>[] = [];

    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      });
    }

    const handlersOnce = this.handlersOnce.get(event);
    if (handlersOnce) {
      handlersOnce.forEach(handler => {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      });
      this.handlersOnce.delete(event);
    }

    await Promise.all(promises);
  }

  /**
   * Vérifie si un événement a des abonnés
   */
  hasListeners<K extends keyof T>(event: K): boolean {
    return (
      (this.handlers.get(event)?.size ?? 0) > 0 ||
      (this.handlersOnce.get(event)?.size ?? 0) > 0
    );
  }

  /**
   * Compte le nombre d'abonnés pour un événement
   */
  listenerCount<K extends keyof T>(event: K): number {
    return (
      (this.handlers.get(event)?.size ?? 0) +
      (this.handlersOnce.get(event)?.size ?? 0)
    );
  }

  /**
   * Supprime tous les abonnés d'un événement
   */
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.handlers.delete(event);
      this.handlersOnce.delete(event);
    } else {
      this.handlers.clear();
      this.handlersOnce.clear();
    }
  }

  /**
   * Obtient les statistiques
   */
  obtenirStatistiques(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Liste les événements avec abonnés
   */
  evenementsActifs(): (keyof T)[] {
    const events = new Set<keyof T>();
    this.handlers.forEach((_, key) => {
      if (key !== '*') events.add(key as keyof T);
    });
    this.handlersOnce.forEach((_, key) => events.add(key));
    return [...events];
  }
}

// ============================================================
// INSTANCE GLOBALE
// ============================================================

/**
 * Instance globale de l'émetteur d'événements
 */
export const evenements = new EmetteurEvenements<MapEvenements>();

// ============================================================
// HELPERS
// ============================================================

/**
 * Crée un handler qui s'exécute maximum N fois
 */
export function nombreFois<T>(
  n: number,
  handler: Handler<T>,
): Handler<T> {
  let compteur = 0;
  return (data: T) => {
    if (compteur < n) {
      compteur++;
      handler(data);
    }
  };
}

/**
 * Crée un handler qui ne s'exécute qu'après N appels
 */
export function apresNAppels<T>(
  n: number,
  handler: Handler<T>,
): Handler<T> {
  let compteur = 0;
  return (data: T) => {
    compteur++;
    if (compteur >= n) {
      handler(data);
    }
  };
}

/**
 * Crée un handler debounced
 */
export function handlerDebounce<T>(
  handler: Handler<T>,
  delai: number,
): Handler<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let dernieresDonnees: T;

  return (data: T) => {
    dernieresDonnees = data;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      handler(dernieresDonnees);
    }, delai);
  };
}

/**
 * Attends un événement spécifique
 */
export function attendreEvenement<K extends keyof MapEvenements>(
  emetteur: EmetteurEvenements<MapEvenements>,
  event: K,
  timeout?: number,
): Promise<MapEvenements[K]> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = emetteur.once(event, (data) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve(data);
    });

    if (timeout) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout attente événement ${String(event)}`));
      }, timeout);
    }
  });
}
