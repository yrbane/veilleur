/**
 * Veilleur - Hook useIntersectionObserver
 * Détection de visibilité des éléments pour lazy loading et infinite scroll
 *
 * Fonctionnalités:
 * - Détection d'intersection basique
 * - Support lazy loading images
 * - Infinite scroll
 * - Animations au scroll
 * - SSR compatible
 */

import { useState, useEffect, useRef, useCallback, RefObject } from 'react';

// ============================================================
// TYPES
// ============================================================

interface UseIntersectionObserverOptions {
  // Seuil de visibilité (0-1 ou tableau)
  threshold?: number | number[];
  // Marge autour de l'élément
  rootMargin?: string;
  // Élément racine (null = viewport)
  root?: Element | null;
  // Déclencher une seule fois
  triggerOnce?: boolean;
  // Activer/désactiver l'observation
  enabled?: boolean;
}

interface IntersectionEntry {
  isIntersecting: boolean;
  intersectionRatio: number;
  boundingClientRect: DOMRectReadOnly;
  intersectionRect: DOMRectReadOnly;
  time: number;
}

// ============================================================
// USE INTERSECTION OBSERVER
// ============================================================

/**
 * Hook pour observer l'intersection d'un élément avec le viewport
 * @param options - Options de l'observer
 *
 * @example
 * const { ref, isIntersecting, entry } = useIntersectionObserver({
 *   threshold: 0.5,
 *   triggerOnce: true,
 * });
 *
 * return (
 *   <div ref={ref}>
 *     {isIntersecting ? 'Visible!' : 'Non visible'}
 *   </div>
 * );
 */
export function useIntersectionObserver<T extends Element = Element>(
  options: UseIntersectionObserverOptions = {},
): {
  ref: RefObject<T>;
  isIntersecting: boolean;
  entry: IntersectionEntry | null;
} {
  const {
    threshold = 0,
    rootMargin = '0px',
    root = null,
    triggerOnce = false,
    enabled = true,
  } = options;

  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionEntry | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const element = ref.current;

    // Vérifications SSR et activation
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') {
      return;
    }

    // Si triggerOnce et déjà déclenché, ne pas réobserver
    if (triggerOnce && hasTriggeredRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;

        setIsIntersecting(entry.isIntersecting);
        setEntry({
          isIntersecting: entry.isIntersecting,
          intersectionRatio: entry.intersectionRatio,
          boundingClientRect: entry.boundingClientRect,
          intersectionRect: entry.intersectionRect,
          time: entry.time,
        });

        // Si triggerOnce et visible, désactiver l'observation
        if (triggerOnce && entry.isIntersecting) {
          hasTriggeredRef.current = true;
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
        root,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [enabled, threshold, rootMargin, root, triggerOnce]);

  return { ref, isIntersecting, entry };
}

// ============================================================
// USE IN VIEW
// ============================================================

/**
 * Version simplifiée retournant juste le booléen de visibilité
 * @param options - Options de l'observer
 *
 * @example
 * const { ref, inView } = useInView({ triggerOnce: true });
 *
 * return (
 *   <div ref={ref} className={inView ? 'animate-in' : ''}>
 *     Content
 *   </div>
 * );
 */
export function useInView<T extends Element = Element>(
  options: UseIntersectionObserverOptions = {},
): {
  ref: RefObject<T>;
  inView: boolean;
} {
  const { ref, isIntersecting } = useIntersectionObserver<T>(options);
  return { ref, inView: isIntersecting };
}

// ============================================================
// USE LAZY LOAD
// ============================================================

interface UseLazyLoadOptions {
  // Marge de pré-chargement
  rootMargin?: string;
  // Callback quand visible
  onLoad?: () => void;
}

/**
 * Hook pour le lazy loading d'images ou de contenu
 * @param options - Options de configuration
 *
 * @example
 * const { ref, isLoaded, shouldLoad } = useLazyLoad();
 *
 * return (
 *   <div ref={ref}>
 *     {shouldLoad && (
 *       <img
 *         src={imageSrc}
 *         onLoad={() => setIsLoaded(true)}
 *       />
 *     )}
 *   </div>
 * );
 */
