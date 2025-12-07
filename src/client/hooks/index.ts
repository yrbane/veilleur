/**
 * Veilleur - Export centralisé des hooks React
 * Point d'entrée unique pour tous les hooks personnalisés
 */

// ============================================================
// HOOKS D'ÉTAT ET DONNÉES
// ============================================================

export {
  useAsync,
  useAsyncCallback,
  useFetch,
  useMutation,
} from './useAsync';

export {
  useLocalStorage,
  useLocalStorageSimple,
  useLocalStorageObject,
  useSessionStorage,
} from './useLocalStorage';

export {
  useDebounce,
  useDebouncedCallback,
  useDebouncedState,
  useDebouncedEffect,
  useDebouncedMemo,
} from './useDebounce';

// ============================================================
// HOOKS UI ET INTERACTION
// ============================================================

export {
  useMediaQuery,
  useBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersDarkMode,
  usePrefersReducedMotion,
  usePrefersHighContrast,
  useIsTouchDevice,
  useOrientation,
  useResponsiveValue,
  useCurrentBreakpoint,
  useWindowSize,
  BREAKPOINTS,
} from './useMediaQuery';

export {
  useIntersectionObserver,
  useInView,
  useLazyLoad,
  useInfiniteScroll,
  useScrollAnimation,
  useVisibilityTracking,
  useObserveMultiple,
} from './useIntersectionObserver';

export {
  useKeyboard,
  useHotkey,
  useKeySequence,
  useKeyPressed,
  useKonamiCode,
  useKeyboardNavigation,
  parseShortcut,
  normalizeKey,
} from './useKeyboard';

export {
  useClickOutside,
  useDismiss,
  useFocusTrap,
  usePortal,
  useBodyScrollLock,
  useHover,
  useLongPress,
} from './useClickOutside';

export {
  useClipboard,
  useCopyToClipboard,
  usePasteFromClipboard,
  useClipboardEvent,
  useShare,
  copierTexte,
} from './useClipboard';

// ============================================================
// HOOKS FORMULAIRES
// ============================================================

export {
  useForm,
  // Validateurs
  requis,
  longueurMin,
  longueurMax,
  email,
  pattern,
  valeurMin,
  valeurMax,
  correspondA,
  combiner,
} from './useForm';

// ============================================================
// TYPES EXPORTÉS
// ============================================================

// useAsync types
export type {
  // Les types sont internes aux hooks
} from './useAsync';

// useMediaQuery types
export type {
  // Types pour useMediaQuery
} from './useMediaQuery';

// useForm types - si nécessaire, ajouter des exports de types spécifiques
