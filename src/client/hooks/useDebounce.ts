/**
 * Veilleur - Hook useDebounce
 * Debounce des valeurs et callbacks pour React
 *
 * Fonctionnalités:
 * - Debounce de valeurs
 * - Debounce de callbacks
 * - Annulation automatique au démontage
 * - Flush et cancel disponibles
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================
// USE DEBOUNCED VALUE
// ============================================================

/**
 * Hook pour obtenir une valeur debounced
 * @param value - Valeur à debouncer
 * @param delai - Délai en ms (défaut: 300)
 * @returns Valeur debounced
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 500);
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delai: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delai);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delai]);

  return debouncedValue;
}

// ============================================================
// USE DEBOUNCED CALLBACK
// ============================================================

interface DebouncedCallbackResult<T extends (...args: Parameters<T>) => void> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
}

/**
 * Hook pour obtenir un callback debounced
 * @param callback - Fonction à debouncer
 * @param delai - Délai en ms (défaut: 300)
 * @param deps - Dépendances du callback
 * @returns Callback debounced avec méthodes cancel et flush
 *
 * @example
 * const handleSearch = useDebouncedCallback(
 *   (query: string) => {
 *     fetchResults(query);
 *   },
 *   500,
 *   []
 * );
 *
 * return <input onChange={(e) => handleSearch(e.target.value)} />;
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delai: number = 300,
  deps: React.DependencyList = [],
): DebouncedCallbackResult<T> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);
  const pendingRef = useRef(false);

  // Mettre à jour la référence du callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Nettoyer au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useMemo(() => {
    const debounced = (...args: Parameters<T>): void => {
      argsRef.current = args;
      pendingRef.current = true;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        pendingRef.current = false;
        timeoutRef.current = null;
        if (argsRef.current) {
          callbackRef.current(...argsRef.current);
        }
      }, delai);
    };

    debounced.cancel = (): void => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        pendingRef.current = false;
        argsRef.current = null;
      }
    };

    debounced.flush = (): void => {
      if (timeoutRef.current && argsRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        pendingRef.current = false;
        callbackRef.current(...argsRef.current);
        argsRef.current = null;
      }
    };

    debounced.pending = (): boolean => {
      return pendingRef.current;
    };

    return debounced;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delai, ...deps]);

  return debouncedCallback;
}

// ============================================================
// USE DEBOUNCED STATE
// ============================================================

/**
 * Hook combinant state et valeur debounced
 * @param initialValue - Valeur initiale
 * @param delai - Délai en ms (défaut: 300)
 * @returns [valeur, valeurDebounced, setValeur]
 *
 * @example
 * const [search, debouncedSearch, setSearch] = useDebouncedState('', 500);
 *
 * return (
 *   <>
 *     <input value={search} onChange={(e) => setSearch(e.target.value)} />
 *     <SearchResults query={debouncedSearch} />
 *   </>
 * );
 */
export function useDebouncedState<T>(
  initialValue: T,
  delai: number = 300,
): [T, T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialValue);
  const debouncedValue = useDebounce(value, delai);

  return [value, debouncedValue, setValue];
}

// ============================================================
// USE DEBOUNCED EFFECT
// ============================================================

/**
 * Hook pour exécuter un effet après un délai
 * @param effect - Effet à exécuter
 * @param deps - Dépendances
 * @param delai - Délai en ms (défaut: 300)
 *
 * @example
 * const [search, setSearch] = useState('');
 *
 * useDebouncedEffect(
 *   () => {
 *     if (search) {
 *       fetchResults(search);
 *     }
 *   },
 *   [search],
 *   500
 * );
 */
export function useDebouncedEffect(
  effect: React.EffectCallback,
  deps: React.DependencyList,
  delai: number = 300,
): void {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      effect();
    }, delai);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delai]);
}

// ============================================================
// USE DEBOUNCED MEMO
// ============================================================

/**
 * Hook pour mémoiser une valeur avec debounce
 * @param factory - Fonction de création
 * @param deps - Dépendances
 * @param delai - Délai en ms (défaut: 300)
 * @returns Valeur mémorisée debounced
 *
 * @example
 * const expensiveValue = useDebouncedMemo(
 *   () => computeExpensiveValue(input),
 *   [input],
 *   500
 * );
 */
export function useDebouncedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  delai: number = 300,
): T {
  const [value, setValue] = useState<T>(factory);
  const factoryRef = useRef(factory);

  useEffect(() => {
    factoryRef.current = factory;
  }, [factory]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setValue(factoryRef.current());
    }, delai);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delai]);

  return value;
}

// ============================================================
// EXPORTS
// ============================================================

export default useDebounce;
