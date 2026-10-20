/**
 * Veilleur - Routes API Tags
 * Gestion des tags utilisateur
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifierAuthentification } from '@/api/middlewares/authentification';
import { obtenirDepotTags } from '@/infrastructure/persistence/DepotTagsMariaDB';
import { DepotSourcesMariaDB } from '@/infrastructure/persistence/DepotSourcesMariaDB';
import { schemaCreationTag, genererSlug } from '@/domaine/entites/Tag';
import { loggerHttp } from '@/infrastructure/logging/logger';

/**
 * Schémas de validation
 */
const schemaParams = z.object({
  id: z.string().min(1),
});

const schemaParamsTagSource = z.object({
  id: z.string().min(1),
  tagId: z.string().min(1),
});

const schemaAjoutTagSource = z.object({
  tagNom: z.string().min(1).max(50),
});

/**
 * Gère les erreurs
 */
function gererErreur(erreur: unknown, reply: FastifyReply): FastifyReply {
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

  loggerHttp.error({ erreur }, 'Erreur inattendue dans tags');
  return reply.status(500).send({
    erreur: 'ERREUR_INTERNE',
    message: 'Une erreur est survenue',
  });
}

/**
 * Enregistre les routes tags
 */
export async function routesTags(fastify: FastifyInstance): Promise<void> {
  const depotTags = obtenirDepotTags();
  const depotSources = new DepotSourcesMariaDB();

  /**
   * Abonnement de l'utilisateur à une source : l'id public est celui de la source,
   * mais les tags sont liés à l'abonnement (utilisateurs_sources)
   */
  const trouverAbonnement = async (utilisateurId: string, sourceId: string) => {
    const sources = await depotSources.listerPourUtilisateur(utilisateurId, { page: 1, limite: 1000 });
    return sources.donnees.find(s => s.id === sourceId) ?? null;
  };

  // Toutes les routes nécessitent une authentification
  fastify.addHook('preHandler', verifierAuthentification);

  /**
   * GET /tags - Liste les tags de l'utilisateur
   */
  fastify.get('/', {
    schema: {
      description: 'Liste les tags de l\'utilisateur avec le nombre de sources',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
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
                  nom: { type: 'string' },
                  slug: { type: 'string' },
                  nombreSources: { type: 'number' },
                  dateCreation: { type: 'string' },
                },
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

      const tags = await depotTags.listerTagsUtilisateur(request.utilisateur.sub);

      return reply.send({
        donnees: tags.map(tag => ({
          ...tag,
          dateCreation: tag.dateCreation.toISOString(),
        })),
      });
    } catch (erreur) {
      return gererErreur(erreur, reply);
    }
  });

  /**
   * POST /tags - Crée un nouveau tag
   */
  fastify.post('/', {
    schema: {
      description: 'Crée un nouveau tag',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['nom'],
        properties: {
          nom: { type: 'string', minLength: 1, maxLength: 50 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            nom: { type: 'string' },
            slug: { type: 'string' },
            dateCreation: { type: 'string' },
          },
        },
        409: {
          type: 'object',
          properties: {
            erreur: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const body = schemaCreationTag.parse(request.body);
      const slug = genererSlug(body.nom);

      // Vérifier si le tag existe déjà
      const existant = await depotTags.trouverParSlug(slug);
      if (existant) {
        return reply.status(409).send({
          erreur: 'TAG_EXISTANT',
          message: 'Un tag avec ce nom existe déjà',
        });
      }

      const tag = await depotTags.creer({
        nom: body.nom,
        slug,
      });

      return reply.status(201).send({
        ...tag,
        dateCreation: tag.dateCreation.toISOString(),
      });
    } catch (erreur) {
      return gererErreur(erreur, reply);
    }
  });

  /**
   * DELETE /tags/:id - Supprime un tag
   */
  fastify.delete('/:id', {
    schema: {
      description: 'Supprime un tag',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        204: { type: 'null' },
        404: {
          type: 'object',
          properties: {
            erreur: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const params = schemaParams.parse(request.params);

      // Vérifier que le tag existe
      const tag = await depotTags.trouverParId(params.id);
      if (!tag) {
        return reply.status(404).send({
          erreur: 'TAG_NON_TROUVE',
          message: 'Tag non trouvé',
        });
      }

      await depotTags.supprimer(params.id);

      return reply.status(204).send();
    } catch (erreur) {
      return gererErreur(erreur, reply);
    }
  });

  /**
   * POST /sources/:id/tags - Ajoute un tag à une source
   */
  fastify.post('/sources/:id/tags', {
    schema: {
      description: 'Ajoute un tag à une source',
      tags: ['Tags'],
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
        required: ['tagNom'],
        properties: {
          tagNom: { type: 'string', minLength: 1, maxLength: 50 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tag: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                nom: { type: 'string' },
                slug: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            erreur: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const params = schemaParams.parse(request.params);
      const body = schemaAjoutTagSource.parse(request.body);

      const abonnement = await trouverAbonnement(request.utilisateur.sub, params.id);
      if (!abonnement) {
        return reply.status(404).send({
          erreur: 'SOURCE_NON_TROUVEE',
          message: 'Source non trouvée',
        });
      }

      // Trouver ou créer le tag
      const tag = await depotTags.trouverOuCreer(body.tagNom);

      // Associer le tag à l'abonnement de l'utilisateur
      await depotTags.ajouterTagSource(abonnement.utilisateurSourceId, tag.id);

      return reply.send({
        tag: {
          id: tag.id,
          nom: tag.nom,
          slug: tag.slug,
        },
      });
    } catch (erreur) {
      return gererErreur(erreur, reply);
    }
  });

  /**
   * DELETE /sources/:id/tags/:tagId - Retire un tag d'une source
   */
  fastify.delete('/sources/:id/tags/:tagId', {
    schema: {
      description: 'Retire un tag d\'une source',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'tagId'],
        properties: {
          id: { type: 'string' },
          tagId: { type: 'string' },
        },
      },
      response: {
        204: { type: 'null' },
        404: {
          type: 'object',
          properties: {
            erreur: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const params = schemaParamsTagSource.parse(request.params);

      const abonnement = await trouverAbonnement(request.utilisateur.sub, params.id);
      if (!abonnement) {
        return reply.status(404).send({ erreur: 'SOURCE_NON_TROUVEE', message: 'Source non trouvée' });
      }
      await depotTags.retirerTagSource(abonnement.utilisateurSourceId, params.tagId);

      return reply.status(204).send();
    } catch (erreur) {
      return gererErreur(erreur, reply);
    }
  });

  /**
   * GET /sources/:id/tags - Liste les tags d'une source
   */
  fastify.get('/sources/:id/tags', {
    schema: {
      description: 'Liste les tags d\'une source',
      tags: ['Tags'],
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
            donnees: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  nom: { type: 'string' },
                  slug: { type: 'string' },
                },
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

      const params = schemaParams.parse(request.params);

      const abonnement = await trouverAbonnement(request.utilisateur.sub, params.id);
      if (!abonnement) {
        return reply.status(404).send({ erreur: 'SOURCE_NON_TROUVEE', message: 'Source non trouvée' });
      }
      const tags = await depotTags.listerTagsSource(abonnement.utilisateurSourceId);

      return reply.send({
        donnees: tags.map(tag => ({
          id: tag.id,
          nom: tag.nom,
          slug: tag.slug,
        })),
      });
    } catch (erreur) {
      return gererErreur(erreur, reply);
    }
  });
}
