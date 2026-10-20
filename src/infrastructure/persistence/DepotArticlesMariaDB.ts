/**
 * Veilleur - Implémentation du dépôt articles avec MariaDB
 */

import { eq, and, lt, desc, asc, sql, inArray } from 'drizzle-orm';
import type {
  DepotArticles,
  CriteresArticles,
  ResultatPagineArticles,
  CacheArticles,
} from '@/domaine/ports/DepotArticles';
import type { Article, ArticleAvecSource, MetaOpenGraph, MetaTwitter } from '@/domaine/entites/Article';
import { resoudreTri } from '@/domaine/entites/Article';
import { obtenirBdd } from './connexion';
import { articles, sources, utilisateursSources, utilisateursSourcesTags, tags, utilisateursArticles } from './schema';
import { loggerBdd } from '../logging/logger';
import { createId } from '@paralleldrive/cuid2';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE, TTL_DEFAUT } from '@/domaine/ports/ServiceCache';
import { decoderCurseur, encoderCurseur } from './paginationCurseur';

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
    const limite = criteres?.limite ?? 20;

    try {
      // 1. Récupérer les sources de l'utilisateur
      const sourcesUtilisateur = await db
        .select({ sourceId: utilisateursSources.sourceId })
        .from(utilisateursSources)
        .where(
          and(
            eq(utilisateursSources.utilisateurId, utilisateurId),
            eq(utilisateursSources.estEnPause, false),
          ),
        );

      let sourceIds = sourcesUtilisateur.map(s => s.sourceId);

      if (sourceIds.length === 0) {
        return {
          donnees: [],
          pagination: criteres?.curseur ? undefined : { page: 1, limite, total: 0, totalPages: 0 },
        };
      }

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
            .select({ sourceId: utilisateursSources.sourceId })
            .from(utilisateursSources)
            .innerJoin(utilisateursSourcesTags, eq(utilisateursSources.id, utilisateursSourcesTags.utilisateurSourceId))
            .where(
              and(
                eq(utilisateursSources.utilisateurId, utilisateurId),
                eq(utilisateursSourcesTags.tagId, tagId),
              ),
            );

          sourceIds = utilisateurSourcesAvecTag.map(u => u.sourceId);
          if (sourceIds.length === 0) {
            return {
              donnees: [],
              pagination: criteres?.curseur ? undefined : { page: 1, limite, total: 0, totalPages: 0 },
            };
          }
        }
      }

      // 2. Construire les conditions WHERE
      const conditions = [inArray(articles.sourceId, sourceIds)];

      if (criteres?.sourceId) {
        conditions.push(eq(articles.sourceId, criteres.sourceId));
      }

      if (criteres?.depuis) {
        conditions.push(sql`${articles.datePublication} >= ${criteres.depuis}`);
      }

      if (criteres?.recherche) {
        // Mode IN BOOLEAN MODE pour permettre des recherches avancées (+mot -mot)
        // et mieux gérer les mots courts
        conditions.push(sql`MATCH(${articles.titre}, ${articles.resume}) AGAINST (${criteres.recherche} IN BOOLEAN MODE)`);
      }

      // Filtres sur les annotations de l'utilisateur (jointure gauche plus bas)
      if (criteres?.noteMin) {
        conditions.push(sql`${utilisateursArticles.note} >= ${criteres.noteMin}`);
      }
      if (criteres?.favoris) {
        conditions.push(eq(utilisateursArticles.favori, true));
      }
      if (criteres?.tagArticle) {
        conditions.push(
          sql`EXISTS (SELECT 1 FROM utilisateurs_articles_tags uat INNER JOIN tags t ON t.id = uat.tag_id
            WHERE uat.utilisateur_id = ${utilisateurId} AND uat.article_id = ${articles.id} AND t.slug = ${criteres.tagArticle})`,
        );
      }

      // Tri : le curseur (clé date+id) n'a de sens que pour le tri par date décroissante
      const { tri, ordre } = resoudreTri(criteres?.tri, criteres?.ordre);
      const curseurUtilisable = tri === 'date' && ordre === 'desc';

      // Support du curseur
      const curseur = curseurUtilisable && criteres?.curseur ? decoderCurseur(criteres.curseur) : null;
      const direction = criteres?.direction ?? 'apres';

      if (curseur) {
        // Condition stable: (date < valeur) OR (date = valeur AND id < id)
        conditions.push(
          sql`(${articles.datePublication} ${sql.raw(direction === 'apres' ? '<' : '>')} ${new Date(curseur.valeurTri as string)} 
          OR (${articles.datePublication} = ${new Date(curseur.valeurTri as string)} 
          AND ${articles.id} ${sql.raw(direction === 'apres' ? '<' : '>')} ${curseur.id}))`,
        );
      }

      // 3. Exécuter la requête
      const jointureAnnotations = and(
        eq(utilisateursArticles.articleId, articles.id),
        eq(utilisateursArticles.utilisateurId, utilisateurId),
      );
      const ordonner = ordre === 'desc' ? desc : asc;
      const ordresTri =
        tri === 'note'
          ? [sql`${utilisateursArticles.note} IS NULL`, ordonner(utilisateursArticles.note), desc(articles.datePublication)]
          : tri === 'titre'
            ? [ordonner(articles.titre), desc(articles.datePublication)]
            : tri === 'source'
              ? [ordonner(sources.nom), desc(articles.datePublication), desc(articles.id)]
              : curseur && direction === 'avant'
                ? [asc(articles.datePublication), asc(articles.id)]
                : [ordonner(articles.datePublication), ordonner(articles.id)];

      const query = db
        .select({
          article: articles,
          source: {
            nom: sources.nom,
            urlFavicon: sources.urlFavicon,
          },
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .leftJoin(utilisateursArticles, jointureAnnotations)
        .where(and(...conditions))
        .orderBy(...ordresTri)
        .limit(limite + 1); // +1 pour détecter s'il y a une suite

      // Support de l'offset si pas de curseur (legacy)
      if (!curseur && criteres?.page) {
        const offset = (criteres.page - 1) * limite;
        query.offset(offset);
      }

      const resultats = await query;

      const aPlusDirection = resultats.length > limite;
      const rows = aPlusDirection ? resultats.slice(0, limite) : resultats;

      // Inverser si on allait vers l'avant (plus récent) pour garder l'ordre chronologique inverse
      if (direction === 'avant') {
        rows.reverse();
      }

      const articlesAvecSource: ArticleAvecSource[] = rows.map(r => ({
        ...this.versArticle(r.article),
        source: {
          nom: r.source.nom,
          urlFavicon: r.source.urlFavicon,
        },
      }));

      // 4. Construire le résultat
      if (curseur || (!criteres?.page && curseurUtilisable && !criteres?.curseur)) {
        // Mode curseur
        const premier = articlesAvecSource[0];
        const dernier = articlesAvecSource[articlesAvecSource.length - 1];

        const aPlusAvant = direction === 'avant' ? aPlusDirection : !!curseur;
        const aPlusApres = direction === 'apres' ? aPlusDirection : true;

        return {
          donnees: articlesAvecSource,
          curseurs: {
            debut: premier ? encoderCurseur({ id: premier.id, datePublication: premier.datePublication }, 'datePublication') : null,
            fin: dernier ? encoderCurseur({ id: dernier.id, datePublication: dernier.datePublication }, 'datePublication') : null,
            suivant: (direction === 'apres' && aPlusDirection) || (direction === 'avant' && !!curseur) ? encoderCurseur({ id: dernier!.id, datePublication: dernier!.datePublication }, 'datePublication') : null,
            precedent: (direction === 'avant' && aPlusDirection) || (direction === 'apres' && !!curseur) ? encoderCurseur({ id: premier!.id, datePublication: premier!.datePublication }, 'datePublication') : null,
          },
          aPlus: {
            avant: aPlusAvant,
            apres: aPlusApres,
          },
        };
      } else {
        // Mode offset : total avec les mêmes filtres que la liste
        const totalResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(articles)
          .innerJoin(sources, eq(articles.sourceId, sources.id))
          .leftJoin(utilisateursArticles, jointureAnnotations)
          .where(and(...conditions));

        const total = totalResult[0]?.count ?? 0;
        const page = criteres?.page ?? 1;

        return {
          donnees: articlesAvecSource,
          pagination: {
            page,
            limite,
            total,
            totalPages: Math.ceil(total / limite),
          },
        };
      }
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
