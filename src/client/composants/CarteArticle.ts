/**
 * Veilleur - Composant CarteArticle
 * Affiche un article dans le fil d'actualités
 */

import { creerElement } from '../utils/dom';
import { formatDateRelative, echapperHtml } from '../utils/format';
import { articles as apiArticles } from '../services/api';
import { toast } from '../utils/toast';
import type { Article, Tag } from '../services/api';

/**
 * Callbacks de la carte (le fil les utilise pour rafraîchir ses filtres)
 */
export interface OptionsCarteArticle {
  onAnnotation?: (article: Article) => void;
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
      btn.textContent = active ? '★' : '☆';
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
    bouton.textContent = article.favori ? '♥' : '♡';
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
 * Tags de classement : badges retirables + champ d'ajout
 */
function creerTagsArticle(article: Article, options: OptionsCarteArticle): HTMLElement {
  const conteneur = creerElement('div', { classes: ['carte-article-tags'] });
  const liste = creerElement('div', { classes: ['liste-tags'] });

  const enregistrer = async (noms: string[]): Promise<void> => {
    const { tags } = await apiArticles.definirTags(article.id, noms);
    article.tags = tags;
    afficher(tags);
    options.onAnnotation?.(article);
  };

  const afficher = (tags: Tag[]) => {
    liste.innerHTML = '';
    for (const tag of tags) {
      const badge = creerElement('span', { classes: ['badge-tag'], attrs: { 'data-tag-id': tag.id } });
      const nom = creerElement('span', { texte: tag.nom });
      const retirer = creerElement('button', {
        classes: ['btn-retirer-tag'],
        attrs: { type: 'button', 'aria-label': `Retirer le tag ${tag.nom}`, title: 'Retirer ce tag' },
        texte: '×',
        onClick: async e => {
          e.stopPropagation();
          try {
            await enregistrer((article.tags ?? []).filter(t => t.id !== tag.id).map(t => t.nom));
            toast.succes(`Tag "${tag.nom}" retiré`);
          } catch {
            toast.erreur('Erreur lors du retrait du tag');
          }
        },
      });
      badge.append(nom, retirer);
      liste.append(badge);
    }
  };
  afficher(article.tags ?? []);

  const formulaire = creerElement('div', { classes: ['form-ajout-tag'] });
  const champ = creerElement('input', {
    attrs: { type: 'text', placeholder: 'Classer…', maxlength: '50', 'aria-label': 'Ajouter un tag à cet article' },
  }) as HTMLInputElement;
  const ajouter = creerElement('button', {
    classes: ['btn', 'btn-sm'],
    attrs: { type: 'button', 'aria-label': 'Ajouter le tag' },
    texte: '+',
    onClick: async () => {
      const nom = champ.value.trim();
      if (!nom) return;
      try {
        await enregistrer([...(article.tags ?? []).map(t => t.nom), nom]);
        champ.value = '';
        toast.succes(`Tag "${nom}" ajouté`);
      } catch (erreur) {
        toast.erreur(erreur instanceof Error ? erreur.message : 'Erreur lors de l\'ajout du tag');
      }
    },
  });
  champ.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ajouter.click();
    }
  });
  formulaire.append(champ, ajouter);
  conteneur.append(liste, formulaire);
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
        imageContainer.innerHTML = '<div class="carte-article-image-placeholder">📰</div>';
      }
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

  // Annotations personnelles : note, favori, tags
  const annotations = creerElement('div', { classes: ['carte-article-annotations'] });
  annotations.append(creerNotationArticle(article, options), creerBoutonFavori(article, options));

  // Assemblage
  contenu.append(source, titre);
  if (resume) contenu.append(resume);
  contenu.append(meta, annotations, creerTagsArticle(article, options));

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
