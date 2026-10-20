/**
 * Veilleur - Déduction automatique des tags d'une source
 * À l'ajout d'une source, ses tags ne sont pas saisis par l'utilisateur mais déduits :
 * catégories déclarées par le flux, puis catégories les plus fréquentes des articles,
 * puis mots-clés de la page du site, enfin mots-clés extraits des titres d'articles.
 */

import { extraireMotsCles } from './ExtractionMotsCles';

export const NOMBRE_TAGS_SOURCE = 5;

/** Longueur maximale d'un tag (contrainte du schéma `tags.nom`) */
const LONGUEUR_MAX_TAG = 30;

/** Catégories génériques sans valeur de classement */
const CATEGORIES_CREUSES = new Set([
  'actualites', 'actualite', 'actu', 'news', 'a la une', 'une', 'toutes', 'tous', 'general', 'generale',
  'uncategorized', 'uncategorised', 'non classe', 'non classee', 'divers', 'autres', 'autre', 'blog',
  'articles', 'article', 'home', 'accueil', 'derniers articles', 'featured', 'misc', 'other', 'others',
]);

/** Catégorie brute : chaîne, ou objet `{ _: texte }` quand la balise porte des attributs */
export type CategorieBrute = string | { _?: unknown } | null | undefined;

export interface IndicesTagsSource {
  /** `<category>` au niveau du flux */
  categoriesFlux?: CategorieBrute[];
  /** `<category>` de chaque article du flux */
  categoriesArticles?: CategorieBrute[][];
  /** `<meta name="keywords">` de la page du site */
  motsClesPage?: string | null;
  /** Titres des articles du flux, dernier recours */
  titresArticles?: string[];
}

/**
 * Déduit au plus `nombre` tags, les plus significatifs d'abord
 */
export function deduireTagsSource(indices: IndicesTagsSource, nombre = NOMBRE_TAGS_SOURCE): string[] {
  const retenus: string[] = [];
  const vus = new Set<string>();

  const ajouter = (brut: CategorieBrute): void => {
    if (retenus.length >= nombre) return;
    const tag = nettoyer(brut);
    if (!tag) return;
    const cle = normaliser(tag);
    if (vus.has(cle) || CATEGORIES_CREUSES.has(cle)) return;
    vus.add(cle);
    retenus.push(tag);
  };

  for (const categorie of indices.categoriesFlux ?? []) ajouter(categorie);

  // Catégories d'articles : par fréquence décroissante, puis ordre d'apparition
  const frequences = new Map<string, { tag: string; nombre: number; ordre: number }>();
  for (const categories of indices.categoriesArticles ?? []) {
    for (const categorie of categories) {
      const tag = nettoyer(categorie);
      if (!tag) continue;
      const cle = normaliser(tag);
      const entree = frequences.get(cle) ?? { tag, nombre: 0, ordre: frequences.size };
      entree.nombre++;
      frequences.set(cle, entree);
    }
  }
  [...frequences.values()]
    .sort((a, b) => b.nombre - a.nombre || a.ordre - b.ordre)
    .forEach(({ tag }) => ajouter(tag));

  if (retenus.length === 0 && indices.motsClesPage) {
    for (const mot of indices.motsClesPage.split(/[,;]/)) ajouter(mot);
  }

  if (retenus.length === 0 && indices.titresArticles?.length) {
    // Dernier recours : mots-clés des titres, sans les noms propres qui ne décrivent pas la source
    for (const mot of extraireMotsCles({ titre: '', resume: indices.titresArticles.join('. ') }, nombre * 2)) {
      if (mot[0] === mot[0]?.toLowerCase()) ajouter(mot);
    }
  }

  return retenus;
}

/**
 * Nettoie une catégorie brute ; null si inexploitable (vide, URL, trop longue)
 */
function nettoyer(brut: CategorieBrute): string | null {
  const texte = typeof brut === 'string' ? brut : typeof brut?._ === 'string' ? brut._ : '';
  const tag = texte.replace(/\s+/g, ' ').trim();
  if (tag.length < 3 || tag.length > LONGUEUR_MAX_TAG) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(tag) || /^www\./i.test(tag)) return null;
  if (!/\p{L}/u.test(tag)) return null;
  // Slug ou identifiant technique (jeux-video/actualites-gaming, no_ads, actu-BP) : pas un libellé
  if (/[/_]/.test(tag) || (/-/.test(tag) && !/\s/.test(tag))) return null;
  return tag;
}

/**
 * Clé de dédoublonnage : minuscules sans accents
 */
function normaliser(tag: string): string {
  return tag.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