export function useLazyLoad<T extends Element = Element>(
  options: UseLazyLoadOptions = {},
): {
  ref: RefObject<T>;
  shouldLoad: boolean;
  isLoaded: boolean;
  setIsLoaded: (loaded: boolean) => void;
} {
  const { rootMargin = '50px', onLoad } = options;
  const [isLoaded, setIsLoaded] = useState(false);

  const { ref, isIntersecting } = useIntersectionObserver<T>({
    rootMargin,
    triggerOnce: true,
  });

  useEffect(() => {
    if (isIntersecting && onLoad) {
      onLoad();
    }
  }, [isIntersecting, onLoad]);

  return {
    ref,
    shouldLoad: isIntersecting,
    isLoaded,
    setIsLoaded,
  };
}

// ============================================================
// USE INFINITE SCROLL
// ============================================================

interface UseInfiniteScrollOptions {
  // Distance avant la fin pour déclencher le chargement
  threshold?: number;
  // Marge de détection
  rootMargin?: string;
  // Callback pour charger plus de données
  onLoadMore: () => void | Promise<void>;
  // Y a-t-il plus de données à charger ?
  hasMore: boolean;
  // Est-on en train de charger ?
  isLoading: boolean;
  // Activer/désactiver
  enabled?: boolean;
}

/**
 * Hook pour l'infinite scroll
 * @param options - Options de configuration
 *
 * @example
 * const { ref } = useInfiniteScroll({
 *   onLoadMore: fetchNextPage,
 *   hasMore: hasNextPage,
 *   isLoading: isFetchingNextPage,
 * });
 *
 * return (
 *   <div>
 *     {items.map(item => <Item key={item.id} {...item} />)}
 *     <div ref={ref}>
 *       {isLoading && <Spinner />}
 *     </div>
 *   </div>
 * );
 */
export function useInfiniteScroll<T extends Element = Element>(
  options: UseInfiniteScrollOptions,
): {
  ref: RefObject<T>;
} {
  const {
    threshold = 0,
    rootMargin = '100px',
    onLoadMore,
    hasMore,
    isLoading,
    enabled = true,
  } = options;

  const { ref, isIntersecting } = useIntersectionObserver<T>({
    threshold,
    rootMargin,
    enabled: enabled && hasMore && !isLoading,
  });

  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoading) {
      onLoadMoreRef.current();
    }
  }, [isIntersecting, hasMore, isLoading]);

  return { ref };
}

// ============================================================
// USE SCROLL ANIMATION
// ============================================================

interface UseScrollAnimationOptions {
  // Seuil de visibilité pour déclencher l'animation
  threshold?: number;
  // Marge de détection
  rootMargin?: string;
  // Déclencher une seule fois
  once?: boolean;
  // Délai avant l'animation (ms)
  delay?: number;
}

/**
 * Hook pour les animations au scroll
 * @param options - Options de configuration
 *
 * @example
 * const { ref, shouldAnimate } = useScrollAnimation({
 *   threshold: 0.3,
 *   once: true,
 * });
 *
 * return (
 *   <div
 *     ref={ref}
 *     className={shouldAnimate ? 'animate-fade-in' : 'opacity-0'}
 *   >
 *     Content
 *   </div>
 * );
 */
export function useScrollAnimation<T extends Element = Element>(
  options: UseScrollAnimationOptions = {},
): {
  ref: RefObject<T>;
  shouldAnimate: boolean;
  hasAnimated: boolean;
} {
  const { threshold = 0.1, rootMargin = '0px', once = true, delay = 0 } = options;

  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const { ref, isIntersecting } = useIntersectionObserver<T>({
    threshold,
    rootMargin,
    triggerOnce: once,
  });

  useEffect(() => {
    if (isIntersecting && !hasAnimated) {
      if (delay > 0) {
        const timeoutId = setTimeout(() => {
          setShouldAnimate(true);
          setHasAnimated(true);
        }, delay);
        return () => clearTimeout(timeoutId);
      } else {
        setShouldAnimate(true);
        setHasAnimated(true);
      }
    } else if (!isIntersecting && !once) {
      setShouldAnimate(false);
    }
  }, [isIntersecting, hasAnimated, once, delay]);

  return { ref, shouldAnimate, hasAnimated };
}

