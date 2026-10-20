/**
 * Veilleur - Lecteur : affiche le contenu d'un article dans une fenêtre modale,
 * sans quitter le fil. Le contenu arrive déjà nettoyé par le serveur.
 */

import { articles } from '../services/api';
import type { Article } from '../services/api';
import { creerElement, $, vider } from '../utils/dom';
import { icone } from '../utils/icones';
import { formatDate } from '../utils/format';

const CLASSE_CORPS = 'modal-ouverte';

let lecteurOuvert: HTMLElement | null = null;

/**
 * Ferme le lecteur courant et rend le focus à l'élément qui l'a ouvert
 */
export function fermerLecteur(): void {
  if (!lecteurOuvert) return;
  const retourFocus = (lecteurOuvert as HTMLElement & { retourFocus?: HTMLElement }).retourFocus;
  lecteurOuvert.remove();
  lecteurOuvert = null;
  document.body.classList.remove(CLASSE_CORPS);
  document.removeEventListener('keydown', surTouche);
  retourFocus?.focus();
}

function surTouche(e: KeyboardEvent): void {
  if (e.key === 'Escape') fermerLecteur();
}

function creerEntete(article: Article): HTMLElement {
  const infos = creerElement('div', { classes: ['lecteur-source'] });
  if (article.source?.nom) {
    infos.append(creerElement('span', { classes: ['lecteur-source-nom'], texte: article.source.nom }));
  }
  infos.append(creerElement('time', { attrs: { datetime: article.datePublication }, texte: formatDate(article.datePublication) }));

  const original = creerElement('a', {
    classes: ['la-btn', 'ghost', 'sm'],
    attrs: { href: article.lien, target: '_blank', rel: 'noopener noreferrer' },
    icone: 'open_in_new',
    texte: 'Original',
  });
  const fermer = creerElement('button', {
    classes: ['la-btn', 'ghost', 'icon-only', 'modal-fermer'],
    attrs: { type: 'button', 'aria-label': 'Fermer' },
    icone: 'close',
    onClick: fermerLecteur,
  });
  const actions = creerElement('div', { classes: ['lecteur-actions'], enfants: [original, fermer] });
  return creerElement('header', { classes: ['modal-entete', 'lecteur-entete'], enfants: [infos, actions] });
}

function creerSquelette(): HTMLElement {
  const squelette = creerElement('div', { classes: ['lecteur-squelette'], attrs: { 'aria-busy': 'true' } });
  for (let i = 0; i < 6; i++) {
    squelette.append(creerElement('div', { classes: ['la-skeleton', 'text'] }));
  }
  return squelette;
}

function creerIndisponible(article: Article): HTMLElement {
  const lien = creerElement('a', {
    classes: ['la-btn', 'primary'],
    attrs: { href: article.lien, target: '_blank', rel: 'noopener noreferrer' },
    icone: 'open_in_new',
    texte: 'Lire sur le site',
  });
  return creerElement('div', {
    classes: ['la-empty', 'lecteur-indisponible'],
    enfants: [
      icone('article_shortcut', { classes: ['la-empty-icon'] }),
      creerElement('p', { classes: ['la-empty-title'], texte: 'Cet article ne se laisse pas extraire' }),
      creerElement('p', { texte: 'Le site ne propose pas de contenu lisible en place.' }),
      lien,
    ],
  });
}

/**
 * Ouvre le lecteur sur un article : fenêtre immédiate, contenu chargé ensuite
 */
export function ouvrirLecteur(article: Article): HTMLElement {
  fermerLecteur();
  const conteneur = $('#modal-container') ?? document.body;
  const titre = creerElement('h1', { classes: ['lecteur-titre'], attrs: { id: 'lecteur-titre' }, texte: article.titre });
  const meta = creerElement('p', { classes: ['lecteur-meta'] });
  const contenu = creerElement('div', { classes: ['lecteur-contenu'], enfants: [creerSquelette()] });
  const corps = creerElement('div', { classes: ['modal-corps', 'lecteur-corps'], enfants: [titre, meta, contenu] });
  const fenetre = creerElement('div', {
    classes: ['modal', 'lecteur'],
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lecteur-titre' },
    enfants: [creerEntete(article), corps],
  });
  const overlay = creerElement('div', {
    classes: ['modal-overlay', 'lecteur-overlay'],
    enfants: [fenetre],
    onClick: e => {
      if (e.target === overlay) fermerLecteur();
    },
  });
  (overlay as HTMLElement & { retourFocus?: HTMLElement }).retourFocus = document.activeElement as HTMLElement;

  conteneur.append(overlay);
  lecteurOuvert = overlay;
  document.body.classList.add(CLASSE_CORPS);
  document.addEventListener('keydown', surTouche);
  fenetre.querySelector<HTMLElement>('.modal-fermer')?.focus();

  void articles
    .lecture(article.id)
    .then(lecture => {
      if (lecteurOuvert !== overlay) return;
      if (lecture.titre) titre.textContent = lecture.titre;
      const details = [lecture.auteur, `${lecture.dureeLectureMin} min de lecture`].filter(Boolean);
      meta.textContent = details.join(' · ');
      vider(contenu);
      // HTML nettoyé côté serveur (sanitize-html), limité aux balises de mise en forme
      contenu.innerHTML = lecture.contenuHtml;
    })
    .catch(() => {
      if (lecteurOuvert !== overlay) return;
      vider(contenu);
      contenu.append(creerIndisponible(article));
    });

  return overlay;
}
