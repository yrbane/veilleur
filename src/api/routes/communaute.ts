/**
 * Veilleur - Routes API Communauté
 * Endpoints pour la découverte communautaire
 */

import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { ServiceCommunaute } from '@/domaine/services/ServiceCommunaute';
import { DepotSourcesMariaDB } from '@/infrastructure/persistence/DepotSourcesMariaDB';

const depotSources = new DepotSourcesMariaDB();
const serviceCommunaute = new ServiceCommunaute(depotSources);

/**
 * Schéma de validation pour les critères de recherche
 */
const schemaCriteres = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limite: z.coerce.number().int().min(1).max(100).optional().default(20),
  tag: z.string().optional(),
  tri: z.enum(['populaire', 'note', 'recent']).optional().default('populaire'),
  recherche: z.string().max(100).optional(),
});

/**
 * Plugin des routes communauté
 */
export const routesCommunaute: FastifyPluginCallback = (fastify, _opts, done) => {
  /**
   * GET /sources-populaires - Liste les sources populaires
   */
  fastify.get('/sources-populaires', {
    schema: {
      description: 'Liste les sources populaires de la communauté',
      tags: ['Communauté'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limite: { type: 'integer', minimum: 1, maximum: 100 },
          tag: { type: 'string' },
          tri: { type: 'string', enum: ['populaire', 'note', 'recent'] },
          recherche: { type: 'string', maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const criteres = schemaCriteres.parse(request.query);
        const resultat = await serviceCommunaute.listerSourcesPopulaires(criteres);
        return reply.send(resultat);
      } catch (erreur) {
        if (erreur instanceof z.ZodError) {
          return reply.status(400).send({
            erreur: 'PARAMETRES_INVALIDES',
            message: 'Paramètres de requête invalides',
            details: erreur.errors,
          });
        }
        throw erreur;
      }
    },
  });

  /**
   * GET /tags-populaires - Liste les tags populaires
   */
  fastify.get('/tags-populaires', {
    schema: {
      description: 'Liste les tags populaires',
      tags: ['Communauté'],
      querystring: {
        type: 'object',
        properties: {
          limite: { type: 'integer', minimum: 1, maximum: 50 },
        },
      },
    },
    handler: async (request, reply) => {
      const query = request.query as { limite?: number };
      const limite = Math.min(query.limite ?? 20, 50);
      const tags = await serviceCommunaute.listerTagsPopulaires(limite);
      return reply.send({ donnees: tags });
    },
  });

  /**
   * GET /recherche - Recherche de sources
   */
  fastify.get('/recherche', {
    schema: {
      description: 'Recherche des sources par nom',
      tags: ['Communauté'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 2, maxLength: 100 },
          page: { type: 'integer', minimum: 1 },
          limite: { type: 'integer', minimum: 1, maximum: 100 },
          tag: { type: 'string' },
          tri: { type: 'string', enum: ['populaire', 'note', 'recent'] },
        },
        required: ['q'],
      },
    },
    handler: async (request, reply) => {
      const query = request.query as {
        q: string;
        page?: number;
        limite?: number;
        tag?: string;
        tri?: 'populaire' | 'note' | 'recent';
      };

      if (!query.q || query.q.length < 2) {
        return reply.status(400).send({
          erreur: 'TERME_TROP_COURT',
          message: 'Le terme de recherche doit contenir au moins 2 caractères',
        });
      }

      const resultat = await serviceCommunaute.rechercherSources(query.q, {
        page: query.page,
        limite: query.limite,
        tag: query.tag,
        tri: query.tri,
      });

      return reply.send(resultat);
    },
  });

  done();
};
