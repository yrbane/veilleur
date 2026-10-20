/**
 * Veilleur - Composant Skeleton Article
 * État de chargement visuel pour les articles
 */

import { creerElement } from '../utils/dom';

/**
 * Crée un skeleton d'article
 */
export function creerSkeletonArticle(): HTMLElement {
  const carte = creerElement('div', {
    classes: ['skeleton-carte'],
  });

  const image = creerElement('div', {
    classes: ['skeleton', 'skeleton-image'],
  });

  const titre = creerElement('div', {
    classes: ['skeleton', 'skeleton-titre'],
  });

  const texte1 = creerElement('div', {
    classes: ['skeleton', 'skeleton-texte'],
  });

  const texte2 = creerElement('div', {
    classes: ['skeleton', 'skeleton-texte-court'],
  });

  const meta = creerElement('div', {
    classes: ['skeleton', 'skeleton-meta'],
  });

  carte.append(image, titre, texte1, texte2, meta);

  return carte;
}

/**
 * Crée une liste de skeletons
 */
export function creerListeSkeletons(nombre = 5): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < nombre; i++) {
    fragment.appendChild(creerSkeletonArticle());
  }
  return fragment;
}
