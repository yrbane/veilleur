/**
 * Veilleur - Routes des sources
 * Gestion des sources d'actualités pour les utilisateurs
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifierAuthentification } from '@/api/middlewares/authentification';
import { ServiceSources, ErreurSource } from '@/domaine/services/ServiceSources';
import { DepotSourcesMariaDB, DepotParametresSourcesMariaDB } from '@/infrastructure/persistence/DepotSourcesMariaDB';
import { loggerHttp } from '@/infrastructure/logging/logger';
import { genererOPML, parserOPML, type SourceOPML } from '@/domaine/services/ServiceOPML';

/**
 * Schémas de validation
 */
const schemaAjoutSource = z.object({
  url: z.string().url('URL invalide'),
  nom: z.string().min(1).max(255).optional(),
});

const schemaCriteres = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  statut: z.enum(['active', 'inactive', 'erreur', 'toutes']).default('toutes'),
  tag: z.string().optional(),
});

const schemaNote = z.object({
  note: z.number().int().min(1).max(5).nullable(),
});

const schemaPause = z.object({
  enPause: z.boolean(),
});

const schemaParametres = z.object({
  nombreMaxArticles: z.number().int().min(1).max(100).optional(),
  frequenceMinutes: z.number().int().min(5).max(1440).optional(),
  retentionJours: z.number().int().min(1).max(365).optional(),
  priorite: z.enum(['haute', 'normale', 'basse']).optional(),
  modeExtraction: z.enum(['rss', 'scraping', 'auto']).optional(),
  notifications: z.enum(['aucune', 'nouveaux', 'tous']).optional(),
});

/**
 * Instance du service sources (lazy)
 */
let serviceSources: ServiceSources | null = null;

function obtenirServiceSources(): ServiceSources {
  if (!serviceSources) {
    const depotSources = new DepotSourcesMariaDB();
    const depotParametres = new DepotParametresSourcesMariaDB();
    serviceSources = new ServiceSources(depotSources, depotParametres);
  }
  return serviceSources;
}

/**
 * Gère les erreurs du service sources
 */
