/**
 * Veilleur - Affichage du fil : liste (une carte par ligne) ou tuiles (grille)
 * Le choix est mémorisé dans le navigateur ; le conteneur du fil reçoit la classe
 * `tuiles` et la grille est entièrement décrite en CSS (pages.css).
 */

import { creerElement } from './dom';

export type ModeAffichage = 'liste' | 'tuiles';

export const CLE_AFFICHAGE = 'veilleur.fil.affichage';

const MODES: ReadonlyArray<{ mode: ModeAffichage; libelle: string; icone: string }> = [
  { mode: 'liste', libelle: 'Liste', icone: 'view_agenda' },
  { mode: 'tuiles', libelle: 'Tuiles', icone: 'grid_view' },
];

function estMode(valeur: unknown): valeur is ModeAffichage {
  return MODES.some(m => m.mode === valeur);
}

/** Mode mémorisé, « liste » à défaut ou si le stockage est indisponible */
export function modeEnregistre(): ModeAffichage {
  try {
    const valeur = localStorage.getItem(CLE_AFFICHAGE);
    return estMode(valeur) ? valeur : 'liste';
  } catch {
    return 'liste';
  }
}

export function enregistrerMode(mode: ModeAffichage): void {
  try {
    localStorage.setItem(CLE_AFFICHAGE, mode);
  } catch {
    // Stockage indisponible : le choix ne survit pas au rechargement, sans gravité
  }
}

/** Applique le mode au conteneur du fil */
export function appliquerMode(conteneur: HTMLElement, mode: ModeAffichage): void {
  conteneur.classList.toggle('tuiles', mode === 'tuiles');
  conteneur.dataset.affichage = mode;
}

/**
 * Sélecteur Liste / Tuiles : deux boutons pressables ; le changement est mémorisé
 * puis signalé à l'appelant (qui applique le mode au fil).
 */
export function creerSelecteurAffichage(modeInitial: ModeAffichage, onChange: (mode: ModeAffichage) => void): HTMLElement {
  let courant = modeInitial;
  const groupe = creerElement('div', {
    classes: ['fil-affichage'],
    attrs: { role: 'group', 'aria-label': 'Affichage des articles' },
  });

  const boutons = MODES.map(({ mode, libelle, icone }) => {
    const bouton = creerElement('button', {
      classes: ['btn-affichage'],
      attrs: { type: 'button', title: libelle, 'aria-label': libelle, 'aria-pressed': String(mode === courant) },
      icone,
      onClick: () => {
        if (mode === courant) return;
        courant = mode;
        boutons.forEach(b => b.setAttribute('aria-pressed', String(b === bouton)));
        enregistrerMode(mode);
        onChange(mode);
      },
    });
    return bouton;
  });

  groupe.append(...boutons);
  return groupe;
}
