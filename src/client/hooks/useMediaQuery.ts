/**
 * Veilleur - Hook useMediaQuery
 * Détection des media queries pour design responsive
 *
 * Fonctionnalités:
 * - Détection media query dynamique
 * - Breakpoints prédéfinis
 * - SSR compatible
 * - Hooks spécialisés (mobile, tablet, desktop)
 */

import { useState, useEffect, useMemo } from 'react';

// ============================================================
// TYPES ET CONSTANTES
// ============================================================

/**
 * Breakpoints par défaut (basés sur Tailwind CSS)
 */
export const BREAKPOINTS = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

type BreakpointKey = keyof typeof BREAKPOINTS;

// ============================================================
// USE MEDIA QUERY
// ============================================================

/**
 * Hook pour détecter une media query
 * @param query - La media query à tester
 * @param defaultValue - Valeur par défaut (pour SSR)
 *
 * @example
 * const isDark = useMediaQuery('(prefers-color-scheme: dark)');
 * const isLarge = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState<boolean>(defaultValue);

  useEffect(() => {
    // Vérifier si window est disponible (SSR)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    // Définir l'état initial
    setMatches(mediaQuery.matches);

    // Handler pour les changements
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Utiliser addEventListener si disponible (moderne)
    // sinon addListener (ancien, pour compatibilité)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // @ts-expect-error - addListener est deprecated mais nécessaire pour Safari < 14
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        // @ts-expect-error - removeListener est deprecated
        mediaQuery.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}

// ============================================================
// USE BREAKPOINT
// ============================================================

/**
 * Hook pour détecter un breakpoint spécifique
 * @param breakpoint - Nom du breakpoint ou valeur custom
 * @param type - Type de comparaison (min ou max)
 *
 * @example
 * const isMd = useBreakpoint('md'); // min-width: 768px
 * const isSmallOrLess = useBreakpoint('sm', 'max');
 */
export function useBreakpoint(
  breakpoint: BreakpointKey | string,
  type: 'min' | 'max' = 'min',
): boolean {
  const value = (breakpoint in BREAKPOINTS)
    ? BREAKPOINTS[breakpoint as BreakpointKey]
    : breakpoint;

  const query = `(${type}-width: ${value})`;
  return useMediaQuery(query);
}

// ============================================================
// HOOKS PRÉDÉFINIS
// ============================================================

/**
 * Détecte si on est sur mobile (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md})`);
}

/**
 * Détecte si on est sur tablette (768px - 1024px)
 */
export function useIsTablet(): boolean {
  const isMinMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md})`);
  const isMaxLg = useMediaQuery(`(max-width: ${BREAKPOINTS.lg})`);
  return isMinMd && isMaxLg;
}

/**
 * Détecte si on est sur desktop (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg})`);
}

/**
 * Détecte le mode sombre système
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Détecte si l'utilisateur préfère les mouvements réduits
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Détecte si l'utilisateur préfère le contraste élevé
 */
export function usePrefersHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: high)');
}

/**
 * Détecte si l'appareil a un écran tactile
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/**
 * Détecte l'orientation de l'écran
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const isPortrait = useMediaQuery('(orientation: portrait)');
  return isPortrait ? 'portrait' : 'landscape';
}

// ============================================================
// USE RESPONSIVE VALUE
// ============================================================

interface ResponsiveValues<T> {
  base: T;
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}

/**
 * Hook pour obtenir une valeur responsive selon le breakpoint actuel
 * @param values - Objet avec les valeurs par breakpoint
 *
 * @example
 * const columns = useResponsiveValue({
 *   base: 1,
 *   sm: 2,
 *   md: 3,
 *   lg: 4,
 * }); // Retourne 1, 2, 3 ou 4 selon la taille d'écran
 */
export function useResponsiveValue<T>(values: ResponsiveValues<T>): T {
  const is2xl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']})`);
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl})`);
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg})`);
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md})`);
  const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm})`);
  const isXs = useMediaQuery(`(min-width: ${BREAKPOINTS.xs})`);

  return useMemo(() => {
    if (is2xl && values['2xl'] !== undefined) return values['2xl'];
    if (isXl && values.xl !== undefined) return values.xl;
    if (isLg && values.lg !== undefined) return values.lg;
    if (isMd && values.md !== undefined) return values.md;
    if (isSm && values.sm !== undefined) return values.sm;
    if (isXs && values.xs !== undefined) return values.xs;
    return values.base;
  }, [is2xl, isXl, isLg, isMd, isSm, isXs, values]);
}

// ============================================================
// USE CURRENT BREAKPOINT
// ============================================================

/**
 * Hook pour obtenir le breakpoint actuel
 *
 * @example
 * const breakpoint = useCurrentBreakpoint();
 * // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 */
export function useCurrentBreakpoint(): BreakpointKey {
  const is2xl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']})`);
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl})`);
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg})`);
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md})`);
  const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm})`);

  return useMemo(() => {
    if (is2xl) return '2xl';
    if (isXl) return 'xl';
    if (isLg) return 'lg';
    if (isMd) return 'md';
    if (isSm) return 'sm';
    return 'xs';
  }, [is2xl, isXl, isLg, isMd, isSm]);
}

// ============================================================
// USE WINDOW SIZE
// ============================================================

interface WindowSize {
  width: number;
  height: number;
}

/**
 * Hook pour obtenir les dimensions de la fenêtre
 *
 * @example
 * const { width, height } = useWindowSize();
 */
export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => {
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
    return { width: 0, height: 0 };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// ============================================================
// EXPORTS
// ============================================================

export default useMediaQuery;
