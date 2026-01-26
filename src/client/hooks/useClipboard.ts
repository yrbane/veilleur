/**
 * Veilleur - Hook useClipboard
 * Gestion du presse-papiers
 *
 * Fonctionnalités:
 * - Copie de texte
 * - État de succès temporaire
 * - Fallback pour anciens navigateurs
 * - Lecture du presse-papiers (avec permission)
 */

import { useState, useCallback, useRef } from 'react';

// ============================================================
// TYPES
// ============================================================

interface UseClipboardOptions {
  // Durée d'affichage du succès (ms)
  successDuration?: number;
  // Callback en cas de succès
  onSuccess?: (text: string) => void;
  // Callback en cas d'erreur
  onError?: (error: Error) => void;
}

interface UseClipboardReturn {
  // Copier du texte
  copy: (text: string) => Promise<boolean>;
  // Lire le presse-papiers (nécessite permission)
  read: () => Promise<string | null>;
  // État de la copie
  hasCopied: boolean;
  // Texte actuellement copié
  copiedText: string | null;
  // Erreur éventuelle
  error: Error | null;
  // Réinitialiser l'état
  reset: () => void;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Vérifie si l'API Clipboard est disponible
 */
function isClipboardApiSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.writeText === 'function'
  );
}

/**
 * Fallback pour anciens navigateurs
 */
async function copyWithFallback(text: string): Promise<boolean> {
  // Créer un élément textarea temporaire
  const textarea = document.createElement('textarea');
  textarea.value = text;

  // Éviter le scroll
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
}

// ============================================================
// USE CLIPBOARD
// ============================================================

/**
 * Hook pour gérer le presse-papiers
 * @param options - Options de configuration
 *
 * @example
 * const { copy, hasCopied } = useClipboard();
 *
 * return (
 *   <button onClick={() => copy(shareUrl)}>
 *     {hasCopied ? 'Copié !' : 'Copier le lien'}
 *   </button>
 * );
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { successDuration = 2000, onSuccess, onError } = options;

  const [hasCopied, setHasCopied] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    resetTimeout();
    setHasCopied(false);
    setCopiedText(null);
    setError(null);
  }, [resetTimeout]);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      resetTimeout();
      setError(null);

      try {
        let success = false;

        if (isClipboardApiSupported()) {
          await navigator.clipboard.writeText(text);
          success = true;
        } else {
          success = await copyWithFallback(text);
        }

        if (success) {
          setCopiedText(text);
          setHasCopied(true);
          onSuccess?.(text);

          // Réinitialiser après un délai
          timeoutRef.current = setTimeout(() => {
            setHasCopied(false);
          }, successDuration);

          return true;
        } else {
          const err = new Error('Échec de la copie');
          setError(err);
          onError?.(err);
          return false;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return false;
      }
    },
    [successDuration, onSuccess, onError, resetTimeout],
  );

  const read = useCallback(async (): Promise<string | null> => {
    try {
      if (!isClipboardApiSupported() || !navigator.clipboard.readText) {
        throw new Error('Lecture du presse-papiers non supportée');
      }

      const text = await navigator.clipboard.readText();
      return text;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return null;
    }
  }, [onError]);

  return {
    copy,
    read,
    hasCopied,
    copiedText,
    error,
    reset,
  };
}

// ============================================================
// USE COPY TO CLIPBOARD
// ============================================================

/**
 * Version simplifiée retournant juste la fonction de copie et l'état
 * @param options - Options de configuration
 *
 * @example
 * const [copy, hasCopied] = useCopyToClipboard();
 *
 * return (
 *   <button onClick={() => copy('Hello!')}>
 *     {hasCopied ? 'Copié !' : 'Copier'}
 *   </button>
 * );
 */
export function useCopyToClipboard(
  options: UseClipboardOptions = {},
): [(text: string) => Promise<boolean>, boolean] {
  const { copy, hasCopied } = useClipboard(options);
  return [copy, hasCopied];
}

