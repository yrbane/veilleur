/**
 * Veilleur - Dépôt des annotations d'articles (note, tags) avec MariaDB
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DepotAnnotationsArticles } from '@/domaine/ports/DepotAnnotationsArticles';
import type { AnnotationArticle, TagArticlesUtilise } from '@/domaine/entites/Article';
import { obtenirBdd } from './connexion';
import { tags, utilisateursArticles, utilisateursArticlesTags } from './schema';
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

  async definirTags(utilisateurId: string, articleId: string, tagIds: string[]): Promise<void> {
    const db = obtenirBdd();
    try {
      await db.transaction(async tx => {
        await tx
          .delete(utilisateursArticlesTags)
          .where(and(eq(utilisateursArticlesTags.utilisateurId, utilisateurId), eq(utilisateursArticlesTags.articleId, articleId)));
        if (tagIds.length > 0) {
          await tx.insert(utilisateursArticlesTags).values(tagIds.map(tagId => ({ utilisateurId, articleId, tagId })));
        }
      });
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, articleId }, 'Erreur lors du classement de l\'article');
      throw erreur;
    }
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
        annotation = { note: null, favori: false, tags: [] };
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

      const lignesTags = await db
        .select({ articleId: utilisateursArticlesTags.articleId, tag: tags })
        .from(utilisateursArticlesTags)
        .innerJoin(tags, eq(utilisateursArticlesTags.tagId, tags.id))
        .where(and(eq(utilisateursArticlesTags.utilisateurId, utilisateurId), inArray(utilisateursArticlesTags.articleId, articleIds)))
        .orderBy(tags.nom);
      for (const ligne of lignesTags) {
        obtenir(ligne.articleId).tags.push(ligne.tag);
      }
      return annotations;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de la lecture des annotations');
      throw erreur;
    }
  }

  async listerTagsUtilises(utilisateurId: string): Promise<TagArticlesUtilise[]> {
    const db = obtenirBdd();
    try {
      const lignes = await db
        .select({
          id: tags.id,
          nom: tags.nom,
          slug: tags.slug,
          dateCreation: tags.dateCreation,
          nombreArticles: sql<number>`COUNT(*)`,
        })
        .from(utilisateursArticlesTags)
        .innerJoin(tags, eq(utilisateursArticlesTags.tagId, tags.id))
        .where(eq(utilisateursArticlesTags.utilisateurId, utilisateurId))
        .groupBy(tags.id, tags.nom, tags.slug, tags.dateCreation)
        .orderBy(desc(sql`COUNT(*)`), tags.nom);
      return lignes.map(l => ({ ...l, nombreArticles: Number(l.nombreArticles) }));
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors du listing des tags d\'articles');
      throw erreur;
    }
  }
}
