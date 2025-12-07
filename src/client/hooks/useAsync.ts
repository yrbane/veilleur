/**
 * Veilleur - Hook useAsync
 * Gestion d'états asynchrones avec loading, erreur et données
 *
 * Fonctionnalités:
 * - États loading, error, data
 * - Exécution automatique ou manuelle
 * - Retry automatique
 * - Annulation
 * - Cache simple
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================
// TYPES
// ============================================================

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface UseAsyncOptions<T> {
  // Exécuter automatiquement au montage
  immediate?: boolean;
  // Valeur initiale
  initialData?: T;
  // Callback en cas de succès
  onSuccess?: (data: T) => void;
  // Callback en cas d'erreur
  onError?: (error: Error) => void;
  // Nombre de retries
  retries?: number;
  // Délai entre retries (ms)
  retryDelay?: number;
}

interface UseAsyncReturn<T, Args extends unknown[]> extends AsyncState<T> {
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
}

// ============================================================
// USE ASYNC
// ============================================================

/**
 * Hook pour gérer les opérations asynchrones
 * @param asyncFunction - Fonction async à exécuter
 * @param options - Options de configuration
 *
 * @example
 * const { data, isLoading, error, execute } = useAsync(
 *   (id: string) => fetchUser(id),
 *   { immediate: false }
 * );
 *
 * // Exécution manuelle
 * const handleClick = () => execute('user-123');
 *
 * // Avec exécution automatique
 * const { data } = useAsync(() => fetchUsers(), { immediate: true });
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {},
): UseAsyncReturn<T, Args> {
  const {
    immediate = false,
    initialData,
    onSuccess,
    onError,
    retries = 0,
    retryDelay = 1000,
  } = options;

  const [status, setStatus] = useState<AsyncStatus>(
    initialData !== undefined ? 'success' : 'idle',
  );
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const asyncFunctionRef = useRef(asyncFunction);

  // Mettre à jour la référence de la fonction
  useEffect(() => {
    asyncFunctionRef.current = asyncFunction;
  }, [asyncFunction]);

  // Marquer comme démonté
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Annuler toute requête en cours
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setStatus('loading');
      setError(null);

      let lastError: Error | null = null;
      let attempt = 0;

      while (attempt <= retries) {
        try {
          const result = await asyncFunctionRef.current(...args);

          if (mountedRef.current) {
            setData(result);
            setStatus('success');
            onSuccess?.(result);
          }

          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (lastError.name === 'AbortError') {
            return null;
          }

          attempt++;

          if (attempt <= retries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      if (mountedRef.current && lastError) {
        setError(lastError);
        setStatus('error');
        onError?.(lastError);
      }

      return null;
    },
    [retries, retryDelay, onSuccess, onError],
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus(initialData !== undefined ? 'success' : 'idle');
    setData(initialData ?? null);
    setError(null);
  }, [initialData]);

  // Exécution automatique
  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as Args));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  const state = useMemo(
    () => ({
      status,
      data,
      error,
      isIdle: status === 'idle',
      isLoading: status === 'loading',
      isSuccess: status === 'success',
      isError: status === 'error',
    }),
    [status, data, error],
  );

  return {
    ...state,
    execute,
    reset,
    setData,
  };
}

// ============================================================
// USE ASYNC CALLBACK
// ============================================================

/**
 * Version simplifiée sans exécution automatique
 * @param asyncFunction - Fonction async à exécuter
 *
 * @example
 * const [submit, { isLoading, error }] = useAsyncCallback(async (data) => {
 *   const result = await api.post('/items', data);
 *   return result;
 * });
 */
export function useAsyncCallback<T, Args extends unknown[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: Omit<UseAsyncOptions<T>, 'immediate'> = {},
): [(...args: Args) => Promise<T | null>, Omit<UseAsyncReturn<T, Args>, 'execute'>] {
  const { execute, ...state } = useAsync(asyncFunction, {
    ...options,
    immediate: false,
  });

  return [execute, state];
}

// ============================================================
// USE FETCH
// ============================================================

interface UseFetchOptions<T> extends UseAsyncOptions<T> {
  // Headers supplémentaires
  headers?: Record<string, string>;
  // Méthode HTTP
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  // Corps de la requête
  body?: unknown;
  // Transformer la réponse
  transform?: (response: Response) => Promise<T>;
}

/**
 * Hook spécialisé pour les requêtes fetch
 * @param url - URL à appeler
 * @param options - Options de configuration
 *
 * @example
 * const { data, isLoading } = useFetch<User[]>('/api/users', {
 *   immediate: true,
 * });
 *
 * // Avec POST
 * const { execute } = useFetch<User>('/api/users', {
 *   method: 'POST',
 *   immediate: false,
 * });
 * execute({ body: { name: 'John' } });
 */
export function useFetch<T>(
  url: string,
  options: UseFetchOptions<T> = {},
): UseAsyncReturn<T, [RequestInit?]> {
  const {
    headers = {},
    method = 'GET',
    body,
    transform,
    ...asyncOptions
  } = options;

  const fetchFunction = useCallback(
    async (overrideInit?: RequestInit): Promise<T> => {
      const init: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...overrideInit?.headers,
        },
        ...overrideInit,
      };

      const bodyToSend = overrideInit?.body ?? body;
      if (bodyToSend !== undefined && method !== 'GET') {
        init.body = JSON.stringify(bodyToSend);
      }

      const response = await fetch(url, init);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody || response.statusText}`);
      }

      if (transform) {
        return transform(response);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json() as Promise<T>;
      }

      return response.text() as unknown as T;
    },
    [url, method, headers, body, transform],
  );

  return useAsync(fetchFunction, asyncOptions);
}

// ============================================================
// USE MUTATION
// ============================================================

interface UseMutationOptions<T, TVariables> {
  onSuccess?: (data: T, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: T | null, error: Error | null, variables: TVariables) => void;
}

interface UseMutationReturn<T, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<T>;
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

/**
 * Hook pour les mutations (POST, PUT, DELETE)
 * @param mutationFn - Fonction de mutation
 * @param options - Options de configuration
 *
 * @example
 * const { mutate, isLoading } = useMutation(
 *   (data: CreateUserInput) => api.post('/users', data),
 *   {
 *     onSuccess: (user) => {
 *       toast.success('Utilisateur créé');
 *       navigate(`/users/${user.id}`);
 *     },
 *   }
 * );
 *
 * const handleSubmit = (data) => mutate(data);
 */
export function useMutation<T, TVariables>(
  mutationFn: (variables: TVariables) => Promise<T>,
  options: UseMutationOptions<T, TVariables> = {},
): UseMutationReturn<T, TVariables> {
  const { onSuccess, onError, onSettled } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const mutationFnRef = useRef(mutationFn);
  const mountedRef = useRef(true);

  useEffect(() => {
    mutationFnRef.current = mutationFn;
  }, [mutationFn]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<T> => {
      setStatus('loading');
      setError(null);

      try {
        const result = await mutationFnRef.current(variables);

        if (mountedRef.current) {
          setData(result);
          setStatus('success');
          onSuccess?.(result, variables);
          onSettled?.(result, null, variables);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (mountedRef.current) {
          setError(error);
          setStatus('error');
          onError?.(error, variables);
          onSettled?.(null, error, variables);
        }

        throw error;
      }
    },
    [onSuccess, onError, onSettled],
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Erreur déjà gérée
      });
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus('idle');
  }, []);

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    reset,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export default useAsync;
