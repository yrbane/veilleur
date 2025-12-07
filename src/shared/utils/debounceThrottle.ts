/**
 * Veilleur - Utilitaires debounce et throttle
 * Optimisation des appels de fonction fréquents
 *
 * Fonctionnalités:
 * - Debounce avec leading/trailing edge
 * - Throttle avec options
 * - AbortController intégré
 * - Support async
 * - Versions React hooks compatibles
 */

// ============================================================
// DEBOUNCE
// ============================================================

/**
 * Options de debounce
 */
export interface OptionsDebounce {
  // Exécuter immédiatement au premier appel
  leading?: boolean;
  // Exécuter à la fin du délai (défaut: true)
  trailing?: boolean;
  // Délai maximum avant exécution forcée
  maxAttente?: number;
}

/**
 * Fonction debounced avec méthodes cancel et flush
 */
export interface FonctionDebounced<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
  pending: () => boolean;
}

/**
 * Crée une fonction debounced
 * N'exécute la fonction qu'après un délai sans nouvel appel
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delai: number,
  options: OptionsDebounce = {},
): FonctionDebounced<T> {
  const { leading = false, trailing = true, maxAttente } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let dernierAppel: number | null = null;
  let dernierExec: number | null = null;
  let derniersArgs: Parameters<T> | null = null;
  let resultat: ReturnType<T> | undefined;

  const invoquer = (temps: number): ReturnType<T> | undefined => {
    const args = derniersArgs;
    derniersArgs = null;
    dernierExec = temps;

    if (args) {
      resultat = fn(...args) as ReturnType<T>;
    }
    return resultat;
  };

  const doitInvoquer = (temps: number): boolean => {
    if (dernierAppel === null) return true;
    const depuisDernierAppel = temps - dernierAppel;
    const depuisDernierExec = dernierExec === null ? delai : temps - dernierExec;

    return (
      depuisDernierAppel >= delai ||
      (maxAttente !== undefined && depuisDernierExec >= maxAttente)
    );
  };

  const planifier = (temps: number): void => {
    const restant = delai - (temps - (dernierAppel ?? temps));
    timeoutId = setTimeout(() => {
      const maintenant = Date.now();
      if (trailing && derniersArgs) {
        invoquer(maintenant);
      }
      timeoutId = null;
      derniersArgs = null;
    }, restant);
  };

  const debounced = function (
    this: unknown,
    ...args: Parameters<T>
  ): ReturnType<T> | undefined {
    const maintenant = Date.now();
    const peutInvoquer = doitInvoquer(maintenant);

    derniersArgs = args;
    dernierAppel = maintenant;

    if (peutInvoquer) {
      if (timeoutId === null && leading) {
        return invoquer(maintenant);
      }

      if (maxAttente !== undefined && maxTimeoutId === null) {
        maxTimeoutId = setTimeout(() => {
          maxTimeoutId = null;
          if (derniersArgs) {
            invoquer(Date.now());
          }
        }, maxAttente);
      }
    }

    if (timeoutId === null) {
      planifier(maintenant);
    }

    return resultat;
  } as FonctionDebounced<T>;

  debounced.cancel = (): void => {
    if (timeoutId) clearTimeout(timeoutId);
    if (maxTimeoutId) clearTimeout(maxTimeoutId);
    timeoutId = null;
    maxTimeoutId = null;
    dernierAppel = null;
    dernierExec = null;
    derniersArgs = null;
  };

  debounced.flush = (): ReturnType<T> | undefined => {
    if (derniersArgs) {
      debounced.cancel();
      return invoquer(Date.now());
    }
    return resultat;
  };

  debounced.pending = (): boolean => {
    return timeoutId !== null;
  };

  return debounced;
}

// ============================================================
// THROTTLE
// ============================================================

/**
 * Options de throttle
 */
export interface OptionsThrottle {
  // Exécuter au début de l'intervalle (défaut: true)
  leading?: boolean;
  // Exécuter à la fin de l'intervalle (défaut: true)
  trailing?: boolean;
}

/**
 * Fonction throttled avec méthode cancel
 */
export interface FonctionThrottled<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel: () => void;
}

