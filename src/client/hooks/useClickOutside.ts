/**
 * Veilleur - Hook useClickOutside
 * Détection des clics en dehors d'un élément
 *
 * Fonctionnalités:
 * - Détection click outside
 * - Support de plusieurs refs
 * - Gestion Escape
 * - Focus trap
 */

import { useEffect, useRef, useCallback, RefObject, useState } from 'react';

// ============================================================
// USE CLICK OUTSIDE
// ============================================================

type RefOrElement = RefObject<Element> | Element | null;

/**
 * Hook pour détecter les clics en dehors d'un élément
 * @param handler - Fonction appelée lors d'un clic extérieur
 * @param refs - Éléments à exclure (optionnel, utilise la ref retournée sinon)
 *
 * @example
 * const ref = useClickOutside(() => setIsOpen(false));
 *
 * return (
 *   <div ref={ref}>
 *     <Dropdown />
 *   </div>
 * );
 *
 * // Avec plusieurs refs à exclure
 * const dropdownRef = useRef(null);
 * const buttonRef = useRef(null);
 *
 * useClickOutside(() => setIsOpen(false), [dropdownRef, buttonRef]);
 */
export function useClickOutside<T extends Element = Element>(
  handler: (event: MouseEvent | TouchEvent) => void,
  refs?: RefOrElement[],
): RefObject<T> {
  const ownRef = useRef<T>(null);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      // Vérifier la ref propre
      if (ownRef.current?.contains(target)) {
        return;
      }

      // Vérifier les refs supplémentaires
      if (refs) {
        for (const refOrElement of refs) {
          const element = refOrElement && 'current' in refOrElement
            ? refOrElement.current
            : refOrElement;

          if (element?.contains(target)) {
            return;
          }
        }
      }

      handlerRef.current(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refs]);

  return ownRef;
}

// ============================================================
// USE DISMISS
// ============================================================

interface UseDismissOptions {
  // Fermer sur clic extérieur
  clickOutside?: boolean;
  // Fermer sur Escape
  escape?: boolean;
  // Refs à exclure des clics extérieurs
  excludeRefs?: RefOrElement[];
  // Activer/désactiver
  enabled?: boolean;
}

/**
 * Hook combinant click outside et Escape
 * @param onDismiss - Fonction appelée pour fermer
 * @param options - Options de configuration
 *
 * @example
 * const ref = useDismiss(() => setIsOpen(false), {
 *   clickOutside: true,
 *   escape: true,
 * });
 *
 * return isOpen ? <Modal ref={ref} /> : null;
 */
export function useDismiss<T extends Element = Element>(
  onDismiss: () => void,
  options: UseDismissOptions = {},
): RefObject<T> {
  const {
    clickOutside = true,
    escape = true,
    excludeRefs = [],
    enabled = true,
  } = options;

  const ref = useRef<T>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Click outside
  useEffect(() => {
    if (!enabled || !clickOutside) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      // Vérifier la ref propre
      if (ref.current?.contains(target)) {
        return;
      }

      // Vérifier les refs à exclure
      for (const refOrElement of excludeRefs) {
        const element = refOrElement && 'current' in refOrElement
          ? refOrElement.current
          : refOrElement;

        if (element?.contains(target)) {
          return;
        }
      }

      onDismissRef.current();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [enabled, clickOutside, excludeRefs]);

  // Escape
  useEffect(() => {
    if (!enabled || !escape) return;

    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismissRef.current();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [enabled, escape]);

  return ref;
}

// ============================================================
// USE FOCUS TRAP
// ============================================================

interface UseFocusTrapOptions {
  // Activer/désactiver le trap
  enabled?: boolean;
  // Focus automatique sur le premier élément
  autoFocus?: boolean;
  // Restaurer le focus au démontage
  restoreFocus?: boolean;
  // Sélecteur des éléments focusables
  focusableSelector?: string;
}

const DEFAULT_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Hook pour piéger le focus dans un élément (modales)
 * @param options - Options de configuration
 *
 * @example
 * const ref = useFocusTrap({ enabled: isOpen });
 *
 * return (
 *   <div ref={ref} role="dialog" aria-modal="true">
 *     <button>Premier</button>
 *     <input />
 *     <button>Dernier</button>
 *   </div>
 * );
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: UseFocusTrapOptions = {},
): RefObject<T> {
  const {
    enabled = true,
    autoFocus = true,
    restoreFocus = true,
    focusableSelector = DEFAULT_FOCUSABLE_SELECTOR,
  } = options;

  const ref = useRef<T>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Sauvegarder l'élément précédemment focusé
  useEffect(() => {
    if (enabled) {
      previouslyFocusedRef.current = document.activeElement;
    }
  }, [enabled]);

  // Auto-focus et restauration du focus
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const container = ref.current;

    // Auto-focus sur le premier élément
    if (autoFocus) {
      const focusables = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length > 0) {
        focusables[0]?.focus();
      } else {
        // Focus sur le container si pas d'élément focusable
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    }

    // Restaurer le focus au démontage
    return () => {
      if (restoreFocus && previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [enabled, autoFocus, restoreFocus, focusableSelector]);

  // Trap du focus
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const container = ref.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusables = container.querySelectorAll<HTMLElement>(focusableSelector);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (!first || !last) return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [enabled, focusableSelector]);

  return ref;
}

// ============================================================
// USE PORTAL
// ============================================================

/**
 * Hook pour créer un élément portal
 * @param id - ID du container portal
 *
 * @example
 * const portalContainer = usePortal('modals');
 *
 * return portalContainer
 *   ? createPortal(<Modal />, portalContainer)
 *   : null;
 */
export function usePortal(id: string): HTMLElement | null {
  const portalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Chercher ou créer le container
    let container = document.getElementById(id);

    if (!container) {
      container = document.createElement('div');
      container.id = id;
      document.body.appendChild(container);
    }

    portalRef.current = container;

    // Note: On ne supprime pas le container au démontage
    // car d'autres modales pourraient l'utiliser
  }, [id]);

  return portalRef.current;
}

