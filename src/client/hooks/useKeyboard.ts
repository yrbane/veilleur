/**
 * Veilleur - Hook useKeyboard
 * Gestion des raccourcis clavier
 *
 * Fonctionnalités:
 * - Raccourcis avec modificateurs (Ctrl, Shift, Alt, Meta)
 * - Prévention du comportement par défaut
 * - Support des séquences (comme Vim)
 * - Contextes (actif seulement dans certaines conditions)
 */

import { useEffect, useCallback, useRef, useState } from 'react';

// ============================================================
// TYPES
// ============================================================

type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta';

interface KeyboardShortcut {
  key: string;
  modifiers?: Modifier[];
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  enabled?: boolean;
  description?: string;
}

interface UseKeyboardOptions {
  // Activer/désactiver tous les raccourcis
  enabled?: boolean;
  // Ignorer quand focus dans un input
  ignoreInputs?: boolean;
  // Ignorer quand une modale est ouverte
  ignoreWhenModalOpen?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalise une touche pour comparaison
 */
function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'space',
    'spacebar': 'space',
    'esc': 'escape',
    'up': 'arrowup',
    'down': 'arrowdown',
    'left': 'arrowleft',
    'right': 'arrowright',
    'del': 'delete',
    'return': 'enter',
  };

  const normalized = key.toLowerCase();
  return keyMap[normalized] ?? normalized;
}

/**
 * Vérifie si l'élément actif est un input
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  const isContentEditable = (element as HTMLElement).isContentEditable;

  return isInput || isContentEditable;
}

/**
 * Vérifie si les modificateurs correspondent
 */
function matchModifiers(event: KeyboardEvent, modifiers: Modifier[] = []): boolean {
  const ctrlRequired = modifiers.includes('ctrl');
  const shiftRequired = modifiers.includes('shift');
  const altRequired = modifiers.includes('alt');
  const metaRequired = modifiers.includes('meta');

  // Vérifier que les modificateurs requis sont pressés
  // et que les non-requis ne le sont pas
  return (
    event.ctrlKey === ctrlRequired &&
    event.shiftKey === shiftRequired &&
    event.altKey === altRequired &&
    event.metaKey === metaRequired
  );
}

/**
 * Parse un raccourci string en objet
 * Ex: "ctrl+shift+s" -> { key: 's', modifiers: ['ctrl', 'shift'] }
 */
function parseShortcut(shortcut: string): { key: string; modifiers: Modifier[] } {
  const parts = shortcut.toLowerCase().split('+');
  const modifiers: Modifier[] = [];
  let key = '';

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') {
      modifiers.push('ctrl');
    } else if (part === 'shift') {
      modifiers.push('shift');
    } else if (part === 'alt' || part === 'option') {
      modifiers.push('alt');
    } else if (part === 'meta' || part === 'cmd' || part === 'command' || part === 'win') {
      modifiers.push('meta');
    } else {
      key = normalizeKey(part);
    }
  }

  return { key, modifiers };
}

// ============================================================
// USE KEYBOARD
// ============================================================

/**
 * Hook pour gérer les raccourcis clavier
 * @param shortcuts - Liste des raccourcis
 * @param options - Options de configuration
 *
 * @example
 * useKeyboard([
 *   {
 *     key: 's',
 *     modifiers: ['ctrl'],
 *     handler: () => save(),
 *     preventDefault: true,
 *   },
 *   {
 *     key: 'escape',
 *     handler: () => close(),
 *   },
 * ]);
 */
export function useKeyboard(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardOptions = {},
): void {
  const { enabled = true, ignoreInputs = true, ignoreWhenModalOpen = false } = options;

  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorer si focus dans un input
      if (ignoreInputs && isInputElement(document.activeElement)) {
        return;
      }

      // Ignorer si modale ouverte
      if (ignoreWhenModalOpen) {
        const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (hasOpenModal) return;
      }

      const pressedKey = normalizeKey(event.key);

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;

        const shortcutKey = normalizeKey(shortcut.key);

        if (pressedKey === shortcutKey && matchModifiers(event, shortcut.modifiers)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, ignoreInputs, ignoreWhenModalOpen]);
}

// ============================================================
// USE HOTKEY
// ============================================================

/**
 * Hook simplifié pour un seul raccourci
 * @param shortcut - Raccourci (ex: "ctrl+s", "escape")
 * @param handler - Handler à appeler
 * @param options - Options de configuration
 *
 * @example
 * useHotkey('ctrl+s', () => save());
 * useHotkey('escape', () => close());
 */
export function useHotkey(
  shortcut: string,
  handler: (event: KeyboardEvent) => void,
  options: UseKeyboardOptions & { preventDefault?: boolean; enabled?: boolean } = {},
): void {
  const { preventDefault = true, enabled = true, ...keyboardOptions } = options;

  const { key, modifiers } = parseShortcut(shortcut);

  const shortcuts: KeyboardShortcut[] = [
    {
      key,
      modifiers,
      handler,
      preventDefault,
      enabled,
    },
  ];

  useKeyboard(shortcuts, { ...keyboardOptions, enabled });
}

// ============================================================
// USE KEY SEQUENCE
// ============================================================

interface UseKeySequenceOptions {
  // Timeout entre les touches (ms)
  timeout?: number;
  // Activer/désactiver
  enabled?: boolean;
  // Ignorer les inputs
  ignoreInputs?: boolean;
}

