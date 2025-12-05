/**
 * Veilleur - Composant CarteArticle
 * Affiche un article dans le fil d'actualités
 */

import { creerElement } from '../utils/dom';
import { formatDateRelative, echapperHtml } from '../utils/format';
import type { Article } from '../services/api';

/**
 * Crée une carte d'article
 */
export function creerCarteArticle(article: Article): HTMLElement {
  const carte = creerElement('article', {
    classes: ['carte-article'],
    attrs: { 'data-id': article.id },
  });

  // Image
  const imageContainer = creerElement('div', {
    classes: ['carte-article-image'],
  });

  if (article.urlImage) {
    const img = creerElement('img', {
      attrs: {
        src: article.urlImage,
        alt: '',
        loading: 'lazy',
      },
    });
    img.onerror = () => {
      imageContainer.innerHTML = '<div class="carte-article-image-placeholder">📰</div>';
    };
    imageContainer.append(img);
  } else {
    imageContainer.innerHTML = '<div class="carte-article-image-placeholder">📰</div>';
  }

  // Contenu
  const contenu = creerElement('div', {
    classes: ['carte-article-contenu'],
  });

  // Source
  const source = creerElement('div', {
    classes: ['carte-article-source'],
  });

  if (article.source.urlFavicon) {
    const favicon = creerElement('img', {
      classes: ['carte-article-source-favicon'],
      attrs: {
        src: article.source.urlFavicon,
        alt: '',
      },
    });
    source.append(favicon);
  }

  const sourceNom = creerElement('span', {
    texte: article.source.nom,
  });
  source.append(sourceNom);

  // Titre (lien)
  const titre = creerElement('a', {
    classes: ['carte-article-titre'],
    attrs: {
      href: article.lien,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    texte: article.titre,
  });

  // Résumé
  const resume = article.resume
    ? creerElement('p', {
        classes: ['carte-article-resume'],
        texte: echapperHtml(article.resume),
      })
    : null;

  // Métadonnées
  const meta = creerElement('div', {
    classes: ['carte-article-meta'],
  });

  const date = creerElement('span', {
    texte: formatDateRelative(article.datePublication),
  });
  meta.append(date);

  if (article.auteur) {
    const auteur = creerElement('span', {
      texte: `par ${article.auteur}`,
    });
    meta.append(auteur);
  }

  // Assemblage
  contenu.append(source, titre);
  if (resume) contenu.append(resume);
  contenu.append(meta);

  carte.append(imageContainer, contenu);

  return carte;
}

/**
 * Crée un squelette de carte (pour le chargement)
 */
export function creerSqueletteCarteArticle(): HTMLElement {
  const carte = creerElement('div', {
    classes: ['carte-article', 'squelette'],
  });

  carte.innerHTML = `
    <div class="carte-article-image squelette-bloc"></div>
    <div class="carte-article-contenu">
      <div class="squelette-ligne" style="width: 30%"></div>
      <div class="squelette-ligne" style="width: 90%"></div>
      <div class="squelette-ligne" style="width: 70%"></div>
      <div class="squelette-ligne" style="width: 40%"></div>
    </div>
  `;

  return carte;
}
