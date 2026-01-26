/**
 * Veilleur - Implémentation du dépôt articles avec MariaDB
 */

import { eq, and, lt, desc, sql, inArray } from 'drizzle-orm';
import type {
  DepotArticles,
  CriteresArticles,
  ResultatPagineArticles,
  CacheArticles,
} from '@/domaine/ports/DepotArticles';
import type { Article, ArticleAvecSource, MetaOpenGraph, MetaTwitter } from '@/domaine/entites/Article';
import { obtenirBdd } from './connexion';
import { articles, sources, utilisateursSources, utilisateursSourcesTags, tags } from './schema';
import { loggerBdd } from '../logging/logger';
import { createId } from '@paralleldrive/cuid2';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE, TTL_DEFAUT } from '@/domaine/ports/ServiceCache';

/**
 * Implémentation du dépôt articles avec Drizzle ORM
 */
export class DepotArticlesMariaDB implements DepotArticles {
  async trouverParId(id: string): Promise<Article | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(articles)
        .where(eq(articles.id, id))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versArticle(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la recherche article par ID');
      throw erreur;
    }
  }

  async trouverParHashContenu(hashContenu: string): Promise<Article | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(articles)
        .where(eq(articles.hashContenu, hashContenu))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versArticle(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, hashContenu }, 'Erreur lors de la recherche article par hash');
      throw erreur;
    }
  }

  async creer(donnees: Omit<Article, 'id' | 'dateExtraction'>): Promise<Article> {
    const db = obtenirBdd();
    const id = createId();
    const dateExtraction = new Date();

    try {
      await db.insert(articles).values({
        id,
        sourceId: donnees.sourceId,
        titre: donnees.titre,
        lien: donnees.lien,
        datePublication: donnees.datePublication,
        resume: donnees.resume,
        urlImage: donnees.urlImage,
        auteur: donnees.auteur,
        metaOpenGraph: donnees.metaOpenGraph ?? {},
        metaTwitter: donnees.metaTwitter ?? {},
        hashContenu: donnees.hashContenu,
        dateExtraction,
      });

      loggerBdd.debug({ id, titre: donnees.titre }, 'Article créé');

      return {
        id,
        ...donnees,
        dateExtraction,
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, lien: donnees.lien }, 'Erreur lors de la création article');
      throw erreur;
    }
  }

  async creerPlusieurs(
    articlesData: Omit<Article, 'id' | 'dateExtraction'>[],
  ): Promise<Article[]> {
    if (articlesData.length === 0) {
      return [];
    }

    const db = obtenirBdd();
    const dateExtraction = new Date();

    try {
      const articlesAvecId = articlesData.map(a => ({
        id: createId(),
        sourceId: a.sourceId,
        titre: a.titre,
        lien: a.lien,
        datePublication: a.datePublication,
        resume: a.resume,
        urlImage: a.urlImage,
        auteur: a.auteur,
        metaOpenGraph: a.metaOpenGraph ?? {},
        metaTwitter: a.metaTwitter ?? {},
        hashContenu: a.hashContenu,
        dateExtraction,
      }));

      await db.insert(articles).values(articlesAvecId);

      loggerBdd.info({ nombre: articlesAvecId.length }, 'Articles créés en lot');

      return articlesAvecId.map(a => ({
        ...a,
        metaOpenGraph: (a.metaOpenGraph as MetaOpenGraph) ?? {},
        metaTwitter: (a.metaTwitter as MetaTwitter) ?? {},
      }));
    } catch (erreur) {
      loggerBdd.error({ erreur, nombre: articlesData.length }, 'Erreur lors de la création en lot');
      throw erreur;
    }
  }

  async mettreAJour(id: string, donnees: Partial<Article>): Promise<Article | null> {
    const db = obtenirBdd();

    try {
      const updateData: Record<string, unknown> = {};

      if (donnees.titre !== undefined) updateData.titre = donnees.titre;
      if (donnees.lien !== undefined) updateData.lien = donnees.lien;
      if (donnees.datePublication !== undefined) updateData.datePublication = donnees.datePublication;
      if (donnees.resume !== undefined) updateData.resume = donnees.resume;
      if (donnees.urlImage !== undefined) updateData.urlImage = donnees.urlImage;
      if (donnees.auteur !== undefined) updateData.auteur = donnees.auteur;
      if (donnees.metaOpenGraph !== undefined) updateData.metaOpenGraph = donnees.metaOpenGraph;
      if (donnees.metaTwitter !== undefined) updateData.metaTwitter = donnees.metaTwitter;
      if (donnees.hashContenu !== undefined) updateData.hashContenu = donnees.hashContenu;

      if (Object.keys(updateData).length === 0) {
        return this.trouverParId(id);
      }

      await db.update(articles).set(updateData).where(eq(articles.id, id));

      loggerBdd.debug({ id }, 'Article mis à jour');

      return this.trouverParId(id);
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la mise à jour article');
      throw erreur;
    }
  }

  async supprimerParSource(sourceId: string): Promise<number> {
    const db = obtenirBdd();

    try {
      const resultat = await db.delete(articles).where(eq(articles.sourceId, sourceId));
      const supprimes = (resultat as unknown as { affectedRows: number }).affectedRows;

      if (supprimes > 0) {
        loggerBdd.info({ sourceId, supprimes }, 'Articles de source supprimés');
      }

      return supprimes;
    } catch (erreur) {
      loggerBdd.error({ erreur, sourceId }, 'Erreur lors de la suppression articles source');
      throw erreur;
    }
  }

  async supprimerAnciens(avantDate: Date): Promise<number> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .delete(articles)
        .where(lt(articles.datePublication, avantDate));

      const supprimes = (resultat as unknown as { affectedRows: number }).affectedRows;

      if (supprimes > 0) {
        loggerBdd.info({ avantDate, supprimes }, 'Articles anciens supprimés');
      }

      return supprimes;
    } catch (erreur) {
      loggerBdd.error({ erreur, avantDate }, 'Erreur lors de la suppression articles anciens');
      throw erreur;
    }
  }

  async listerFilUtilisateur(
    utilisateurId: string,
    criteres?: CriteresArticles,
  ): Promise<ResultatPagineArticles> {
    const db = obtenirBdd();
    const page = criteres?.page ?? 1;
    const limite = criteres?.limite ?? 20;
    const offset = (page - 1) * limite;

    try {
      // Récupérer les IDs des sources de l'utilisateur
      const sourcesQuery = db
        .select({ sourceId: utilisateursSources.sourceId })
        .from(utilisateursSources)
        .where(
          and(
            eq(utilisateursSources.utilisateurId, utilisateurId),
            eq(utilisateursSources.estEnPause, false),
          ),
        );

      // Filtrer par tag si spécifié
      if (criteres?.tag) {
        const tagResult = await db
          .select({ id: tags.id })
          .from(tags)
          .where(eq(tags.slug, criteres.tag))
          .limit(1);

        const tagFound = tagResult[0];
        if (tagFound) {
          const tagId = tagFound.id;
          const utilisateurSourcesAvecTag = await db
            .select({ utilisateurSourceId: utilisateursSourcesTags.utilisateurSourceId })
            .from(utilisateursSourcesTags)
            .where(eq(utilisateursSourcesTags.tagId, tagId));

          const usIds = utilisateurSourcesAvecTag.map(u => u.utilisateurSourceId);
          if (usIds.length === 0) {
            return {
              donnees: [],
              pagination: { page, limite, total: 0, totalPages: 0 },
            };
          }
        }
      }

      const sourcesUtilisateur = await sourcesQuery;
      const sourceIds = sourcesUtilisateur.map(s => s.sourceId);

      if (sourceIds.length === 0) {
        return {
          donnees: [],
          pagination: { page, limite, total: 0, totalPages: 0 },
        };
      }

      // Construire les conditions pour les articles
      const conditions = [inArray(articles.sourceId, sourceIds)];

      if (criteres?.sourceId) {
        conditions.push(eq(articles.sourceId, criteres.sourceId));
      }

      if (criteres?.depuis) {
        conditions.push(sql`${articles.datePublication} >= ${criteres.depuis}`);
      }

      // Compter le total
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(articles)
        .where(and(...conditions));

      const total = totalResult[0]?.count ?? 0;

      // Récupérer les articles avec source
      const resultats = await db
        .select({
          article: articles,
          source: {
            nom: sources.nom,
            urlFavicon: sources.urlFavicon,
          },
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(and(...conditions))
        .orderBy(desc(articles.datePublication))
        .limit(limite)
        .offset(offset);

      const articlesAvecSource: ArticleAvecSource[] = resultats.map(r => ({
        ...this.versArticle(r.article),
        source: {
          nom: r.source.nom,
          urlFavicon: r.source.urlFavicon,
        },
      }));

      return {
        donnees: articlesAvecSource,
        pagination: {
          page,
          limite,
          total,
          totalPages: Math.ceil(total / limite),
        },
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors du listing du fil');
      throw erreur;
    }
  }

  async listerParSource(sourceId: string, limite = 20): Promise<Article[]> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(articles)
        .where(eq(articles.sourceId, sourceId))
        .orderBy(desc(articles.datePublication))
        .limit(limite);

      return resultats.map(r => this.versArticle(r));
    } catch (erreur) {
      loggerBdd.error({ erreur, sourceId }, 'Erreur lors du listing articles source');
      throw erreur;
    }
  }

  async compterParSource(sourceId: string): Promise<number> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(articles)
        .where(eq(articles.sourceId, sourceId));

      return resultat[0]?.count ?? 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, sourceId }, 'Erreur lors du comptage articles');
      throw erreur;
    }
  }

  async articleExiste(hashContenu: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.hashContenu, hashContenu))
        .limit(1);

      return resultats.length > 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, hashContenu }, 'Erreur lors de la vérification existence article');
      throw erreur;
    }
  }

  async existeParLien(lien: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.lien, lien))
        .limit(1);

      return resultats.length > 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, lien }, 'Erreur lors de la vérification existence article par lien');
      throw erreur;
    }
  }

  async trouverDoublonsPotentiels(
    titre: string,
    sourceId: string,
    _seuilSimilarite = 0.8,
  ): Promise<Article[]> {
    const db = obtenirBdd();

    try {
      // Recherche basique par similarité de titre (premiers 50 caractères)
      const prefixe = titre.substring(0, 50).toLowerCase();

      const resultats = await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.sourceId, sourceId),
            sql`LOWER(SUBSTRING(${articles.titre}, 1, 50)) = ${prefixe}`,
          ),
        )
        .limit(10);

      return resultats.map(r => this.versArticle(r));
    } catch (erreur) {
      loggerBdd.error({ erreur, titre, sourceId }, 'Erreur lors de la recherche doublons');
      throw erreur;
    }
  }

  private versArticle(row: typeof articles.$inferSelect): Article {
    return {
      id: row.id,
      sourceId: row.sourceId,
      titre: row.titre,
      lien: row.lien,
      datePublication: row.datePublication,
      resume: row.resume,
      urlImage: row.urlImage,
      auteur: row.auteur,
      metaOpenGraph: (row.metaOpenGraph as MetaOpenGraph) ?? {},
      metaTwitter: (row.metaTwitter as MetaTwitter) ?? {},
      hashContenu: row.hashContenu,
      dateExtraction: row.dateExtraction,
    };
  }
}

/**
 * Implémentation du cache d'articles utilisant le service cache
 */
export class CacheArticlesRedis implements CacheArticles {
  constructor(private serviceCache: ServiceCache) {}

  async obtenir(sourceId: string): Promise<Article[] | null> {
    const cle = `${PREFIXES_CACHE.ARTICLES}${sourceId}`;
    return this.serviceCache.obtenir<Article[]>(cle);
  }

  async stocker(
    sourceId: string,
    articlesData: Article[],
    ttlSecondes = TTL_DEFAUT.ARTICLES,
  ): Promise<void> {
    const cle = `${PREFIXES_CACHE.ARTICLES}${sourceId}`;
    await this.serviceCache.stocker(cle, articlesData, { ttl: ttlSecondes });
  }

  async invalider(sourceId: string): Promise<void> {
    const cle = `${PREFIXES_CACHE.ARTICLES}${sourceId}`;
    await this.serviceCache.supprimer(cle);
  }

  async estValide(sourceId: string): Promise<boolean> {
    const cle = `${PREFIXES_CACHE.ARTICLES}${sourceId}`;
    const ttl = await this.serviceCache.ttl(cle);
    return ttl > 0;
  }
}
