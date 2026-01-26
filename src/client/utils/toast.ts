/**
 * Veilleur - Système de notifications toast
 */

import { $, creerElement } from './dom';

type TypeToast = 'succes' | 'erreur' | 'info';

interface OptionsToast {
  duree?: number;
  action?: {
    texte: string;
    onClick: () => void;
  };
}

/**
 * Affiche une notification toast
 */
export function afficherToast(
  message: string,
  type: TypeToast = 'info',
  options: OptionsToast = {},
): void {
  const container = $('#toast-container');
  if (!container) return;

  const duree = options.duree ?? 5000;

  const icones: Record<TypeToast, string> = {
    succes: '✓',
    erreur: '✕',
    info: 'ℹ',
  };

  const toast = creerElement('div', {
    classes: ['toast', `toast-${type}`],
  });

  const icone = creerElement('span', {
    classes: ['toast-icone'],
    texte: icones[type],
  });

  const texte = creerElement('span', {
    classes: ['toast-message'],
    texte: message,
  });

  const fermer = creerElement('button', {
    classes: ['toast-fermer'],
    texte: '✕',
    onClick: () => supprimerToast(toast),
  });

  toast.append(icone, texte);

  if (options.action) {
    const actionBtn = creerElement('button', {
      classes: ['btn', 'btn-sm', 'btn-ghost'],
      texte: options.action.texte,
      onClick: () => {
        options.action!.onClick();
        supprimerToast(toast);
      },
    });
    toast.append(actionBtn);
  }

  toast.append(fermer);
  container.append(toast);

  // Auto-suppression après la durée
  if (duree > 0) {
    setTimeout(() => supprimerToast(toast), duree);
  }
}

/**
 * Supprime un toast avec animation
 */
function supprimerToast(toast: Element): void {
  toast.classList.add('sortie');
  setTimeout(() => toast.remove(), 300);
}

/**
 * Raccourcis pour les types de toast
 */
export const toast = {
  succes: (message: string, options?: OptionsToast) =>
    afficherToast(message, 'succes', options),

  erreur: (message: string, options?: OptionsToast) =>
    afficherToast(message, 'erreur', options),

  info: (message: string, options?: OptionsToast) =>
    afficherToast(message, 'info', options),
};
