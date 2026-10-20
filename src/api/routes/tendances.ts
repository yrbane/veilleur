/**
 * Veilleur - Routes des mots-clés tendance
 * GET /api/v1/tendances      — tous les articles (public)
 * GET /api/v1/tendances/fil  — le fil de l'utilisateur (authentifié)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { verifierAuthentification } from '@/api/middlewares/authentification';
import { ServiceTendances } from '@/domaine/services/ServiceTendances';
import { DepotArticlesMariaDB } from '@/infrastructure/persistence/DepotArticlesMariaDB';
import { obtenirServiceCache } from '@/infrastructure/cache/ServiceCacheRedis';
import { loggerHttp } from '@/infrastructure/logging/logger';

const schemaQuery = z.object({ limite: z.coerce.number().int().min(1).max(30).default(10) });

let serviceTendances: ServiceTendances | null = null;

function obtenirServiceTendances(): ServiceTendances {
  if (!serviceTendances) {
    serviceTendances = new ServiceTendances(new DepotArticlesMariaDB(), obtenirServiceCache());
  }
  return serviceTendances;
}

const schemaReponse = {
  200: {
    type: 'object',
    properties: {
      donnees: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mot: { type: 'string' },
            nombreRecents: { type: 'number' },
            nombreReference: { type: 'number' },
            score: { type: 'number' },
          },
        },
      },
    },
  },
};

export async function routesTendances(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', {
    schema: {
      tags: ['Tendances'],
      summary: 'Mots-clés en hausse sur l\'ensemble des articles (24 h contre 7 jours)',
      querystring: { type: 'object', properties: { limite: { type: 'number', default: 10 } } },
      response: schemaReponse,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limite } = schemaQuery.parse(request.query);
      return reply.send({ donnees: await obtenirServiceTendances().lister({ limite }) });
    } catch (erreur) {
      loggerHttp.error({ erreur }, 'Erreur tendances globales');
      return reply.status(500).send({ erreur: 'ERREUR_INTERNE', message: 'Une erreur est survenue' });
    }
  });

  fastify.get('/fil', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Tendances'],
      summary: 'Mots-clés en hausse dans le fil de l\'utilisateur',
      security: [{ bearerAuth: [] }],
      querystring: { type: 'object', properties: { limite: { type: 'number', default: 10 } } },
      response: schemaReponse,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limite } = schemaQuery.parse(request.query);
      const donnees = await obtenirServiceTendances().lister({ utilisateurId: request.utilisateur!.sub, limite });
      return reply.send({ donnees });
    } catch (erreur) {
      loggerHttp.error({ erreur }, 'Erreur tendances du fil');
      return reply.status(500).send({ erreur: 'ERREUR_INTERNE', message: 'Une erreur est survenue' });
    }
  });
}