/**
 * Crée une fonction throttled
 * N'exécute la fonction qu'une fois par intervalle
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  intervalle: number,
  options: OptionsThrottle = {},
): FonctionThrottled<T> {
  const { leading = true, trailing = true } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let dernierExec = 0;
  let derniersArgs: Parameters<T> | null = null;
  let resultat: ReturnType<T> | undefined;

  const executer = (): void => {
    dernierExec = Date.now();
    if (derniersArgs) {
      resultat = fn(...derniersArgs) as ReturnType<T>;
      derniersArgs = null;
    }
  };

  const throttled = function (
    this: unknown,
    ...args: Parameters<T>
  ): ReturnType<T> | undefined {
    const maintenant = Date.now();
    const restant = intervalle - (maintenant - dernierExec);

    derniersArgs = args;

    if (restant <= 0 || restant > intervalle) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (leading || dernierExec !== 0) {
        executer();
      } else {
        dernierExec = maintenant;
      }
    } else if (timeoutId === null && trailing) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        executer();
      }, restant);
    }

    return resultat;
  } as FonctionThrottled<T>;

  throttled.cancel = (): void => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    derniersArgs = null;
    dernierExec = 0;
  };

  return throttled;
}

// ============================================================
// DEBOUNCE ASYNC
// ============================================================

/**
 * Crée une fonction debounced qui retourne une Promise
 * Utile pour les appels API
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  delai: number,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: ((value: Awaited<ReturnType<T>>) => void) | null = null;
  let pendingReject: ((reason: unknown) => void) | null = null;

  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        // Rejeter la promesse précédente
        if (pendingReject) {
          pendingReject(new Error('Debounced'));
        }
      }

      pendingResolve = resolve;
      pendingReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          if (pendingResolve) {
            pendingResolve(result as Awaited<ReturnType<T>>);
          }
        } catch (error) {
          if (pendingReject) {
            pendingReject(error);
          }
        } finally {
          timeoutId = null;
          pendingResolve = null;
          pendingReject = null;
        }
      }, delai);
    });
  };
}

// ============================================================
// UTILITAIRES SUPPLÉMENTAIRES
// ============================================================

/**
 * Rate limiter qui garantit un nombre max d'appels par période
 */
export function rateLimiter<T extends (...args: unknown[]) => unknown>(
  fn: T,
  maxAppels: number,
  periode: number,
): (...args: Parameters<T>) => ReturnType<T> | null {
  const appels: number[] = [];

  return (...args: Parameters<T>): ReturnType<T> | null => {
    const maintenant = Date.now();
    const seuil = maintenant - periode;

    // Nettoyer les anciens appels
    while (appels.length > 0 && (appels[0] ?? 0) < seuil) {
      appels.shift();
    }

    if (appels.length >= maxAppels) {
      return null; // Rate limit atteint
    }

    appels.push(maintenant);
    return fn(...args) as ReturnType<T>;
  };
}

/**
 * Exécute une fonction au prochain frame d'animation
 */
export function enAnimationFrame<T extends (...args: unknown[]) => unknown>(
  fn: T,
): (...args: Parameters<T>) => void {
  let frameId: number | null = null;
  let derniersArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>): void => {
    derniersArgs = args;

    if (frameId === null) {
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (derniersArgs) {
          fn(...derniersArgs);
        }
      });
    }
  };
}

/**
 * Exécute une fonction au prochain tick idle
 */
export function enIdleCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: IdleRequestOptions,
): (...args: Parameters<T>) => void {
  let callbackId: number | null = null;
  let derniersArgs: Parameters<T> | null = null;

  // Fallback pour navigateurs sans requestIdleCallback
  const requestIdle =
    typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: IdleRequestCallback, _opts?: IdleRequestOptions) => setTimeout(cb as unknown as () => void, 1);

  const cancelIdle =
    typeof cancelIdleCallback !== 'undefined'
      ? cancelIdleCallback
      : clearTimeout;

  return (...args: Parameters<T>): void => {
    derniersArgs = args;

    if (callbackId !== null) {
      cancelIdle(callbackId);
    }

    callbackId = requestIdle(
      () => {
        callbackId = null;
        if (derniersArgs) {
          fn(...derniersArgs);
        }
      },
      options,
    ) as number;
  };
}

/**
 * Leading edge debounce - exécute immédiatement puis ignore les appels suivants
 */
export function leadingDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delai: number,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return debounce(fn, delai, { leading: true, trailing: false });
}

/**
 * Trailing edge debounce - exécute uniquement à la fin (par défaut)
 */
export function trailingDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delai: number,
): FonctionDebounced<T> {
  return debounce(fn, delai, { leading: false, trailing: true });
}