// ============================================================
// COPIER TEXTE (FONCTION UTILITAIRE)
// ============================================================

/**
 * Fonction utilitaire pour copier du texte (sans hook)
 * @param text - Texte à copier
 *
 * @example
 * const success = await copierTexte('Hello!');
 */
export async function copierTexte(text: string): Promise<boolean> {
  try {
    if (isClipboardApiSupported()) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      return await copyWithFallback(text);
    }
  } catch {
    return false;
  }
}

// ============================================================
// USE PASTE FROM CLIPBOARD
// ============================================================

interface UsePasteOptions {
  onPaste?: (text: string) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

/**
 * Hook pour coller depuis le presse-papiers
 * @param options - Options de configuration
 *
 * @example
 * const { paste, isPasting } = usePasteFromClipboard({
 *   onPaste: (text) => setInput(text),
 * });
 *
 * return <button onClick={paste}>Coller</button>;
 */
export function usePasteFromClipboard(options: UsePasteOptions = {}): {
  paste: () => Promise<string | null>;
  isPasting: boolean;
  error: Error | null;
} {
  const { onPaste, onError, enabled = true } = options;

  const [isPasting, setIsPasting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const paste = useCallback(async (): Promise<string | null> => {
    if (!enabled) return null;

    setIsPasting(true);
    setError(null);

    try {
      if (!isClipboardApiSupported() || !navigator.clipboard.readText) {
        throw new Error('Lecture du presse-papiers non supportée');
      }

      const text = await navigator.clipboard.readText();
      onPaste?.(text);
      setIsPasting(false);
      return text;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      setIsPasting(false);
      return null;
    }
  }, [enabled, onPaste, onError]);

  return { paste, isPasting, error };
}

// ============================================================
// USE CLIPBOARD EVENT
// ============================================================

import { useEffect } from 'react';

interface UseClipboardEventOptions {
  onCopy?: (event: ClipboardEvent) => void;
  onCut?: (event: ClipboardEvent) => void;
  onPaste?: (event: ClipboardEvent, text: string) => void;
  enabled?: boolean;
}

/**
 * Hook pour écouter les événements du presse-papiers
 * @param options - Options de configuration
 *
 * @example
 * useClipboardEvent({
 *   onCopy: (e) => console.log('Copié:', e),
 *   onPaste: (e, text) => console.log('Collé:', text),
 * });
 */
export function useClipboardEvent(options: UseClipboardEventOptions): void {
  const { onCopy, onCut, onPaste, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleCopy = (event: ClipboardEvent) => {
      onCopy?.(event);
    };

    const handleCut = (event: ClipboardEvent) => {
      onCut?.(event);
    };

    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text') ?? '';
      onPaste?.(event, text);
    };

    if (onCopy) document.addEventListener('copy', handleCopy);
    if (onCut) document.addEventListener('cut', handleCut);
    if (onPaste) document.addEventListener('paste', handlePaste);

    return () => {
      if (onCopy) document.removeEventListener('copy', handleCopy);
      if (onCut) document.removeEventListener('cut', handleCut);
      if (onPaste) document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, onCopy, onCut, onPaste]);
}

// ============================================================
// USE SHARE
// ============================================================

interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Hook pour partager via l'API Web Share (mobile)
 *
 * @example
 * const { share, canShare } = useShare();
 *
 * if (canShare) {
 *   return (
 *     <button onClick={() => share({ title: 'Article', url: window.location.href })}>
 *       Partager
 *     </button>
 *   );
 * }
 */
export function useShare(): {
  share: (data: ShareData) => Promise<boolean>;
  canShare: boolean;
} {
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = useCallback(
    async (data: ShareData): Promise<boolean> => {
      if (!canShare) return false;

      try {
        await navigator.share(data);
        return true;
      } catch {
        // L'utilisateur a annulé ou erreur
        return false;
      }
    },
    [canShare],
  );

  return { share, canShare };
}

// ============================================================
// EXPORTS
// ============================================================

export default useClipboard;
