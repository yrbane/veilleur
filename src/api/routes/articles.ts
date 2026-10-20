/**
 * Veilleur - Routes des articles
 * Consultation du fil d'actualités et des articles
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifierAuthentification } from '@/api/middlewares/authentification';
import { env } from '@/config/environnement';
import { ServiceLecture } from '@/infrastructure/lecture/ServiceLecture';
import { ServiceArticles, ErreurArticle } from '@/domaine/services/ServiceArticles';
import { ServiceAnnotationsArticles, ErreurAnnotation } from '@/domaine/services/ServiceAnnotationsArticles';
import { TRIS_ARTICLES, NOTE_ARTICLE_MIN, NOTE_ARTICLE_MAX } from '@/domaine/entites/Article';
import { DepotArticlesMariaDB } from '@/infrastructure/persistence/DepotArticlesMariaDB';
import { DepotAnnotationsArticlesMariaDB } from '@/infrastructure/persistence/DepotAnnotationsArticlesMariaDB';
import { DepotSourcesMariaDB } from '@/infrastructure/persistence/DepotSourcesMariaDB';
import { obtenirServiceCache } from '@/infrastructure/cache/ServiceCacheRedis';
import { obtenirServiceScraping } from '@/infrastructure/scraping/ServiceScraping';
import { loggerHttp } from '@/infrastructure/logging/logger';
import { ServiceImagesCache } from '@/infrastructure/images';
import type { DonneesJobImage } from '@/infrastructure/images';
import { ajouterJobImage, creerQueueImages } from '@/infrastructure/workers/WorkerImages';
import type { Queue } from 'bullmq';

/**
 * Schémas de validation
 */
const schemaCriteresFil = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  sourceId: z.string().optional(),
  tag: z.string().optional(),
  depuis: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  recherche: z.string().optional(),
  curseur: z.string().optional(),
  direction: z.enum(['avant', 'apres']).optional(),
  tri: z.enum(TRIS_ARTICLES).optional(),
  ordre: z.enum(['asc', 'desc']).optional(),
  noteMin: z.coerce.number().int().min(NOTE_ARTICLE_MIN).max(NOTE_ARTICLE_MAX).optional(),
  motCle: z.string().min(1).max(50).optional(),
  favoris: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),
  nonLus: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),
  aLire: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),
});

const schemaALire = z.object({ aLire: z.boolean() });
const schemaExport = z.object({ format: z.enum(['json', 'csv']).default('json') });

const schemaLu = z.object({ lu: z.boolean() });
const schemaTousLus = z.object({
  sourceId: z.string().min(1).optional(),
  avant: z.coerce.date().optional(),
});

const schemaParamsArticle = z.object({ id: z.string().min(1) });
const schemaNote = z.object({ note: z.number().int().nullable() });
const schemaFavori = z.object({ favori: z.boolean() });

/**
 * Instance du service d'annotations (lazy)
 */
let serviceAnnotations: ServiceAnnotationsArticles | null = null;

function obtenirServiceAnnotations(): ServiceAnnotationsArticles {
  if (!serviceAnnotations) {
    serviceAnnotations = new ServiceAnnotationsArticles(
      new DepotAnnotationsArticlesMariaDB(),
      obtenirDepotArticles(),
      obtenirServiceCache(),
    );
  }
  return serviceAnnotations;
}

/**
 * Instance du service articles (lazy)
 */
let serviceArticles: ServiceArticles | null = null;
let depotArticlesPartage: DepotArticlesMariaDB | null = null;

function obtenirDepotArticles(): DepotArticlesMariaDB {
  if (!depotArticlesPartage) {
    depotArticlesPartage = new DepotArticlesMariaDB();
  }
  return depotArticlesPartage;
}

let serviceLecture: ServiceLecture | null = null;
let queueImages: Queue<DonneesJobImage> | null = null;

/**
 * Les images du lecteur passent par le cache local (le navigateur ne contacte jamais le site
 * d'origine, et la CSP n'autorise que nos propres images) : on met leur téléchargement en file.
 */
async function resoudreImageLecture(url: string): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null;
  queueImages ??= creerQueueImages();
  await ajouterJobImage(queueImages, url);
  return `/api/v1/images/${ServiceImagesCache.hashUrl(url)}/md`;
}

function obtenirServiceLecture(): ServiceLecture {
  if (!serviceLecture) {
    serviceLecture = new ServiceLecture({
      userAgent: env.SCRAPING_USER_AGENT,
      timeoutMs: env.SCRAPING_TIMEOUT_MS,
      serviceCache: obtenirServiceCache(),
      resoudreImage: resoudreImageLecture,
    });
  }
  return serviceLecture;
}

