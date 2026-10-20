/**
 * Veilleur - Dépôt des annotations d'articles (note, favori) avec MariaDB
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DepotAnnotationsArticles } from '@/domaine/ports/DepotAnnotationsArticles';
import type { AnnotationArticle, AnnotationExportee } from '@/domaine/entites/Article';
import { obtenirBdd } from './connexion';
import { articles, sources, utilisateursArticles } from './schema';
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
  async marquerLu(utilisateurId: string, articleId: string, lu: boolean): Promise<void> {
    try {
      await this.enregistrer(utilisateurId, articleId, { luLe: lu ? new Date() : null });
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, articleId }, 'Erreur lors du marquage lu de l\'article');
      throw erreur;
    }
  }

  async definirALire(utilisateurId: string, articleId: string, aLire: boolean): Promise<void> {
    try {
      await this.enregistrer(utilisateurId, articleId, { aLire });
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, articleId }, 'Erreur lors de la mise en liste de lecture');
      throw erreur;
    }
  }

  async listerAnnotations(utilisateurId: string): Promise<AnnotationExportee[]> {
    const db = obtenirBdd();
    try {
      const lignes = await db
        .select({
          articleId: utilisateursArticles.articleId,
          titre: articles.titre,
          lien: articles.lien,
          source: sources.nom,
          datePublication: articles.datePublication,
          note: utilisateursArticles.note,
          favori: utilisateursArticles.favori,
          aLire: utilisateursArticles.aLire,
          luLe: utilisateursArticles.luLe,
          dateMiseAJour: utilisateursArticles.dateMiseAJour,
        })
        .from(utilisateursArticles)
        .innerJoin(articles, eq(articles.id, utilisateursArticles.articleId))
        .innerJoin(sources, eq(sources.id, articles.sourceId))
        .where(eq(utilisateursArticles.utilisateurId, utilisateurId))
        .orderBy(desc(utilisateursArticles.dateMiseAJour));
      return lignes.map(ligne => ({
        articleId: ligne.articleId,
        titre: ligne.titre,
        lien: ligne.lien,
        source: ligne.source,
        datePublication: ligne.datePublication,
        note: ligne.note ?? null,
        favori: ligne.favori,
        aLire: ligne.aLire,
        lu: ligne.luLe !== null,
        dateMiseAJour: ligne.dateMiseAJour,
      }));
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de l\'export des annotations');
      throw erreur;
    }
  }

  private async enregistrer(
    utilisateurId: string,
    articleId: string,
    valeurs: { note?: number | null; favori?: boolean; luLe?: Date | null; aLire?: boolean },
  ): Promise<void> {
    const db = obtenirBdd();
    const cle = and(eq(utilisateursArticles.utilisateurId, utilisateurId), eq(utilisateursArticles.articleId, articleId));
    await db
      .insert(utilisateursArticles)
      .values({ utilisateurId, articleId, note: valeurs.note ?? null, favori: valeurs.favori ?? false, luLe: valeurs.luLe ?? null, aLire: valeurs.aLire ?? false, dateMiseAJour: new Date() })
      .onDuplicateKeyUpdate({ set: { ...valeurs, dateMiseAJour: new Date() } });
    await db
      .delete(utilisateursArticles)
      .where(and(cle, sql`${utilisateursArticles.note} IS NULL`, eq(utilisateursArticles.favori, false), sql`${utilisateursArticles.luLe} IS NULL`, eq(utilisateursArticles.aLire, false)));
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
        annotation = { note: null, favori: false, lu: false, aLire: false };
        annotations.set(articleId, annotation);
      }
      return annotation;
    };

    try {
      const notes = await db
        .select({ articleId: utilisateursArticles.articleId, note: utilisateursArticles.note, favori: utilisateursArticles.favori, luLe: utilisateursArticles.luLe, aLire: utilisateursArticles.aLire })
        .from(utilisateursArticles)
        .where(and(eq(utilisateursArticles.utilisateurId, utilisateurId), inArray(utilisateursArticles.articleId, articleIds)));
      for (const ligne of notes) {
        const annotation = obtenir(ligne.articleId);
        annotation.note = ligne.note ?? null;
        annotation.favori = ligne.favori;
        annotation.lu = ligne.luLe !== null;
        annotation.aLire = ligne.aLire;
      }

      return annotations;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de la lecture des annotations');
      throw erreur;
    }
  }
}
