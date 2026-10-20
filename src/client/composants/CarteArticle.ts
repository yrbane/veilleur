/**
 * Veilleur - Composant CarteArticle
 * Affiche un article dans le fil d'actualités
 */

import { creerElement } from '../utils/dom';
import { icone, iconeHtml } from '../utils/icones';
import { formatDateRelative, echapperHtml } from '../utils/format';
import { articles as apiArticles } from '../services/api';
import { toast } from '../utils/toast';
import type { Article } from '../services/api';

/**
 * Callbacks de la carte
 */
export interface OptionsCarteArticle {
  /** Note ou favori modifié */
  onAnnotation?: (article: Article) => void;
  /** Clic sur un mot-clé : le fil filtre dessus */
  onMotCle?: (mot: string) => void;
}

/**
 * Étoiles de notation : cliquer sur la note courante la retire
 */
function creerNotationArticle(article: Article, options: OptionsCarteArticle): HTMLElement {
  const conteneur = creerElement('div', {
    classes: ['carte-article-note'],
    attrs: { role: 'group', 'aria-label': 'Noter cet article' },
  });

  const rafraichir = () => {
    conteneur.querySelectorAll<HTMLButtonElement>('.btn-etoile').forEach((btn, index) => {
      const active = typeof article.note === 'number' && index < article.note;
      btn.classList.toggle('active', active);
      btn.replaceChildren(icone('star', { plein: active }));
    });
  };

  for (let i = 1; i <= 5; i++) {
    const etoile = creerElement('button', {
      classes: ['btn-etoile'],
      attrs: { type: 'button', 'data-note': String(i), 'aria-label': `Noter ${i} étoile${i > 1 ? 's' : ''}`, title: `${i}/5` },
      onClick: async () => {
        const nouvelleNote = article.note === i ? null : i;
        try {
          await apiArticles.noter(article.id, nouvelleNote);
          article.note = nouvelleNote;
          rafraichir();
          toast.succes(nouvelleNote ? `Note : ${nouvelleNote}/5` : 'Note retirée');
          options.onAnnotation?.(article);
        } catch {
          toast.erreur('Erreur lors de la notation');
        }
      },
    });
    conteneur.append(etoile);
  }
  rafraichir();
  return conteneur;
}

/**
 * Bouton favori
 */
function creerBoutonFavori(article: Article, options: OptionsCarteArticle): HTMLElement {
  const bouton = creerElement('button', {
    classes: ['btn-favori'],
    attrs: { type: 'button' },
  });

  const rafraichir = () => {
    bouton.classList.toggle('active', !!article.favori);
    bouton.replaceChildren(icone('favorite', { plein: !!article.favori }));
    bouton.setAttribute('aria-label', article.favori ? 'Retirer des favoris' : 'Ajouter aux favoris');
    bouton.setAttribute('aria-pressed', article.favori ? 'true' : 'false');
    bouton.title = article.favori ? 'Retirer des favoris' : 'Ajouter aux favoris';
  };

  bouton.addEventListener('click', async () => {
    try {
      const { favori } = await apiArticles.definirFavori(article.id, !article.favori);
      article.favori = favori;
      rafraichir();
      toast.succes(favori ? 'Ajouté aux favoris' : 'Retiré des favoris');
      options.onAnnotation?.(article);
    } catch {
      toast.erreur('Erreur lors de la mise en favori');
    }
  });
  rafraichir();
  return bouton;
}

/**
 * Mots-clés extraits automatiquement : classement de l'article, cliquables pour filtrer le fil
 */
function creerMotsClesArticle(article: Article, options: OptionsCarteArticle): HTMLElement | null {
  const mots = article.motsCles ?? [];
  if (mots.length === 0) return null;
  const conteneur = creerElement('ul', {
    classes: ['carte-article-mots-cles'],
    attrs: { 'aria-label': 'Mots-clés de l\'article' },
  });
  for (const mot of mots) {
    const item = creerElement('li');
    const bouton = creerElement('button', {
      classes: ['badge-mot-cle'],
      attrs: { type: 'button', 'data-mot': mot, title: `Voir les articles « ${mot} »` },
      texte: mot,
      onClick: () => options.onMotCle?.(mot),
    });
    item.append(bouton);
    conteneur.append(item);
  }
  return conteneur;
}

/**
 * Crée une carte d'article
 */
export function creerCarteArticle(article: Article, options: OptionsCarteArticle = {}): HTMLElement {
  const carte = creerElement('article', {
    classes: ['carte-article'],
    attrs: { 'data-id': article.id },
  });

  // Image avec fallback: URL cachée -> URL originale -> placeholder
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
    }) as HTMLImageElement;

    // Mécanisme de fallback en cascade
    let fallbackTente = false;
    img.onerror = () => {
      // Si on n'a pas encore tenté le fallback et qu'on a une URL originale
      if (!fallbackTente && article.urlImageOriginale) {
        fallbackTente = true;
        img.src = article.urlImageOriginale;
      } else {
        // Fallback final: placeholder
        imageContainer.innerHTML = `<div class="carte-article-image-placeholder">${iconeHtml('newspaper')}</div>`;
      }
    };
    imageContainer.append(img);
  } else {
    imageContainer.innerHTML = `<div class="carte-article-image-placeholder">${iconeHtml('newspaper')}</div>`;
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

  // Annotations personnelles : note, favori, tags
  const annotations = creerElement('div', { classes: ['carte-article-annotations'] });
  annotations.append(creerNotationArticle(article, options), creerBoutonFavori(article, options));

  // Assemblage
  contenu.append(source, titre);
  if (resume) contenu.append(resume);
  contenu.append(meta, annotations);
  const motsCles = creerMotsClesArticle(article, options);
  if (motsCles) contenu.append(motsCles);

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
    <div class="carte-article-image la-skeleton image"></div>
    <div class="carte-article-contenu">
      <div class="la-skeleton text" style="width: 30%"></div>
      <div class="la-skeleton title" style="width: 90%"></div>
      <div class="la-skeleton text" style="width: 70%"></div>
      <div class="la-skeleton text" style="width: 40%"></div>
    </div>
  `;

  return carte;
}