// ============================================================
// USE VISIBILITY TRACKING
// ============================================================

interface UseVisibilityTrackingOptions {
  // Temps minimum de visibilité pour considérer comme "vu" (ms)
  minVisibleTime?: number;
  // Ratio minimum de visibilité
  minVisibleRatio?: number;
  // Callback quand l'élément est considéré comme "vu"
  onViewed?: () => void;
}

/**
 * Hook pour tracker la visibilité (analytics, lectures d'articles)
 * @param options - Options de configuration
 *
 * @example
 * const { ref, viewedDuration, wasViewed } = useVisibilityTracking({
 *   minVisibleTime: 3000, // 3 secondes
 *   onViewed: () => markArticleAsRead(),
 * });
 */
export function useVisibilityTracking<T extends Element = Element>(
  options: UseVisibilityTrackingOptions = {},
): {
  ref: RefObject<T>;
  viewedDuration: number;
  wasViewed: boolean;
  isCurrentlyVisible: boolean;
} {
  const {
    minVisibleTime = 1000,
    minVisibleRatio = 0.5,
    onViewed,
  } = options;

  const [viewedDuration, setViewedDuration] = useState(0);
  const [wasViewed, setWasViewed] = useState(false);
  const visibilityStartRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onViewedRef = useRef(onViewed);

  useEffect(() => {
    onViewedRef.current = onViewed;
  }, [onViewed]);

  const { ref, isIntersecting, entry } = useIntersectionObserver<T>({
    threshold: minVisibleRatio,
  });

  const isVisible = isIntersecting && (entry?.intersectionRatio ?? 0) >= minVisibleRatio;

  useEffect(() => {
    if (isVisible && !wasViewed) {
      // Commencer à tracker
      visibilityStartRef.current = Date.now();

      intervalRef.current = setInterval(() => {
        if (visibilityStartRef.current) {
          const duration = Date.now() - visibilityStartRef.current + viewedDuration;
          setViewedDuration(duration);

          if (duration >= minVisibleTime && !wasViewed) {
            setWasViewed(true);
            onViewedRef.current?.();
          }
        }
      }, 100);
    } else {
      // Arrêter de tracker
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (visibilityStartRef.current) {
        setViewedDuration(prev => prev + (Date.now() - visibilityStartRef.current!));
        visibilityStartRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible, wasViewed, minVisibleTime, viewedDuration]);

  return {
    ref,
    viewedDuration,
    wasViewed,
    isCurrentlyVisible: isVisible,
  };
}

// ============================================================
// USE OBSERVE MULTIPLE
// ============================================================

/**
 * Hook pour observer plusieurs éléments
 * @param callback - Callback appelé pour chaque changement
 * @param options - Options de l'observer
 *
 * @example
 * const setRef = useObserveMultiple((entry) => {
 *   console.log(entry.target.id, entry.isIntersecting);
 * });
 *
 * return items.map(item => (
 *   <div key={item.id} ref={setRef} id={item.id}>
 *     {item.content}
 *   </div>
 * ));
 */
export function useObserveMultiple(
  callback: (entry: IntersectionObserverEntry) => void,
  options: Omit<UseIntersectionObserverOptions, 'triggerOnce'> = {},
): (element: Element | null) => void {
  const { threshold = 0, rootMargin = '0px', root = null, enabled = true } = options;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Set<Element>>(new Set());
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => callbackRef.current(entry));
      },
      { threshold, rootMargin, root },
    );

    // Observer les éléments déjà enregistrés
    elementsRef.current.forEach(element => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, threshold, rootMargin, root]);

  const setRef = useCallback((element: Element | null) => {
    if (element) {
      elementsRef.current.add(element);
      observerRef.current?.observe(element);
    }
  }, []);

  return setRef;
}

// ============================================================
// EXPORTS
// ============================================================

export default useIntersectionObserver;
