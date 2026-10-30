/**
 * Veilleur - En-tête de table triable : un bouton par colonne, état annoncé par aria-sort.
 * Le tri lui-même est fait par le serveur (listes paginées) ; ici seulement l'interface.
 */

import { creerElement } from './dom';
import { icone } from './icones';

export interface ColonneTriable {
  /** Clé envoyée au serveur ; absente → colonne non triable */
  cle?: string;
  libelle: string;
  /** Les nombres se lisent du plus grand au plus petit au premier clic, et s'alignent à droite */
  numerique?: boolean;
  /** Classes supplémentaires du th */
  classes?: string[];
}

export interface EtatTri {
  tri: string;
  ordre: 'asc' | 'desc';
}

/** Même colonne → on inverse ; autre colonne → son ordre naturel */
export function basculerTri(etat: EtatTri, colonne: ColonneTriable): EtatTri {
  const cle = colonne.cle ?? etat.tri;
  if (cle === etat.tri) return { tri: cle, ordre: etat.ordre === 'asc' ? 'desc' : 'asc' };
  return { tri: cle, ordre: colonne.numerique ? 'desc' : 'asc' };
}

export function creerEnteteTriable(colonnes: ColonneTriable[], etat: EtatTri, onTri: (etat: EtatTri) => void): HTMLTableSectionElement {
  const thead = creerElement('thead');
  const ligne = creerElement('tr');
  for (const colonne of colonnes) {
    const th = creerElement('th', { classes: [colonne.numerique ? 'num' : '', ...(colonne.classes ?? [])] });
    if (!colonne.cle) {
      th.textContent = colonne.libelle;
    } else {
      const actif = etat.tri === colonne.cle;
      th.setAttribute('aria-sort', actif ? (etat.ordre === 'asc' ? 'ascending' : 'descending') : 'none');
      th.classList.toggle('tri-actif', actif);
      const bouton = creerElement('button', {
        classes: ['table-tri'],
        attrs: { type: 'button', title: actif ? (etat.ordre === 'asc' ? 'Trié par ordre croissant' : 'Trié par ordre décroissant') : `Trier par ${colonne.libelle.toLowerCase()}` },
        texte: colonne.libelle,
        onClick: () => onTri(basculerTri(etat, colonne)),
      });
      bouton.append(icone(actif ? (etat.ordre === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'));
      th.append(bouton);
    }
    ligne.append(th);
  }
  thead.append(ligne);
  return thead;
}