/**
 * Hook pour les séquences de touches (style Vim)
 * @param sequence - Séquence de touches (ex: "g g", "d d")
 * @param handler - Handler à appeler
 * @param options - Options de configuration
 *
 * @example
 * useKeySequence('g g', () => scrollToTop());
 * useKeySequence('g b', () => scrollToBottom());
 */
export function useKeySequence(
  sequence: string,
  handler: () => void,
  options: UseKeySequenceOptions = {},
): void {
  const { timeout = 1000, enabled = true, ignoreInputs = true } = options;

  const sequenceKeys = sequence.toLowerCase().split(' ');
  const currentIndexRef = useRef(0);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (ignoreInputs && isInputElement(document.activeElement)) {
        return;
      }

      const pressedKey = normalizeKey(event.key);
      const expectedKey = normalizeKey(sequenceKeys[currentIndexRef.current] ?? '');

      if (pressedKey === expectedKey) {
        currentIndexRef.current++;

        // Réinitialiser le timeout
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
        }

        if (currentIndexRef.current >= sequenceKeys.length) {
          // Séquence complète
          currentIndexRef.current = 0;
          handler();
        } else {
          // Attendre la prochaine touche
          timeoutIdRef.current = setTimeout(() => {
            currentIndexRef.current = 0;
          }, timeout);
        }
      } else {
        // Mauvaise touche, réinitialiser
        currentIndexRef.current = 0;
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [enabled, ignoreInputs, sequence, handler, timeout, sequenceKeys]);
}

// ============================================================
// USE KEY PRESSED
// ============================================================

/**
 * Hook pour détecter si une touche est pressée
 * @param key - Touche à surveiller
 *
 * @example
 * const isShiftPressed = useKeyPressed('shift');
 */
export function useKeyPressed(key: string): boolean {
  const [isPressed, setIsPressed] = useState(false);
  const targetKey = normalizeKey(key);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (normalizeKey(event.key) === targetKey) {
        setIsPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (normalizeKey(event.key) === targetKey) {
        setIsPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [targetKey]);

  return isPressed;
}

// ============================================================
// USE KONAMI CODE
// ============================================================

const KONAMI_CODE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

/**
 * Hook pour détecter le Konami Code
 * @param callback - Fonction à appeler quand le code est entré
 *
 * @example
 * useKonamiCode(() => {
 *   console.log('Easter egg!');
 * });
 */
export function useKonamiCode(callback: () => void): void {
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const pressedKey = normalizeKey(event.key);
      const expectedKey = KONAMI_CODE[indexRef.current];

      if (pressedKey === expectedKey) {
        indexRef.current++;

        // Réinitialiser le timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (indexRef.current >= KONAMI_CODE.length) {
          indexRef.current = 0;
          callback();
        } else {
          timeoutRef.current = setTimeout(() => {
            indexRef.current = 0;
          }, 2000);
        }
      } else {
        indexRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [callback]);
}

// ============================================================
// USE KEYBOARD NAVIGATION
// ============================================================

interface UseKeyboardNavigationOptions<T> {
  items: T[];
  onSelect?: (item: T, index: number) => void;
  onEscape?: () => void;
  enabled?: boolean;
  wrap?: boolean;
}

/**
 * Hook pour navigation clavier dans une liste
 * @param options - Options de configuration
 *
 * @example
 * const { activeIndex, setActiveIndex } = useKeyboardNavigation({
 *   items: suggestions,
 *   onSelect: (item) => selectSuggestion(item),
 *   onEscape: () => closeSuggestions(),
 * });
 */
export function useKeyboardNavigation<T>(
  options: UseKeyboardNavigationOptions<T>,
): {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  activeItem: T | null;
} {
  const { items, onSelect, onEscape, enabled = true, wrap = true } = options;

  const [activeIndex, setActiveIndex] = useState(-1);

  const activeItem = activeIndex >= 0 && activeIndex < items.length ? items[activeIndex] ?? null : null;

  useHotkey(
    'arrowdown',
    () => {
      if (items.length === 0) return;

      setActiveIndex(prev => {
        if (prev < items.length - 1) return prev + 1;
        return wrap ? 0 : prev;
      });
    },
    { enabled, ignoreInputs: false },
  );

  useHotkey(
    'arrowup',
    () => {
      if (items.length === 0) return;

      setActiveIndex(prev => {
        if (prev > 0) return prev - 1;
        return wrap ? items.length - 1 : prev;
      });
    },
    { enabled, ignoreInputs: false },
  );

  useHotkey(
    'enter',
    () => {
      if (activeItem && onSelect) {
        onSelect(activeItem, activeIndex);
      }
    },
    { enabled: enabled && activeIndex >= 0, ignoreInputs: false },
  );

  useHotkey(
    'escape',
    () => {
      if (onEscape) {
        onEscape();
      }
    },
    { enabled, ignoreInputs: false },
  );

  // Réinitialiser quand les items changent
  useEffect(() => {
    setActiveIndex(-1);
  }, [items]);

  return { activeIndex, setActiveIndex, activeItem };
}

// ============================================================
// EXPORTS
// ============================================================

export { parseShortcut, normalizeKey };
export default useKeyboard;
