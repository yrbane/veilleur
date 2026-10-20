/**
 * Veilleur - Port DepotAnnotationsArticles
 * Note et favori qu'un utilisateur pose sur les articles de son fil
 */

import type { AnnotationArticle, AnnotationExportee } from '../entites/Article';

export interface DepotAnnotationsArticles {
  /**
   * Enregistre la note (null = retirer la note)
   */
  noter(utilisateurId: string, articleId: string, note: number | null): Promise<void>;

  /**
   * Marque ou retire l'article des favoris
   */
  definirFavori(utilisateurId: string, articleId: string, favori: boolean): Promise<void>;
  /** Marque un article lu (date de lecture) ou non lu */
  marquerLu(utilisateurId: string, articleId: string, lu: boolean): Promise<void>;
  /** Met l'article dans la liste de lecture, ou l'en retire */
  definirALire(utilisateurId: string, articleId: string, aLire: boolean): Promise<void>;
  /** Toutes les annotations de l'utilisateur avec leur article, des plus récentes aux plus anciennes */
  listerAnnotations(utilisateurId: string): Promise<AnnotationExportee[]>;

  /**
   * Annotations de l'utilisateur pour un lot d'articles (clé = id d'article)
   */
  obtenirAnnotations(utilisateurId: string, articleIds: string[]): Promise<Map<string, AnnotationArticle>>;
}