// ============================================================
// USE BODY SCROLL LOCK
// ============================================================

/**
 * Hook pour verrouiller le scroll du body
 * @param isLocked - Si le scroll doit être verrouillé
 *
 * @example
 * useBodyScrollLock(isModalOpen);
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Verrouiller le scroll
    document.body.style.overflow = 'hidden';
    // Compenser la scrollbar pour éviter le décalage
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.paddingRight = '';
    };
  }, [isLocked]);
}

// ============================================================
// USE HOVER
// ============================================================

interface UseHoverOptions {
  // Délai avant d'activer le hover (ms)
  delay?: number;
  // Délai avant de désactiver le hover (ms)
  delayLeave?: number;
}

/**
 * Hook pour détecter le hover avec délais optionnels
 * @param options - Options de configuration
 *
 * @example
 * const { ref, isHovered } = useHover({ delay: 300 });
 *
 * return (
 *   <div ref={ref}>
 *     {isHovered && <Tooltip />}
 *   </div>
 * );
 */
export function useHover<T extends Element = Element>(
  options: UseHoverOptions = {},
): {
  ref: RefObject<T>;
  isHovered: boolean;
} {
  const { delay = 0, delayLeave = 0 } = options;

  const ref = useRef<T>(null);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseEnter = () => {
      clearTimeouts();
      if (delay > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsHovered(true);
        }, delay);
      } else {
        setIsHovered(true);
      }
    };

    const handleMouseLeave = () => {
      clearTimeouts();
      if (delayLeave > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsHovered(false);
        }, delayLeave);
      } else {
        setIsHovered(false);
      }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeouts();
    };
  }, [delay, delayLeave, clearTimeouts]);

  return { ref, isHovered };
}

// ============================================================
// USE LONG PRESS
// ============================================================

interface UseLongPressOptions {
  // Durée avant déclenchement (ms)
  threshold?: number;
  // Callback sur appui court
  onPress?: () => void;
  // Callback sur appui long
  onLongPress: () => void;
}

/**
 * Hook pour détecter les appuis longs
 * @param options - Options de configuration
 *
 * @example
 * const handlers = useLongPress({
 *   threshold: 500,
 *   onLongPress: () => showContextMenu(),
 *   onPress: () => selectItem(),
 * });
 *
 * return <button {...handlers}>Maintenir</button>;
 */
export function useLongPress(
  options: UseLongPressOptions,
): {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
} {
  const { threshold = 500, onPress, onLongPress } = options;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, threshold);
  }, [threshold, onLongPress]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const end = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!isLongPressRef.current && onPress) {
      onPress();
    }
  }, [onPress]);

  return {
    onMouseDown: () => start(),
    onMouseUp: () => end(),
    onMouseLeave: () => cancel(),
    onTouchStart: () => start(),
    onTouchEnd: () => end(),
  };
}

// ============================================================
// EXPORTS
// ============================================================

export default useClickOutside;
