/**
 * Veilleur - Service de gestion des articles
 * Logique métier pour la récupération et la synchronisation des articles
 */

import type { DepotArticles, CriteresArticles, ResultatPagineArticles } from '@/domaine/ports/DepotArticles';
import type { DepotSources } from '@/domaine/ports/DepotSources';
import type { Article, ArticleBrut } from '@/domaine/entites/Article';
import { hashContenu, selectionnerImage, selectionnerResume } from '@/domaine/entites/Article';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE, TTL_DEFAUT } from '@/domaine/ports/ServiceCache';

/**
 * Options de synchronisation
 */
export interface OptionsSynchronisation {
  maxArticlesParSource?: number;
  enrichirMetadonnees?: boolean;
}

/**
 * Résultat d'une synchronisation
 */
export interface ResultatSynchronisation {
  sourceId: string;
  nouveauxArticles: number;
  articlesIgnores: number;
  erreur?: string;
}

/**
 * Erreurs du service articles
 */
export class ErreurArticle extends Error {
  constructor(
    message: string,
    public readonly code: 'SOURCE_INTROUVABLE' | 'ARTICLE_INTROUVABLE' | 'SYNCHRONISATION_ECHOUEE',
  ) {
    super(message);
    this.name = 'ErreurArticle';
  }
}

/**
 * Interface pour le service de scraping (injection)
 */
export interface IServiceScraping {
  extraireArticles(url: string, type?: string): Promise<{
    articles: ArticleBrut[];
    titre: string | null;
    favicon: string | null;
    type: string;
  }>;
  enrichirArticle(url: string): Promise<{
    openGraph: Record<string, string | undefined>;
    twitter: Record<string, string | undefined>;
  }>;
}

/**
 * Service de gestion des articles
 */
export class ServiceArticles {
  constructor(
    private readonly depotArticles: DepotArticles,
    private readonly depotSources: DepotSources,
    private readonly serviceCache: ServiceCache,
    private readonly serviceScraping?: IServiceScraping,
  ) {}

  /**
   * Liste les articles du fil d'un utilisateur
   */
  async listerFil(
    utilisateurId: string,
    criteres?: CriteresArticles,
  ): Promise<ResultatPagineArticles> {
    // Essayer de récupérer depuis le cache
    const cleCache = `${PREFIXES_CACHE.ARTICLES}fil:${utilisateurId}:${JSON.stringify(criteres ?? {})}`;

    const cache = await this.serviceCache.obtenir<ResultatPagineArticles>(cleCache);
    if (cache) {
      return cache;
    }

    // Récupérer depuis la base
    const resultat = await this.depotArticles.listerFilUtilisateur(utilisateurId, criteres);

    // Mettre en cache (courte durée car les articles changent souvent)
    await this.serviceCache.stocker(cleCache, resultat, { ttl: 60 });

    return resultat;
  }

  /**
   * Récupère un article par son ID
   */
  async obtenirArticle(id: string): Promise<Article | null> {
    return this.depotArticles.trouverParId(id);
  }

  /**
   * Liste les articles d'une source
   */
  async listerArticlesSource(sourceId: string, limite?: number): Promise<Article[]> {
    // Vérifier le cache
    const cleCache = `${PREFIXES_CACHE.ARTICLES}source:${sourceId}`;
    const cache = await this.serviceCache.obtenir<Article[]>(cleCache);

    if (cache) {
      return cache.slice(0, limite);
    }

    const articles = await this.depotArticles.listerParSource(sourceId, limite);

    // Mettre en cache
    await this.serviceCache.stocker(cleCache, articles, { ttl: TTL_DEFAUT.ARTICLES });

    return articles;
  }

