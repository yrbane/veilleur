/**
 * Veilleur - Favicons des sources servis depuis le cache local
 * Public (comme les images) : la page Découverte affiche les favicons sans connexion.
 */

import { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { env } from '@/config/environnement';
import { DepotSourcesMariaDB } from '@/infrastructure/persistence/DepotSourcesMariaDB';
import { ServiceFavicons } from '@/infrastructure/favicons/ServiceFavicons';

let serviceFavicons: ServiceFavicons | null = null;

function obtenirServiceFavicons(): ServiceFavicons {
  if (!serviceFavicons) {
    serviceFavicons = new ServiceFavicons({
      dossier: join(env.IMAGES_CHEMIN_STOCKAGE, 'favicons'),
      timeoutMs: env.SCRAPING_TIMEOUT_MS,
      userAgent: env.SCRAPING_USER_AGENT,
    });
  }
  return serviceFavicons;
}

export async function routesFavicons(fastify: FastifyInstance): Promise<void> {
  const depotSources = new DepotSourcesMariaDB();

  /**
   * GET /api/v1/favicons/:sourceId
   */
  fastify.get<{ Params: { sourceId: string } }>(
    '/:sourceId',
    {
      config: { rateLimit: false },
      schema: {
        description: 'Favicon d\'une source, mis en cache par le serveur',
        tags: ['sources'],
        params: {
          type: 'object',
          required: ['sourceId'],
          properties: { sourceId: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z0-9]+$' } },
        },
      },
    },
    async (request, reply) => {
      const source = await depotSources.trouverParId(request.params.sourceId);
      if (!source) return reply.notFound('Source inconnue');

      const favicon = await obtenirServiceFavicons().obtenir(source.id, source.urlFavicon);
      if (!favicon) {
        reply.header('Cache-Control', 'public, max-age=3600');
        return reply.notFound('Pas de favicon pour cette source');
      }

      reply.header('Cache-Control', 'public, max-age=86400');
      reply.header('X-Content-Type-Options', 'nosniff');
      // Un SVG servi depuis notre origine ne doit exécuter aucun script
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      reply.type(favicon.typeMime);
      return reply.send(createReadStream(favicon.chemin));
    },
  );
}
