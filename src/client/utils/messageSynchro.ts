/**
 * Veilleur - Libellé du résultat d'une synchronisation manuelle de source
 * Un flux déjà connu renvoie souvent « 0 nouveaux » : on dit alors combien d'articles sont déjà là
 */

import { formatNombre } from './format';

export interface ResultatSynchronisationClient {
  nouveauxArticles: number;
  articlesIgnores: number;
  /** Articles de la source présents en base après la synchronisation */
  totalArticles: number;
}

export function messageSynchronisation(resultat: ResultatSynchronisationClient): string {
  const { nouveauxArticles, totalArticles } = resultat;
  if (nouveauxArticles > 0) {
    return nouveauxArticles > 1 ? `${formatNombre(nouveauxArticles)} nouveaux articles` : '1 nouvel article';
  }
  if (totalArticles > 0) {
    return `Source à jour : ${formatNombre(totalArticles)} article${totalArticles > 1 ? 's' : ''} déjà dans votre fil`;
  }
  return 'Aucun article trouvé dans ce flux';
}
