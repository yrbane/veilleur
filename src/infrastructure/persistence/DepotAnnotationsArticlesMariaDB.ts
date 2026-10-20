/**
 * Veilleur - Dépôt des annotations d'articles (note, favori) avec MariaDB
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DepotAnnotationsArticles } from '@/domaine/ports/DepotAnnotationsArticles';
import type { AnnotationArticle } from '@/domaine/entites/Article';
import { obtenirBdd } from './connexion';
import { utilisateursArticles } from './schema';
import { loggerBdd } from '../logging/logger';

export class DepotAnnotationsArticlesMariaDB implements DepotAnnotationsArticles {
  async noter(utilisateurId: string, articleId: string, note: number | null): Promise<void> {
    try {
      await this.enregistrer(utilisateurId, articleId, { note });
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, articleId }, 'Erreur lors de la notation de l\'article');
      throw erreur;
    }
  }

  async definirFavori(utilisateurId: string, articleId: string, favori: boolean): Promise<void> {
    try {
      await this.enregistrer(utilisateurId, articleId, { favori });
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, articleId }, 'Erreur lors de la mise en favori de l\'article');
      throw erreur;
    }
  }

  /**
   * Upsert de la ligne utilisateur-article, puis suppression si elle ne porte plus rien
   */
  private async enregistrer(
    utilisateurId: string,
    articleId: string,
    valeurs: { note?: number | null; favori?: boolean },
  ): Promise<void> {
    const db = obtenirBdd();
    const cle = and(eq(utilisateursArticles.utilisateurId, utilisateurId), eq(utilisateursArticles.articleId, articleId));
    await db
      .insert(utilisateursArticles)
      .values({ utilisateurId, articleId, note: valeurs.note ?? null, favori: valeurs.favori ?? false, dateMiseAJour: new Date() })
      .onDuplicateKeyUpdate({ set: { ...valeurs, dateMiseAJour: new Date() } });
    await db
      .delete(utilisateursArticles)
      .where(and(cle, sql`${utilisateursArticles.note} IS NULL`, eq(utilisateursArticles.favori, false)));
  }

  async obtenirAnnotations(utilisateurId: string, articleIds: string[]): Promise<Map<string, AnnotationArticle>> {
    const db = obtenirBdd();
    const annotations = new Map<string, AnnotationArticle>();
    if (articleIds.length === 0) {
      return annotations;
    }
    const obtenir = (articleId: string): AnnotationArticle => {
      let annotation = annotations.get(articleId);
      if (!annotation) {
        annotation = { note: null, favori: false };
        annotations.set(articleId, annotation);
      }
      return annotation;
    };

    try {
      const notes = await db
        .select({ articleId: utilisateursArticles.articleId, note: utilisateursArticles.note, favori: utilisateursArticles.favori })
        .from(utilisateursArticles)
        .where(and(eq(utilisateursArticles.utilisateurId, utilisateurId), inArray(utilisateursArticles.articleId, articleIds)));
      for (const ligne of notes) {
        const annotation = obtenir(ligne.articleId);
        annotation.note = ligne.note ?? null;
        annotation.favori = ligne.favori;
      }

      return annotations;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de la lecture des annotations');
      throw erreur;
    }
  }
}
