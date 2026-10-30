/**
 * Veilleur - Traitement d'un job de découverte d'image : la page de l'article est lue,
 * son image Open Graph / Twitter devient l'illustration, puis part dans le cache d'images.
 * Chaque tentative est datée (date_recherche_image) pour ne jamais retenter en boucle.
 */

import type { Article } from '@/domaine/entites/Article';
import type { DepotArticles } from '@/domaine/ports/DepotArticles';
import { choisirImageDecouverte, type MetadonneesPage } from '@/domaine/services/decouverteImage';
import type { JobDecouverteImage, ResultatDecouverteImage } from '../images/types';
import { loggerJobs } from '../logging/logger';

export interface DependancesDecouverte {
  depotArticles: Pick<DepotArticles, 'trouverParId' | 'mettreAJour'>;
  /** Lecture des métadonnées de la page (ServiceScraping.enrichirArticle) */
  enrichir: (url: string) => Promise<MetadonneesPage>;
  /** Enfile le téléchargement de l'image trouvée dans le cache */
  enfilerImage: (urlImage: string, articleId: string) => Promise<unknown>;
}

/** Retire les clés indéfinies pour ne pas écraser le JSON stocké avec du bruit */
function compacter<T extends object>(objet: T): T {
  return Object.fromEntries(Object.entries(objet).filter(([, v]) => v !== undefined)) as T;
}

export async function traiterDecouverteImage(donnees: JobDecouverteImage, deps: DependancesDecouverte): Promise<ResultatDecouverteImage> {
  const article = await deps.depotArticles.trouverParId(donnees.articleId);
  if (!article) {
    loggerJobs.debug({ articleId: donnees.articleId }, 'Découverte d\'image : article disparu');
    return { articleId: donnees.articleId, urlImage: null };
  }
  if (article.urlImage) {
    return { articleId: article.id, urlImage: article.urlImage };
  }

  let metas: MetadonneesPage = { openGraph: {}, twitter: {} };
  try {
    metas = await deps.enrichir(article.lien);
  } catch (erreur) {
    loggerJobs.warn({ articleId: article.id, lien: article.lien, erreur: erreur instanceof Error ? erreur.message : erreur }, 'Découverte d\'image : page illisible');
  }

  const urlImage = choisirImageDecouverte(metas, article.lien);
  const changements: Partial<Article> = {
    metaOpenGraph: compacter({ ...article.metaOpenGraph, ...metas.openGraph }),
    metaTwitter: compacter({ ...article.metaTwitter, ...metas.twitter }),
    dateRechercheImage: new Date(),
  };
  if (urlImage) changements.urlImage = urlImage;
  await deps.depotArticles.mettreAJour(article.id, changements);

  if (urlImage) {
    await deps.enfilerImage(urlImage, article.id);
    loggerJobs.info({ articleId: article.id, urlImage }, 'Image découverte pour un article');
  } else {
    loggerJobs.debug({ articleId: article.id }, 'Aucune image annoncée par la page');
  }
  return { articleId: article.id, urlImage };
}