  /**
   * Synchronise les articles d'une source
   */
  async synchroniserSource(
    sourceId: string,
    options?: OptionsSynchronisation,
  ): Promise<ResultatSynchronisation> {
    const source = await this.depotSources.trouverParId(sourceId);

    if (!source) {
      throw new ErreurArticle('Source introuvable', 'SOURCE_INTROUVABLE');
    }

    if (!this.serviceScraping) {
      return {
        sourceId,
        nouveauxArticles: 0,
        articlesIgnores: 0,
        erreur: 'Service de scraping non disponible',
      };
    }

    try {
      // Extraire les articles
      const extraction = await this.serviceScraping.extraireArticles(source.url, source.typeSource);
      const maxArticles = options?.maxArticlesParSource ?? 50;

      let nouveauxArticles = 0;
      let articlesIgnores = 0;

      // Traiter chaque article
      for (const articleBrut of extraction.articles.slice(0, maxArticles)) {
        try {
          // Générer le hash pour déduplication
          const hash = await hashContenu(articleBrut);

          // Vérifier si l'article existe déjà
          if (await this.depotArticles.articleExiste(hash)) {
            articlesIgnores++;
            continue;
          }

          // Enrichir avec les métadonnées si demandé
          let metaOpenGraph = {};
          let metaTwitter = {};

          if (options?.enrichirMetadonnees && articleBrut.lien) {
            const meta = await this.serviceScraping.enrichirArticle(articleBrut.lien);
            metaOpenGraph = meta.openGraph;
            metaTwitter = meta.twitter;
          }

          // Créer l'article
          await this.depotArticles.creer({
            sourceId,
            titre: articleBrut.titre,
            lien: articleBrut.lien,
            datePublication: articleBrut.datePublication ?? new Date(),
            resume: selectionnerResume(articleBrut, { openGraph: metaOpenGraph, twitter: metaTwitter }),
            urlImage: selectionnerImage(articleBrut, { openGraph: metaOpenGraph, twitter: metaTwitter }),
            auteur: articleBrut.auteur,
            metaOpenGraph,
            metaTwitter,
            hashContenu: hash,
          });

          nouveauxArticles++;
        } catch (erreur) {
          // Continuer avec les autres articles en cas d'erreur
          // Log silencieux pour ne pas polluer les logs
          console.warn('Erreur création article:', (erreur as Error).message);
          articlesIgnores++;
        }
      }

      // Invalider le cache
      await this.serviceCache.supprimer(`${PREFIXES_CACHE.ARTICLES}source:${sourceId}`);
      await this.serviceCache.supprimerPattern(`${PREFIXES_CACHE.ARTICLES}fil:*`);

      return {
        sourceId,
        nouveauxArticles,
        articlesIgnores,
      };
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : 'Erreur inconnue';
      return {
        sourceId,
        nouveauxArticles: 0,
        articlesIgnores: 0,
        erreur: message,
      };
    }
  }

  /**
   * Synchronise toutes les sources à rafraîchir
   */
  async synchroniserToutesSources(limite?: number): Promise<ResultatSynchronisation[]> {
    const sources = await this.depotSources.listerSourcesARafraichir(limite);
    const resultats: ResultatSynchronisation[] = [];

    for (const source of sources) {
      try {
        const resultat = await this.synchroniserSource(source.id);
        resultats.push(resultat);

        // Mettre à jour la date de synchronisation
        if (!resultat.erreur) {
          await this.depotSources.mettreAJour(source.id, {
            dateDerniereSynchro: new Date(),
            statut: 'active',
          });
          await this.depotSources.reinitialiserEchecs(source.id);
        } else {
          await this.depotSources.incrementerEchecs(source.id);
        }
      } catch {
        resultats.push({
          sourceId: source.id,
          nouveauxArticles: 0,
          articlesIgnores: 0,
          erreur: 'Échec de synchronisation',
        });
        await this.depotSources.incrementerEchecs(source.id);
      }
    }

    return resultats;
  }

  /**
   * Nettoie les articles anciens
   */
  async nettoyerArticlesAnciens(joursRetention: number): Promise<number> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - joursRetention);

    return this.depotArticles.supprimerAnciens(dateLimit);
  }

  /**
   * Compte les articles d'une source
   */
  async compterArticlesSource(sourceId: string): Promise<number> {
    return this.depotArticles.compterParSource(sourceId);
  }
}
