/**
 * Veilleur - Port DepotAnnotationsArticles
 * Note et favori qu'un utilisateur pose sur les articles de son fil
 */

import type { AnnotationArticle } from '../entites/Article';

export interface DepotAnnotationsArticles {
  /**
   * Enregistre la note (null = retirer la note)
   */
  noter(utilisateurId: string, articleId: string, note: number | null): Promise<void>;

  /**
   * Marque ou retire l'article des favoris
   */
  definirFavori(utilisateurId: string, articleId: string, favori: boolean): Promise<void>;

  /**
   * Annotations de l'utilisateur pour un lot d'articles (clé = id d'article)
   */
  obtenirAnnotations(utilisateurId: string, articleIds: string[]): Promise<Map<string, AnnotationArticle>>;
}
