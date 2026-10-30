/**
 * Veilleur - Rail de puces : plusieurs groupes de filtres rapides (rubriques, tendances, mots-clés)
 * tenus sur une seule ligne défilante, dépliable en plusieurs lignes d'un clic
 */

import { creerElement } from '../utils/dom';
import { icone } from '../utils/icones';

export interface GroupeRail {
  /** Identifiant du conteneur des puces (rempli par la page) */
  id: string;
  icone: string;
  titre: string;
}

export interface OptionsRail {
  libelle: string;
  groupes: GroupeRail[];
}

export interface RailPuces extends HTMLElement {
  /** Masque les groupes vides, le rail s'il n'a plus rien, et le bouton si tout tient sur la ligne */
  actualiser: () => void;
  deplier: (ouvert?: boolean) => void;
}

export function creerRailPuces(options: OptionsRail): RailPuces {
  const rail = creerElement('nav', { classes: ['rail-puces'], attrs: { 'aria-label': options.libelle } }) as RailPuces;
  const piste = creerElement('div', { classes: ['rail-piste'] });

  for (const groupe of options.groupes) {
    const section = creerElement('div', { classes: ['rail-groupe'], attrs: { 'aria-label': groupe.titre, role: 'group' } });
    const marque = creerElement('span', { classes: ['rail-groupe-icone'], attrs: { title: groupe.titre, 'aria-hidden': 'true' } });
    marque.append(icone(groupe.icone));
    const puces = creerElement('div', { classes: ['rail-groupe-puces'], attrs: { id: groupe.id } });
    section.append(marque, puces);
    piste.append(section);
  }

  const bouton = creerElement('button', {
    classes: ['la-btn', 'ghost', 'sm', 'icon-only', 'rail-deplier'],
    attrs: { type: 'button', 'aria-expanded': 'false', title: 'Tout afficher', 'aria-label': 'Afficher tous les filtres' },
    icone: 'expand_more',
  });

  const deplier = (ouvert = !rail.classList.contains('deplie')): void => {
    rail.classList.toggle('deplie', ouvert);
    bouton.setAttribute('aria-expanded', String(ouvert));
    bouton.setAttribute('title', ouvert ? 'Replier' : 'Tout afficher');
    bouton.setAttribute('aria-label', ouvert ? 'Replier les filtres' : 'Afficher tous les filtres');
  };
  bouton.addEventListener('click', () => deplier());

  const actualiser = (): void => {
    let visibles = 0;
    rail.querySelectorAll<HTMLElement>('.rail-groupe').forEach(groupe => {
      const vide = groupe.querySelector('.rail-groupe-puces')!.childElementCount === 0;
      groupe.classList.toggle('masque', vide);
      if (!vide) visibles++;
    });
    rail.classList.toggle('masque', visibles === 0);
    // Le bouton n'a de sens que si la ligne déborde (jsdom : scrollWidth à 0, bouton visible)
    const deborde = piste.scrollWidth === 0 || piste.scrollWidth > piste.clientWidth + 1;
    bouton.classList.toggle('masque', !deborde && !rail.classList.contains('deplie'));
  };

  rail.append(piste, bouton);
  rail.actualiser = actualiser;
  rail.deplier = deplier;
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => actualiser()).observe(piste);
  }
  return rail;
}
