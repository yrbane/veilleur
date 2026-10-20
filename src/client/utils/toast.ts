/**
 * Veilleur - Notifications éphémères (composant la-toast de Lunar Aurora)
 */

import { $, creerElement } from './dom';
import { icone } from './icones';

type TypeToast = 'succes' | 'erreur' | 'info';

interface OptionsToast {
  duree?: number;
  action?: {
    texte: string;
    onClick: () => void;
  };
}

const GRAVITES: Record<TypeToast, { classe: string; icone: string; role: string }> = {
  succes: { classe: 'success', icone: 'check_circle', role: 'status' },
  erreur: { classe: 'error', icone: 'error', role: 'alert' },
  info: { classe: 'info', icone: 'info', role: 'status' },
};

/**
 * Affiche une notification toast
 */
export function afficherToast(
  message: string,
  type: TypeToast = 'info',
  options: OptionsToast = {},
): void {
  const region = $('#toast-container');
  if (!region) return;

  const duree = options.duree ?? 5000;
  const gravite = GRAVITES[type];

  const toast = creerElement('div', {
    classes: ['la-toast', gravite.classe, `toast-${type}`],
    attrs: { role: gravite.role },
  });
  toast.append(icone(gravite.icone, { classes: ['la-toast-icon'] }));

  const contenu = creerElement('div', { classes: ['la-toast-content'] });
  contenu.append(creerElement('div', { classes: ['la-toast-title', 'toast-message'], texte: message }));
  if (options.action) {
    contenu.append(
      creerElement('button', {
        classes: ['la-btn', 'ghost', 'sm'],
        attrs: { type: 'button' },
        texte: options.action.texte,
        onClick: () => {
          options.action!.onClick();
          supprimerToast(toast);
        },
      }),
    );
  }
  toast.append(contenu);

  toast.append(
    creerElement('button', {
      classes: ['la-toast-close', 'toast-fermer'],
      attrs: { type: 'button', 'aria-label': 'Fermer la notification' },
      texte: '×',
      onClick: () => supprimerToast(toast),
    }),
  );

  region.append(toast);

  if (duree > 0) {
    setTimeout(() => supprimerToast(toast), duree);
  }
}

/**
 * Retire un toast après son animation de sortie (classe .leaving de Lunar Aurora)
 */
function supprimerToast(toast: Element): void {
  if (toast.classList.contains('leaving')) return;
  toast.classList.add('leaving');
  setTimeout(() => toast.remove(), 300);
}

export const toast = {
  succes: (message: string, options?: OptionsToast) => afficherToast(message, 'succes', options),
  erreur: (message: string, options?: OptionsToast) => afficherToast(message, 'erreur', options),
  info: (message: string, options?: OptionsToast) => afficherToast(message, 'info', options),
};
