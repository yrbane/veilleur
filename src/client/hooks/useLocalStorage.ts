/**
 * Veilleur - Hook useLocalStorage
 * Persistance d'état dans localStorage avec synchronisation
 *
 * Fonctionnalités:
 * - Persistance automatique
 * - Synchronisation entre onglets
 * - Serialization/deserialization JSON
 * - Support des valeurs initiales paresseuses
 * - Gestion des erreurs
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================
// TYPES
// ============================================================

type SetValue<T> = T | ((prev: T) => T);

interface UseLocalStorageOptions<T> {
  // Fonction de serialization personnalisée
  serialize?: (value: T) => string;
  // Fonction de deserialization personnalisée
  deserialize?: (value: string) => T;
  // Synchroniser entre onglets (défaut: true)
  syncTabs?: boolean;
  // Callback en cas d'erreur
  onError?: (error: Error) => void;
}

interface UseLocalStorageReturn<T> {
  value: T;
  setValue: (value: SetValue<T>) => void;
  removeValue: () => void;
  isLoading: boolean;
  error: Error | null;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Vérifie si localStorage est disponible
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serializer par défaut
 */
function defaultSerialize<T>(value: T): string {
  return JSON.stringify(value);
}

/**
 * Deserializer par défaut
 */
function defaultDeserialize<T>(value: string): T {
  return JSON.parse(value) as T;
}

// ============================================================
// USE LOCAL STORAGE
// ============================================================

/**
 * Hook pour persister une valeur dans localStorage
 * @param key - Clé de stockage
 * @param initialValue - Valeur initiale (ou fonction retournant la valeur)
 * @param options - Options de configuration
 *
 * @example
 * const { value, setValue, removeValue } = useLocalStorage('theme', 'light');
 *
 * // Avec valeur initiale paresseuse
 * const { value } = useLocalStorage('settings', () => computeDefaultSettings());
 *
 * // Avec serialization personnalisée
 * const { value } = useLocalStorage('date', new Date(), {
 *   serialize: (d) => d.toISOString(),
 *   deserialize: (s) => new Date(s),
 * });
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
  options: UseLocalStorageOptions<T> = {},
): UseLocalStorageReturn<T> {
  const {
    serialize = defaultSerialize,
    deserialize = defaultDeserialize,
    syncTabs = true,
    onError,
  } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Calculer la valeur initiale une seule fois
  const computedInitialValue = useMemo(() => {
    return typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue;
  }, [initialValue]);

  // État interne
  const [storedValue, setStoredValue] = useState<T>(computedInitialValue);

  // Lire la valeur stockée au montage
  useEffect(() => {
    if (!isLocalStorageAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(deserialize(item));
      }
      setIsLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      setIsLoading(false);
    }
  }, [key, deserialize, onError]);

  // Setter avec persistance
  const setValue = useCallback(
    (value: SetValue<T>) => {
      try {
        const newValue =
          typeof value === 'function'
            ? (value as (prev: T) => T)(storedValue)
            : value;

        setStoredValue(newValue);
        setError(null);

        if (isLocalStorageAvailable()) {
          window.localStorage.setItem(key, serialize(newValue));
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    },
    [key, serialize, storedValue, onError],
  );

  // Supprimer la valeur
  const removeValue = useCallback(() => {
    try {
      setStoredValue(computedInitialValue);
      setError(null);

      if (isLocalStorageAvailable()) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [key, computedInitialValue, onError]);

  // Synchronisation entre onglets
  useEffect(() => {
    if (!syncTabs || !isLocalStorageAvailable()) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key) return;

      try {
        if (e.newValue === null) {
          setStoredValue(computedInitialValue);
        } else {
          setStoredValue(deserialize(e.newValue));
        }
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, deserialize, computedInitialValue, syncTabs, onError]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    isLoading,
    error,
  };
}

// ============================================================
// USE LOCAL STORAGE SIMPLE
// ============================================================

/**
 * Version simplifiée retournant juste [value, setValue]
 * @param key - Clé de stockage
 * @param initialValue - Valeur initiale
 *
 * @example
 * const [theme, setTheme] = useLocalStorageSimple('theme', 'light');
 */
export function useLocalStorageSimple<T>(
  key: string,
  initialValue: T,
): [T, (value: SetValue<T>) => void] {
  const { value, setValue } = useLocalStorage(key, initialValue);
  return [value, setValue];
}

// ============================================================
// USE LOCAL STORAGE OBJECT
// ============================================================

/**
 * Hook spécialisé pour les objets avec mise à jour partielle
 * @param key - Clé de stockage
 * @param initialValue - Objet initial
 *
 * @example
 * const { value, setValue, updateValue, resetValue } = useLocalStorageObject(
 *   'settings',
 *   { theme: 'light', fontSize: 14 }
 * );
 *
 * // Mise à jour partielle
 * updateValue({ theme: 'dark' });
 */
export function useLocalStorageObject<T extends Record<string, unknown>>(
  key: string,
  initialValue: T,
): {
  value: T;
  setValue: (value: T) => void;
  updateValue: (partial: Partial<T>) => void;
  resetValue: () => void;
  removeValue: () => void;
} {
  const { value, setValue, removeValue } = useLocalStorage<T>(key, initialValue);

  const updateValue = useCallback(
    (partial: Partial<T>) => {
      setValue(prev => ({ ...prev, ...partial }));
    },
    [setValue],
  );

  const resetValue = useCallback(() => {
    setValue(initialValue);
  }, [setValue, initialValue]);

  return {
    value,
    setValue,
    updateValue,
    resetValue,
    removeValue,
  };
}

// ============================================================
// USE SESSION STORAGE
// ============================================================

/**
 * Hook pour persister une valeur dans sessionStorage
 * Même API que useLocalStorage mais avec sessionStorage
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T | (() => T),
  options: Omit<UseLocalStorageOptions<T>, 'syncTabs'> = {},
): UseLocalStorageReturn<T> {
  const {
    serialize = defaultSerialize,
    deserialize = defaultDeserialize,
    onError,
  } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const computedInitialValue = useMemo(() => {
    return typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue;
  }, [initialValue]);

  const [storedValue, setStoredValue] = useState<T>(computedInitialValue);

  useEffect(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      if (item !== null) {
        setStoredValue(deserialize(item));
      }
      setIsLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      setIsLoading(false);
    }
  }, [key, deserialize, onError]);

  const setValue = useCallback(
    (value: SetValue<T>) => {
      try {
        const newValue =
          typeof value === 'function'
            ? (value as (prev: T) => T)(storedValue)
            : value;

        setStoredValue(newValue);
        setError(null);
        window.sessionStorage.setItem(key, serialize(newValue));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    },
    [key, serialize, storedValue, onError],
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(computedInitialValue);
      setError(null);
      window.sessionStorage.removeItem(key);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [key, computedInitialValue, onError]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    isLoading,
    error,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export default useLocalStorage;
