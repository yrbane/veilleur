/**
 * Veilleur - Menu déroulant léger : un bouton qui déplie un panneau ancré sous lui
 * Fermeture au clic en dehors et à la touche Échap ; badge optionnel (nombre de filtres actifs)
 */

import { creerElement } from '../utils/dom';
import { icone } from '../utils/icones';

export interface OptionsPopover {
  /** Libellé du bouton */
  libelle: string;
  /** Icône Material du bouton */
  icone: string;
  /** Contenu du panneau */
  contenu: HTMLElement;
}

export interface Popover extends HTMLElement {
  declencheur: HTMLButtonElement;
  panneau: HTMLElement;
  ouvrir: () => void;
  fermer: () => void;
  /** Affiche `n` dans un badge sur le bouton (rien si 0) */
  definirBadge: (n: number) => void;
}

let compteur = 0;

export function creerPopover(options: OptionsPopover): Popover {
  const racine = creerElement('div', { classes: ['popover'] }) as unknown as Popover;
  const idPanneau = `popover-${++compteur}`;

  const declencheur = creerElement('button', {
    classes: ['la-chip', 'chip-filtre', 'popover-declencheur'],
    attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': idPanneau, 'aria-haspopup': 'true' },
    icone: options.icone,
    texte: options.libelle,
  }) as HTMLButtonElement;
  declencheur.append(icone('expand_more', { classes: ['popover-chevron'] }));

  const panneau = creerElement('div', { classes: ['popover-panneau', 'la-card'], attrs: { id: idPanneau } });
  panneau.hidden = true;
  panneau.append(options.contenu);
  racine.append(declencheur, panneau);

  const surClicDehors = (e: Event): void => {
    if (!racine.contains(e.target as Node)) fermer();
  };
  const surTouche = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      fermer();
      declencheur.focus();
    }
  };

  const ouvrir = (): void => {
    if (!panneau.hidden) return;
    panneau.hidden = false;
    declencheur.setAttribute('aria-expanded', 'true');
    // Le clic qui ouvre vient du déclencheur, donc de l'intérieur : il ne referme pas
    document.addEventListener('click', surClicDehors);
    document.addEventListener('keydown', surTouche);
  };
  const fermer = (): void => {
    if (panneau.hidden) return;
    panneau.hidden = true;
    declencheur.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', surClicDehors);
    document.removeEventListener('keydown', surTouche);
  };

  declencheur.addEventListener('click', () => (panneau.hidden ? ouvrir() : fermer()));

  racine.declencheur = declencheur;
  racine.panneau = panneau;
  racine.ouvrir = ouvrir;
  racine.fermer = fermer;
  racine.definirBadge = (n: number): void => {
    racine.querySelector('.popover-badge')?.remove();
    declencheur.classList.toggle('actif', n > 0);
    if (n > 0) {
      declencheur.insertBefore(
        creerElement('span', { classes: ['la-badge', 'sm', 'popover-badge'], texte: String(n) }),
        declencheur.querySelector('.popover-chevron'),
      );
    }
  };
  return racine;
}
