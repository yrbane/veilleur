/**
 * Veilleur - Routes de progression (gamification)
 * GET /api/v1/progression — points, niveau, badges, série de l'utilisateur
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifierAuthentification } from '@/api/middlewares/authentification';
import { ServiceGamification } from '@/domaine/services/ServiceGamification';
import { DepotStatistiquesUtilisateurMariaDB } from '@/infrastructure/persistence/DepotStatistiquesUtilisateurMariaDB';
import { obtenirServiceCache } from '@/infrastructure/cache/ServiceCacheRedis';
import { loggerHttp } from '@/infrastructure/logging/logger';

let serviceGamification: ServiceGamification | null = null;

export function obtenirServiceGamification(): ServiceGamification {
  if (!serviceGamification) {
    serviceGamification = new ServiceGamification(new DepotStatistiquesUtilisateurMariaDB(), obtenirServiceCache());
  }
  return serviceGamification;
}

export async function routesProgression(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifierAuthentification);

  fastify.get('/', {
    schema: {
      tags: ['Progression'],
      summary: 'Points, niveau, badges et série de lecture de l\'utilisateur',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const progression = await obtenirServiceGamification().obtenirProgression(request.utilisateur!.sub);
      if (!progression) {
        return reply.status(404).send({ erreur: 'UTILISATEUR_INTROUVABLE', message: 'Utilisateur introuvable' });
      }
      return reply.send(progression);
    } catch (erreur) {
      loggerHttp.error({ erreur }, 'Erreur progression');
      return reply.status(500).send({ erreur: 'ERREUR_INTERNE', message: 'Une erreur est survenue' });
    }
  });
}
