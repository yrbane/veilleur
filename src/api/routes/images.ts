/**
 * Veilleur - Routes des images cachées
 * Sert les images locales avec support WebP et JPEG fallback
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '@/config/environnement';
import { loggerHttp } from '@/infrastructure/logging/logger';
import { DepotImagesCacheMariaDB } from '@/infrastructure/persistence/DepotImagesCacheMariaDB';
import {
  ServiceImagesCache,
  initialiserServiceImagesCache,
  obtenirGestionnaireStockage,
} from '@/infrastructure/images';
import type { TailleMiniature, FormatImage } from '@/infrastructure/images';

/**
 * Tailles valides
 */
const TAILLES_VALIDES: TailleMiniature[] = ['sm', 'md', 'originale'];

/**
 * Instance du service (lazy)
 */
let serviceImages: ServiceImagesCache | null = null;

function obtenirServiceImages(): ServiceImagesCache {
  if (!serviceImages) {
    const depotImages = new DepotImagesCacheMariaDB();
    serviceImages = initialiserServiceImagesCache(depotImages);
  }
  return serviceImages;
}

/**
 * Détermine le format préféré selon l'en-tête Accept
 */
function determinerFormat(acceptHeader: string | undefined): FormatImage {
  if (!acceptHeader) {
    return 'webp';
  }

  // WebP préféré si supporté
  if (acceptHeader.includes('image/webp')) {
    return 'webp';
  }

  // Fallback JPEG
  return 'jpeg';
}

/**
 * Enregistre les routes des images
 */
export async function routesImages(fastify: FastifyInstance): Promise<void> {
  // Initialiser les dossiers au démarrage
  await obtenirGestionnaireStockage().initialiser();

  /**
   * GET /api/v1/images/:hash
   * GET /api/v1/images/:hash/:taille
   * Récupère une image cachée
   */
  fastify.get<{
    Params: { hash: string; taille?: string };
  }>('/:hash/:taille?', {
    schema: {
      tags: ['Images'],
      summary: 'Récupère une image cachée',
      params: {
        type: 'object',
        required: ['hash'],
        properties: {
          hash: { type: 'string', minLength: 32, maxLength: 32 },
          taille: { type: 'string', enum: ['sm', 'md', 'originale'] },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
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
  }, async (request: FastifyRequest<{ Params: { hash: string; taille?: string } }>, reply: FastifyReply) => {
    const { hash, taille: tailleParam } = request.params;

    // Valider le hash (MD5 = 32 caractères hexadécimaux)
    if (!/^[a-f0-9]{32}$/i.test(hash)) {
      return reply.status(400).send({
        erreur: 'HASH_INVALIDE',
        message: 'Hash d\'image invalide',
      });
    }

    // Valider la taille
    const taille: TailleMiniature = tailleParam && TAILLES_VALIDES.includes(tailleParam as TailleMiniature)
      ? (tailleParam as TailleMiniature)
      : 'sm';

    // Déterminer le format selon Accept header
    const acceptHeader = request.headers.accept;
    const format = determinerFormat(acceptHeader);

    try {
      const service = obtenirServiceImages();
      const resultat = await service.obtenirDonnees(hash, taille, format);

      if (!resultat) {
        // Essayer le fallback JPEG si WebP n'existe pas
        if (format === 'webp') {
          const fallback = await service.obtenirDonnees(hash, taille, 'jpeg');
          if (fallback) {
            return reply
              .header('Content-Type', fallback.typeMime)
              .header('Cache-Control', 'public, max-age=31536000, immutable')
              .header('X-Image-Format', 'jpeg')
              .send(fallback.donnees);
          }
        }

        return reply.status(404).send({
          erreur: 'IMAGE_NON_TROUVEE',
          message: 'Image non disponible ou en cours de traitement',
        });
      }

      // Headers de cache agressifs (images immuables par hash)
      return reply
        .header('Content-Type', resultat.typeMime)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('X-Image-Format', format)
        .header('Vary', 'Accept')
        .send(resultat.donnees);
    } catch (erreur) {
      loggerHttp.error({ erreur, hash }, 'Erreur récupération image');
      return reply.status(500).send({
        erreur: 'ERREUR_INTERNE',
        message: 'Erreur lors de la récupération de l\'image',
      });
    }
  });

  /**
   * GET /api/v1/images/stats
   * Statistiques du cache d'images (nécessite authentification)
   */
  fastify.get('/stats', {
    schema: {
      tags: ['Images'],
      summary: 'Statistiques du cache d\'images',
      response: {
        200: {
          type: 'object',
          properties: {
            espaceDisque: {
              type: 'object',
              properties: {
                originales: { type: 'number' },
                miniatures: { type: 'number' },
                total: { type: 'number' },
              },
            },
          },
        },
        500: {
          type: 'object',
          properties: {
            erreur: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    try {
      const gestionnaire = obtenirGestionnaireStockage();
      const espaceDisque = await gestionnaire.calculerEspaceUtilise();

      return reply.send({
        espaceDisque: {
          originales: espaceDisque.originales,
          miniatures: espaceDisque.miniatures,
          total: espaceDisque.total,
        },
        cheminStockage: env.IMAGES_CHEMIN_STOCKAGE,
      });
    } catch (erreur) {
      loggerHttp.error({ erreur }, 'Erreur stats images');
      return reply.status(500).send({
        erreur: 'ERREUR_INTERNE',
        message: 'Erreur lors de la récupération des statistiques',
      });
    }
  });
}