function gererErreurSource(erreur: unknown, reply: FastifyReply): FastifyReply {
  if (erreur instanceof ErreurSource) {
    const statusCodes: Record<string, number> = {
      URL_INVALIDE: 400,
      SOURCE_INTROUVABLE: 404,
      SOURCE_DEJA_AJOUTEE: 409,
      LIMITE_SOURCES_ATTEINTE: 403,
      TYPE_NON_SUPPORTE: 400,
      ERREUR_DETECTION: 502,
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

  loggerHttp.error({ erreur }, 'Erreur inattendue dans sources');
  return reply.status(500).send({
    erreur: 'ERREUR_INTERNE',
    message: 'Une erreur est survenue',
  });
}

/**
 * Enregistre les routes des sources
 */
export async function routesSources(fastify: FastifyInstance): Promise<void> {
  // Toutes les routes nécessitent une authentification
  fastify.addHook('preHandler', verifierAuthentification);

  /**
   * GET /api/v1/sources
   * Liste les sources de l'utilisateur connecté
   */
  fastify.get('/', {
    schema: {
      tags: ['Sources'],
      summary: 'Liste les sources de l\'utilisateur',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limite: { type: 'number', default: 20 },
          statut: { type: 'string', enum: ['active', 'inactive', 'erreur', 'toutes'] },
          tag: { type: 'string' },
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
                  url: { type: 'string' },
                  nom: { type: 'string' },
                  typeSource: { type: 'string' },
                  statut: { type: 'string' },
                  urlFavicon: { type: 'string', nullable: true },
                  dateAjout: { type: 'string' },
                  note: { type: 'number', nullable: true },
                  estEnPause: { type: 'boolean' },
                  tags: { type: 'array', items: { type: 'object' } },
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
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const criteres = schemaCriteres.parse(request.query);
      const service = obtenirServiceSources();
      const resultat = await service.listerSources(request.utilisateur.sub, criteres);

      return reply.send(resultat);
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * POST /api/v1/sources
   * Ajoute une nouvelle source
   */
  fastify.post('/', {
    schema: {
      tags: ['Sources'],
      summary: 'Ajoute une nouvelle source',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
          nom: { type: 'string', maxLength: 255 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string' },
            nom: { type: 'string' },
            typeSource: { type: 'string' },
            statut: { type: 'string' },
            dateAjout: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const donnees = schemaAjoutSource.parse(request.body);
      const service = obtenirServiceSources();
      const source = await service.ajouterSource(
        request.utilisateur.sub,
        donnees.url,
        donnees.nom,
      );

      loggerHttp.info(
        { utilisateurId: request.utilisateur.sub, sourceId: source.id, url: donnees.url },
        'Source ajoutée',
      );

      return reply.status(201).send(source);
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * GET /api/v1/sources/:id
   * Récupère les détails d'une source
   */
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Sources'],
      summary: 'Récupère une source',
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
            url: { type: 'string' },
            nom: { type: 'string' },
            typeSource: { type: 'string' },
            statut: { type: 'string' },
            urlFavicon: { type: 'string', nullable: true },
            dateAjout: { type: 'string' },
            note: { type: 'number', nullable: true },
            estEnPause: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const service = obtenirServiceSources();
      const source = await service.obtenirSource(request.utilisateur.sub, request.params.id);

      if (!source) {
        return reply.status(404).send({
          erreur: 'SOURCE_INTROUVABLE',
          message: 'Source introuvable',
        });
      }

      return reply.send(source);
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * DELETE /api/v1/sources/:id
   * Retire une source de l'utilisateur
   */
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Sources'],
      summary: 'Retire une source',
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
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const service = obtenirServiceSources();
      await service.retirerSource(request.utilisateur.sub, request.params.id);

      loggerHttp.info(
        { utilisateurId: request.utilisateur.sub, sourceId: request.params.id },
        'Source retirée',
      );

      return reply.send({ message: 'Source retirée avec succès' });
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/sources/:id/note
   * Note une source
   */
  fastify.put<{ Params: { id: string } }>('/:id/note', {
    schema: {
      tags: ['Sources'],
      summary: 'Note une source (1-5 ou null)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['note'],
        properties: {
          note: { type: 'number', nullable: true, minimum: 1, maximum: 5 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const donnees = schemaNote.parse(request.body);
      const service = obtenirServiceSources();
      await service.noterSource(request.utilisateur.sub, request.params.id, donnees.note);

      return reply.send({ message: 'Note mise à jour' });
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/sources/:id/pause
   * Met en pause ou réactive une source
   */
  fastify.put<{ Params: { id: string } }>('/:id/pause', {
    schema: {
      tags: ['Sources'],
      summary: 'Met en pause ou réactive une source',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['enPause'],
        properties: {
          enPause: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const donnees = schemaPause.parse(request.body);
      const service = obtenirServiceSources();
      await service.basculerPause(request.utilisateur.sub, request.params.id, donnees.enPause);

      return reply.send({
        message: donnees.enPause ? 'Source mise en pause' : 'Source réactivée',
      });
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * GET /api/v1/sources/:id/parametres
   * Récupère les paramètres d'une source
   */
  fastify.get<{ Params: { id: string } }>('/:id/parametres', {
    schema: {
      tags: ['Sources'],
      summary: 'Récupère les paramètres d\'une source',
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
            nombreMaxArticles: { type: 'number' },
            frequenceMinutes: { type: 'number' },
            retentionJours: { type: 'number' },
            priorite: { type: 'string' },
            modeExtraction: { type: 'string' },
            notifications: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const service = obtenirServiceSources();
      const parametres = await service.obtenirParametres(
        request.utilisateur.sub,
        request.params.id,
      );

      return reply.send(parametres);
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/sources/:id/parametres
   * Met à jour les paramètres d'une source
   */
  fastify.put<{ Params: { id: string } }>('/:id/parametres', {
    schema: {
      tags: ['Sources'],
      summary: 'Met à jour les paramètres d\'une source',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          nombreMaxArticles: { type: 'number', minimum: 1, maximum: 100 },
          frequenceMinutes: { type: 'number', minimum: 5, maximum: 1440 },
          retentionJours: { type: 'number', minimum: 1, maximum: 365 },
          priorite: { type: 'string', enum: ['haute', 'normale', 'basse'] },
          modeExtraction: { type: 'string', enum: ['rss', 'scraping', 'auto'] },
          notifications: { type: 'string', enum: ['aucune', 'nouveaux', 'tous'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const donnees = schemaParametres.parse(request.body);
      const service = obtenirServiceSources();
      await service.mettreAJourParametres(
        request.utilisateur.sub,
        request.params.id,
        donnees,
      );

      return reply.send({ message: 'Paramètres mis à jour' });
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * GET /export/opml - Exporter les sources au format OPML
   */
  fastify.get('/export/opml', {
    schema: {
      description: 'Exporte toutes les sources au format OPML',
      tags: ['Sources'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' } as never);
      }

      const service = obtenirServiceSources();
      const resultat = await service.listerSources(request.utilisateur.sub, { limite: 1000 });

      const sourcesOPML: SourceOPML[] = resultat.donnees.map(source => ({
        titre: source.nom,
        url: source.url,
        tags: source.tags?.map(t => t.nom),
      }));

      const opml = genererOPML(sourcesOPML);

      reply.header('Content-Type', 'application/xml');
      reply.header('Content-Disposition', 'attachment; filename="veilleur-sources.opml"');
      return reply.send(opml);
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });

  /**
   * POST /import/opml - Importer des sources depuis un fichier OPML
   */
  fastify.post('/import/opml', {
    schema: {
      description: 'Importe des sources depuis un fichier OPML',
      tags: ['Sources'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          contenu: { type: 'string', description: 'Contenu du fichier OPML' },
        },
        required: ['contenu'],
      },
    },
  }, async (request, reply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' } as never);
      }

      const { contenu } = request.body as { contenu: string };
      const sourcesOPML = parserOPML(contenu);

      if (sourcesOPML.length === 0) {
        return reply.status(400).send({
          erreur: 'OPML_VIDE',
          message: 'Aucune source trouvée dans le fichier OPML',
        } as never);
      }

      const service = obtenirServiceSources();
      let importees = 0;
      let ignorees = 0;
      const erreurs: { url: string; message: string }[] = [];

      for (const source of sourcesOPML) {
        try {
          await service.ajouterSource(
            request.utilisateur.sub,
            source.url,
            source.titre,
          );
          importees++;
        } catch (erreur) {
          if (erreur instanceof ErreurSource && erreur.code === 'SOURCE_DEJA_AJOUTEE') {
            ignorees++;
          } else {
            erreurs.push({
              url: source.url,
              message: erreur instanceof Error ? erreur.message : 'Erreur inconnue',
            });
          }
        }
      }

      loggerHttp.info({
        utilisateur: request.utilisateur.sub,
        total: sourcesOPML.length,
        importees,
        ignorees,
        erreurs: erreurs.length,
      }, 'Import OPML terminé');

      return reply.send({ importees, ignorees, erreurs });
    } catch (erreur) {
      return gererErreurSource(erreur, reply);
    }
  });
}
