/**
 * Veilleur - Bloc des mots-clés tendance (puces cliquables)
 */

import { creerElement, vider } from '../utils/dom';
import { icone } from '../utils/icones';
import type { Tendance } from '../services/api';

export interface OptionsTendances {
  titre: string;
  charger: () => Promise<Tendance[]>;
  onChoix: (mot: string) => void;
}

/**
 * Crée le bloc, masqué tant qu'il n'y a rien à montrer ; `rafraichir` recharge les tendances
 */
export function creerBlocTendances(options: OptionsTendances): HTMLElement & { rafraichir: () => Promise<void> } {
  const bloc = creerElement('section', {
    classes: ['tendances', 'masque'],
    attrs: { 'aria-label': options.titre },
  }) as HTMLElement & { rafraichir: () => Promise<void> };
  const titre = creerElement('h2', { classes: ['tendances-titre'], icone: 'local_fire_department', texte: options.titre });
  const liste = creerElement('div', { classes: ['tendances-liste'] });
  bloc.append(titre, liste);

  bloc.rafraichir = async (): Promise<void> => {
    let tendances: Tendance[] = [];
    try {
      tendances = await options.charger();
    } catch {
      // Les tendances sont un bonus : rien à signaler si elles manquent
    }
    vider(liste);
    bloc.classList.toggle('masque', tendances.length === 0);
    for (const tendance of tendances) {
      const puce = creerElement('button', {
        classes: ['la-chip', 'chip-tendance', tendance.score >= 2 ? 'forte' : ''],
        attrs: {
          type: 'button',
          'data-mot': tendance.mot,
          title: `${tendance.nombreRecents} article${tendance.nombreRecents > 1 ? 's' : ''} en 24 h, ${tendance.nombreReference} les 7 jours précédents`,
        },
        texte: tendance.mot,
        onClick: () => options.onChoix(tendance.mot),
      });
      if (tendance.score >= 2) puce.prepend(icone('trending_up'));
      puce.append(creerElement('span', { classes: ['chip-tendance-nombre'], texte: String(tendance.nombreRecents) }));
      liste.append(puce);
    }
  };
  return bloc;
}
