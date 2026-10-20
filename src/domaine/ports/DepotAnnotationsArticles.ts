/**
 * Veilleur - Port DepotAnnotationsArticles
 * Note et tags qu'un utilisateur pose sur les articles de son fil
 */

import type { AnnotationArticle, TagArticlesUtilise } from '../entites/Article';

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
   * Remplace la liste des tags posés sur l'article
   */
  definirTags(utilisateurId: string, articleId: string, tagIds: string[]): Promise<void>;

  /**
   * Annotations de l'utilisateur pour un lot d'articles (clé = id d'article)
   */
  obtenirAnnotations(utilisateurId: string, articleIds: string[]): Promise<Map<string, AnnotationArticle>>;

  /**
   * Tags que l'utilisateur a posés sur au moins un article, les plus utilisés d'abord
   */
  listerTagsUtilises(utilisateurId: string): Promise<TagArticlesUtilise[]>;
}