function obtenirServiceArticles(): ServiceArticles {
  if (!serviceArticles) {
    const depotArticles = obtenirDepotArticles();
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
 * Transforme l'URL d'image en URL cachée locale
 */
function transformerUrlImage(urlImage: string | null): { urlImage: string | null; urlImageOriginale: string | null } {
  if (!urlImage) {
    return { urlImage: null, urlImageOriginale: null };
  }
  // Retourner l'URL vers le cache d'images local (taille 'sm' par défaut)
  const hash = ServiceImagesCache.hashUrl(urlImage);
  return {
    urlImage: `/api/v1/images/${hash}/sm`,
    urlImageOriginale: urlImage,
  };
}

/**
 * Transforme les articles pour utiliser les URLs cachées
 */
function transformerArticlesPourReponse<T extends { urlImage: string | null }>(articles: T[]): (Omit<T, 'urlImage'> & { urlImage: string | null; urlImageOriginale: string | null })[] {
  return articles.map(article => {
    const { urlImage, urlImageOriginale } = transformerUrlImage(article.urlImage);
    return {
      ...article,
      urlImage,
      urlImageOriginale,
    };
  });
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

  if (erreur instanceof ErreurAnnotation) {
    return reply.status(erreur.code === 'ARTICLE_INTROUVABLE' ? 404 : 400).send({
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
          recherche: { type: 'string' },
          tri: { type: 'string', enum: [...TRIS_ARTICLES] },
          ordre: { type: 'string', enum: ['asc', 'desc'] },
          noteMin: { type: 'number' },
          motCle: { type: 'string' },
          favoris: { type: 'string', enum: ['true', 'false'] },
          nonLus: { type: 'string', enum: ['true', 'false'] },
          aLire: { type: 'string', enum: ['true', 'false'] },
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
                  sourceId: { type: 'string' },
                  source: {
                    type: 'object',
                    properties: {
                      nom: { type: 'string' },
                      urlFavicon: { type: 'string', nullable: true },
                    },
                  },
                  note: { type: 'number', nullable: true },
                  favori: { type: 'boolean' },
                  lu: { type: 'boolean' },
                  aLire: { type: 'boolean' },
                  motsCles: { type: 'array', items: { type: 'string' } },
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

      // Annotations personnelles (note, favori) lues hors cache pour rester fraîches, et mots-clés
      const ids = resultat.donnees.map(a => a.id);
      const [annotations, motsCles] = await Promise.all([
        obtenirServiceAnnotations().obtenirAnnotations(utilisateur.sub, ids),
        obtenirDepotArticles().obtenirMotsCles(ids),
      ]);
      const donnees = transformerArticlesPourReponse(resultat.donnees).map(article => {
        const annotation = annotations.get(article.id);
        return {
          ...article,
          note: annotation?.note ?? null,
          favori: annotation?.favori ?? false,
          lu: annotation?.lu ?? false,
          aLire: annotation?.aLire ?? false,
          motsCles: (motsCles.get(article.id) ?? []).filter(mot => mot !== '—'),
        };
      });

      // Transformer les URLs d'images pour utiliser le cache local
      return reply.send({ ...resultat, donnees });
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

      // Transformer l'URL d'image pour utiliser le cache local
      const { urlImage, urlImageOriginale } = transformerUrlImage(article.urlImage);
      return reply.send({
        ...article,
        urlImage,
        urlImageOriginale,
      });
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

        // Transformer les URLs d'images pour utiliser le cache local
        return reply.send(transformerArticlesPourReponse(articles));
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
  /**
   * GET /api/v1/articles/mots-cles
   * Mots-clés les plus fréquents dans le fil de l'utilisateur (filtres)
   */
  fastify.get('/mots-cles', {
    schema: {
      tags: ['Articles'],
      summary: 'Mots-clés du fil de l\'utilisateur',
      security: [{ bearerAuth: [] }],
      querystring: { type: 'object', properties: { limite: { type: 'number', default: 20 } } },
      response: {
        200: {
          type: 'object',
          properties: {
            donnees: {
              type: 'array',
              items: { type: 'object', properties: { mot: { type: 'string' }, nombreArticles: { type: 'number' } } },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limite } = z.object({ limite: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query);
      const donnees = (await obtenirDepotArticles().listerMotsClesFil(request.utilisateur!.sub, limite + 1))
        .filter(m => m.mot !== '—')
        .slice(0, limite);
      return reply.send({ donnees });
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/articles/:id/note
   * Note un article de 1 à 5 (null pour retirer la note)
   */
  fastify.put('/:id/note', {
    schema: {
      tags: ['Articles'],
      summary: 'Note un article',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['note'],
        properties: { note: { type: 'number', nullable: true, minimum: NOTE_ARTICLE_MIN, maximum: NOTE_ARTICLE_MAX } },
      },
      response: { 200: { type: 'object', properties: { note: { type: 'number', nullable: true } } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = schemaParamsArticle.parse(request.params);
      const { note } = schemaNote.parse(request.body);
      return reply.send(await obtenirServiceAnnotations().noter(request.utilisateur!.sub, id, note));
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/articles/:id/favori
   * Met un article en favori ou l'en retire
   */
  fastify.put('/:id/favori', {
    schema: {
      tags: ['Articles'],
      summary: 'Met un article en favori',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['favori'], properties: { favori: { type: 'boolean' } } },
      response: { 200: { type: 'object', properties: { favori: { type: 'boolean' } } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = schemaParamsArticle.parse(request.params);
      const { favori } = schemaFavori.parse(request.body);
      return reply.send(await obtenirServiceAnnotations().definirFavori(request.utilisateur!.sub, id, favori));
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/articles/:id/lu
   */
  fastify.put('/:id/lu', {
    schema: {
      tags: ['Articles'],
      summary: 'Marque un article lu ou non lu',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['lu'], properties: { lu: { type: 'boolean' } } },
      response: { 200: { type: 'object', properties: { lu: { type: 'boolean' } } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = schemaParamsArticle.parse(request.params);
      const { lu } = schemaLu.parse(request.body);
      return reply.send(await obtenirServiceAnnotations().marquerLu(request.utilisateur!.sub, id, lu));
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/articles/:id/a-lire — liste de lecture
   */
  fastify.put('/:id/a-lire', {
    schema: {
      tags: ['Articles'],
      summary: 'Met un article dans la liste de lecture ou l\'en retire',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['aLire'], properties: { aLire: { type: 'boolean' } } },
      response: { 200: { type: 'object', properties: { aLire: { type: 'boolean' } } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = schemaParamsArticle.parse(request.params);
      const { aLire } = schemaALire.parse(request.body);
      return reply.send(await obtenirServiceAnnotations().definirALire(request.utilisateur!.sub, id, aLire));
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * GET /api/v1/articles/export?format=json|csv — export des annotations
   */
  fastify.get('/export', {
    schema: {
      tags: ['Articles'],
      summary: 'Exporte les annotations (notes, favoris, liste de lecture, lus) en JSON ou CSV',
      security: [{ bearerAuth: [] }],
      querystring: { type: 'object', properties: { format: { type: 'string', enum: ['json', 'csv'] } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { format } = schemaExport.parse(request.query);
      const exportation = await obtenirServiceAnnotations().exporterAnnotations(request.utilisateur!.sub, format);
      reply.header('Content-Type', exportation.typeMime);
      reply.header('Content-Disposition', `attachment; filename="${exportation.nomFichier}"`);
      return reply.send(exportation.contenu);
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * POST /api/v1/articles/lus — tout marquer comme lu (fil entier ou une source), borné à `avant`
   */
  fastify.post('/lus', {
    schema: {
      tags: ['Articles'],
      summary: 'Marque lus tous les articles du fil publiés avant un instant',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: { sourceId: { type: 'string' }, avant: { type: 'string', format: 'date-time' } },
      },
      response: { 200: { type: 'object', properties: { marques: { type: 'number' } } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = schemaTousLus.parse(request.body ?? {});
      return reply.send(await obtenirServiceAnnotations().marquerTousLus(request.utilisateur!.sub, options));
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * GET /api/v1/articles/non-lus — compte des non-lus, en tout et par source
   */
  fastify.get('/non-lus', {
    schema: {
      tags: ['Articles'],
      summary: 'Nombre d\'articles non lus, en tout et par source',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            parSource: { type: 'object', additionalProperties: { type: 'number' } },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(await obtenirServiceAnnotations().compterNonLus(request.utilisateur!.sub));
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

  /**
   * GET /api/v1/articles/:id/lecture — contenu de l'article extrait pour la lecture en place
   */
  fastify.get<{ Params: { id: string } }>('/:id/lecture', {
    schema: {
      tags: ['Articles'],
      summary: 'Contenu lisible d\'un article (lecture en place)',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: {
        200: {
          type: 'object',
          properties: {
            titre: { type: 'string' },
            contenuHtml: { type: 'string' },
            extrait: { type: 'string', nullable: true },
            auteur: { type: 'string', nullable: true },
            nombreMots: { type: 'number' },
            dureeLectureMin: { type: 'number' },
            lien: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const article = await obtenirServiceArticles().obtenirArticle(request.params.id);
      if (!article) {
        return reply.status(404).send({ erreur: 'ARTICLE_INTROUVABLE', message: 'Article introuvable' });
      }
      const contenu = await obtenirServiceLecture().extraire(article.id, article.lien);
      if (!contenu) {
        return reply.status(422).send({
          erreur: 'CONTENU_INDISPONIBLE',
          message: 'Impossible d\'extraire le contenu de cet article',
        });
      }
      return reply.send({ ...contenu, lien: article.lien });
    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });

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
        service.listerFil(utilisateur.sub, { page: 1, limite: 1 }),
        service.listerFil(utilisateur.sub, { page: 1, limite: 1, depuis: debutJour }),
        service.listerFil(utilisateur.sub, { page: 1, limite: 1, depuis: debutSemaine }),
      ]);

      return reply.send({
        totalArticles: totalArticles.pagination?.total ?? 0,
        articlesAujourdhui: articlesJour.pagination?.total ?? 0,
        articlesCetteSemaine: articlesSemaine.pagination?.total ?? 0,
      });    } catch (erreur) {
      return gererErreurArticle(erreur, reply);
    }
  });
}
