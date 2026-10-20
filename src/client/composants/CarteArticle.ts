/**
 * Veilleur - Composant CarteArticle
 * Affiche un article dans le fil d'actualités
 */

import { creerElement } from '../utils/dom';
import { icone, iconeHtml } from '../utils/icones';
import { urlFaviconLocale } from '../utils/favicons';
import { formatDateRelative, echapperHtml } from '../utils/format';
import { surligner } from '../utils/surlignage';
import { articles as apiArticles } from '../services/api';
import { toast } from '../utils/toast';
import { ouvrirLecteur } from './Lecteur';
import type { Article } from '../services/api';

/**
 * Callbacks de la carte
 */
export interface OptionsCarteArticle {
  /** Note ou favori modifié */
  onAnnotation?: (article: Article) => void;
  /** Clic sur un mot-clé : le fil filtre dessus */
  onMotCle?: (mot: string) => void;
  /** Article marqué lu ou non lu */
  onLu?: (article: Article) => void;
  /** Termes de la recherche courante à surligner dans le titre et le résumé */
  surligner?: string[];
}

/**
 * Marque l'article lu ou non lu : état visuel immédiat, serveur ensuite
 */
async function definirLu(article: Article, carte: HTMLElement, lu: boolean, options: OptionsCarteArticle): Promise<void> {
  if (!!article.lu === lu) return;
  article.lu = lu;
  carte.classList.toggle('lu', lu);
  carte.querySelector<HTMLButtonElement>('.btn-lu')?.dispatchEvent(new CustomEvent('veilleur:lu'));
  try {
    await apiArticles.marquerLu(article.id, lu);
    options.onLu?.(article);
  } catch {
    article.lu = !lu;
    carte.classList.toggle('lu', !lu);
    toast.erreur('Impossible d\'enregistrer la lecture');
  }
}

/**
 * Bouton « Lire ici » : ouvre le lecteur et marque l'article lu
 */
function creerBoutonLire(article: Article, carte: HTMLElement, options: OptionsCarteArticle): HTMLElement {
  return creerElement('button', {
    classes: ['btn-lire'],
    attrs: { type: 'button', 'aria-label': 'Lire ici', title: 'Lire ici' },
    icone: 'menu_book',
    onClick: () => {
      ouvrirLecteur(article);
      void definirLu(article, carte, true, options);
    },
  });
}

/**
 * Bouton lu / non lu
 */
function creerBoutonLu(article: Article, carte: HTMLElement, options: OptionsCarteArticle): HTMLElement {
  const bouton = creerElement('button', {
    classes: ['btn-lu'],
    attrs: { type: 'button' },
  });
  const rafraichir = () => {
    const lu = !!article.lu;
    bouton.classList.toggle('active', lu);
    bouton.replaceChildren(icone(lu ? 'check_circle' : 'radio_button_unchecked', { plein: lu }));
    bouton.setAttribute('aria-label', lu ? 'Marquer comme non lu' : 'Marquer comme lu');
    bouton.setAttribute('aria-pressed', String(lu));
    bouton.title = bouton.getAttribute('aria-label') ?? '';
  };
  bouton.addEventListener('click', () => definirLu(article, carte, !article.lu, options));
  bouton.addEventListener('veilleur:lu', rafraichir);
  rafraichir();
  return bouton;
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
interface DefinitionBascule {
  classe: string;
  icone: string;
  actif: (article: Article) => boolean;
  basculer: (article: Article) => Promise<boolean>;
  libelles: { activer: string; retirer: string; active: string; retiree: string };
}

/**
 * Bouton à deux états (favori, liste de lecture) : icône pleine quand actif, bascule côté serveur
 */
function creerBoutonBascule(article: Article, options: OptionsCarteArticle, definition: DefinitionBascule): HTMLElement {
  const bouton = creerElement('button', {
    classes: [definition.classe],
    attrs: { type: 'button' },
  });

  const rafraichir = () => {
    const actif = definition.actif(article);
    bouton.classList.toggle('active', actif);
    bouton.replaceChildren(icone(definition.icone, { plein: actif }));
    const libelle = actif ? definition.libelles.retirer : definition.libelles.activer;
    bouton.setAttribute('aria-label', libelle);
    bouton.setAttribute('aria-pressed', String(actif));
    bouton.title = libelle;
  };

  bouton.addEventListener('click', async () => {
    try {
      const actif = await definition.basculer(article);
      rafraichir();
      toast.succes(actif ? definition.libelles.active : definition.libelles.retiree);
      options.onAnnotation?.(article);
    } catch {
      toast.erreur('Impossible d\'enregistrer ce changement');
    }
  });
  rafraichir();
  return bouton;
}

function creerBoutonFavori(article: Article, options: OptionsCarteArticle): HTMLElement {
  return creerBoutonBascule(article, options, {
    classe: 'btn-favori',
    icone: 'favorite',
    actif: a => !!a.favori,
    basculer: async a => {
      const { favori } = await apiArticles.definirFavori(a.id, !a.favori);
      a.favori = favori;
      return favori;
    },
    libelles: { activer: 'Ajouter aux favoris', retirer: 'Retirer des favoris', active: 'Ajouté aux favoris', retiree: 'Retiré des favoris' },
  });
}

/**
 * Liste de lecture « à lire plus tard »
 */
function creerBoutonALire(article: Article, options: OptionsCarteArticle): HTMLElement {
  return creerBoutonBascule(article, options, {
    classe: 'btn-a-lire',
    icone: 'bookmark',
    actif: a => !!a.aLire,
    basculer: async a => {
      const { aLire } = await apiArticles.definirALire(a.id, !a.aLire);
      a.aLire = aLire;
      return aLire;
    },
    libelles: { activer: 'Lire plus tard', retirer: 'Retirer de la liste de lecture', active: 'Mis de côté pour plus tard', retiree: 'Retiré de la liste de lecture' },
  });
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
    classes: ['carte-article', article.lu ? 'lu' : ''],
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

  const urlFavicon = urlFaviconLocale({ id: article.sourceId, urlFavicon: article.source.urlFavicon });
  if (urlFavicon) {
    const favicon = creerElement('img', {
      classes: ['carte-article-source-favicon'],
      attrs: { src: urlFavicon, alt: '', loading: 'lazy' },
    }) as HTMLImageElement;
    favicon.onerror = () => favicon.remove();
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
    // Ouvrir l'article vaut lecture
    onClick: () => void definirLu(article, carte, true, options),
  });
  titre.append(surligner(article.titre, options.surligner ?? []));

  // Résumé
  const resume = article.resume
    ? creerElement('p', {
        classes: ['carte-article-resume'],
        enfants: [surligner(echapperHtml(article.resume), options.surligner ?? [])],
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
  annotations.append(
    creerNotationArticle(article, options),
    creerBoutonFavori(article, options),
    creerBoutonALire(article, options),
    creerBoutonLire(article, carte, options),
    creerBoutonLu(article, carte, options),
  );

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
