/**
 * Veilleur - Routes des articles
 * Consultation du fil d'actualités et des articles
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifierAuthentification } from '@/api/middlewares/authentification';
import { ServiceArticles, ErreurArticle } from '@/domaine/services/ServiceArticles';
import { DepotArticlesMariaDB } from '@/infrastructure/persistence/DepotArticlesMariaDB';
import { DepotSourcesMariaDB } from '@/infrastructure/persistence/DepotSourcesMariaDB';
import { obtenirServiceCache } from '@/infrastructure/cache/ServiceCacheRedis';
import { obtenirServiceScraping } from '@/infrastructure/scraping/ServiceScraping';
import { loggerHttp } from '@/infrastructure/logging/logger';

/**
 * Schémas de validation
 */
const schemaCriteresFil = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  sourceId: z.string().optional(),
  tag: z.string().optional(),
  depuis: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

/**
 * Instance du service articles (lazy)
 */
let serviceArticles: ServiceArticles | null = null;

function obtenirServiceArticles(): ServiceArticles {
  if (!serviceArticles) {
    const depotArticles = new DepotArticlesMariaDB();
    const depotSources = new DepotSourcesMariaDB();
    const serviceCache = obtenirServiceCache();
    const serviceScraping = obtenirServiceScraping();

    serviceArticles = new ServiceArticles(
      depotArticles,
      depotSources,
      serviceCache,
      serviceScraping,
    );
  }
  return serviceArticles;
}

/**
 * Gère les erreurs du service articles
 */
function gererErreurArticle(erreur: unknown, reply: FastifyReply): FastifyReply {
  if (erreur instanceof ErreurArticle) {
    const statusCodes: Record<string, number> = {
      SOURCE_INTROUVABLE: 404,
      ARTICLE_INTROUVABLE: 404,
      SYNCHRONISATION_ECHOUEE: 502,
    };

    return reply.status(statusCodes[erreur.code] ?? 400).send({
      erreur: erreur.code,
      message: erreur.message,
    });
  }

  if (erreur instanceof z.ZodError) {
    return reply.status(400).send({
      erreur: 'VALIDATION_ERREUR',
      message: 'Données invalides',
      details: erreur.errors.map(e => ({
        champ: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  loggerHttp.error({ erreur }, 'Erreur inattendue dans articles');
  return reply.status(500).send({
    erreur: 'ERREUR_INTERNE',
    message: 'Une erreur est survenue',
  });
}

/**
 * Enregistre les routes des articles
 */
export async function routesArticles(fastify: FastifyInstance): Promise<void> {
  // Toutes les routes nécessitent une authentification
  fastify.addHook('preHandler', verifierAuthentification);

  /**
   * GET /api/v1/articles/fil
   * Récupère le fil d'actualités de l'utilisateur
   */
  fastify.get('/fil', {
    schema: {
      tags: ['Articles'],
      summary: 'Récupère le fil d\'actualités',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limite: { type: 'number', default: 20 },
          sourceId: { type: 'string' },
          tag: { type: 'string' },
          depuis: { type: 'string', format: 'date-time' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            donnees: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  titre: { type: 'string' },
                  lien: { type: 'string' },
                  datePublication: { type: 'string' },
                  resume: { type: 'string', nullable: true },
                  urlImage: { type: 'string', nullable: true },
                  auteur: { type: 'string', nullable: true },
                  source: {
                    type: 'object',
                    properties: {
                      nom: { type: 'string' },
                      urlFavicon: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limite: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // L'utilisateur est garanti par le middleware verifierAuthentification
      const utilisateur = request.utilisateur!;

      const criteres = schemaCriteresFil.parse(request.query);
      const service = obtenirServiceArticles();
      const resultat = await service.listerFil(utilisateur.sub, {
        ...criteres,
        utilisateurId: utilisateur.sub,
      });

      return reply.send(resultat);
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * GET /api/v1/articles/:id
   * Récupère un article par son ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Articles'],
      summary: 'Récupère un article',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            titre: { type: 'string' },
            lien: { type: 'string' },
            datePublication: { type: 'string' },
            resume: { type: 'string', nullable: true },
            urlImage: { type: 'string', nullable: true },
            auteur: { type: 'string', nullable: true },
            metaOpenGraph: { type: 'object' },
            metaTwitter: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const service = obtenirServiceArticles();
      const article = await service.obtenirArticle(request.params.id);

      if (!article) {
        return reply.status(404).send({
          erreur: 'ARTICLE_INTROUVABLE',
          message: 'Article introuvable',
        });
      }

      return reply.send(article);
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * GET /api/v1/articles/source/:sourceId
   * Récupère les articles d'une source spécifique
   */
  fastify.get<{ Params: { sourceId: string }; Querystring: { limite?: number } }>(
    '/source/:sourceId',
    {
      schema: {
        tags: ['Articles'],
        summary: 'Récupère les articles d\'une source',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['sourceId'],
          properties: {
            sourceId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limite: { type: 'number', default: 20 },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                titre: { type: 'string' },
                lien: { type: 'string' },
                datePublication: { type: 'string' },
                resume: { type: 'string', nullable: true },
                urlImage: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const limite = request.query.limite ?? 20;
        const service = obtenirServiceArticles();
        const articles = await service.listerArticlesSource(request.params.sourceId, limite);

        return reply.send(articles);
      } catch (erreur) {
        return gererErreurArticle(erreur, reply);
      }
    },
  );

  /**
   * POST /api/v1/articles/synchroniser/:sourceId
   * Synchronise manuellement les articles d'une source
   */
  fastify.post<{ Params: { sourceId: string } }>('/synchroniser/:sourceId', {
    schema: {
      tags: ['Articles'],
      summary: 'Synchronise les articles d\'une source',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['sourceId'],
        properties: {
          sourceId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            nouveauxArticles: { type: 'number' },
            articlesIgnores: { type: 'number' },
            erreur: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const utilisateur = request.utilisateur!;

      const service = obtenirServiceArticles();
      const resultat = await service.synchroniserSource(request.params.sourceId, {
        enrichirMetadonnees: true,
      });

      loggerHttp.info(
        {
          utilisateurId: utilisateur.sub,
          sourceId: request.params.sourceId,
          nouveauxArticles: resultat.nouveauxArticles,
        },
        'Synchronisation manuelle',
      );

      return reply.send(resultat);
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * GET /api/v1/articles/statistiques
   * Récupère les statistiques des articles de l'utilisateur
   */
  fastify.get('/statistiques', {
    schema: {
      tags: ['Articles'],
      summary: 'Statistiques des articles',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            totalArticles: { type: 'number' },
            articlesAujourdhui: { type: 'number' },
            articlesCetteSemaine: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const utilisateur = request.utilisateur!;
      const service = obtenirServiceArticles();

      // Récupérer les stats basiques
      const maintenant = new Date();
      const debutJour = new Date(maintenant);
      debutJour.setHours(0, 0, 0, 0);

      const debutSemaine = new Date(maintenant);
      debutSemaine.setDate(debutSemaine.getDate() - 7);

      const [totalArticles, articlesJour, articlesSemaine] = await Promise.all([
        service.listerFil(utilisateur.sub, { limite: 1 }),
        service.listerFil(utilisateur.sub, { limite: 1, depuis: debutJour }),
        service.listerFil(utilisateur.sub, { limite: 1, depuis: debutSemaine }),
      ]);

      return reply.send({
        totalArticles: totalArticles.pagination.total,
        articlesAujourdhui: articlesJour.pagination.total,
        articlesCetteSemaine: articlesSemaine.pagination.total,
      });
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });
}
