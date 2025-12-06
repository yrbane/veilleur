/**
 * Veilleur - Serveur API
 * Point d'entrée de l'application
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySensible from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { env, estDeveloppement, obtenirOriginesCORS } from '@/config/environnement';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { logger } from '@/infrastructure/logging/logger';
import { creerConnexion, fermerConnexion, verifierConnexion } from '@/infrastructure/persistence/connexion';
import { creerConnexionRedis, fermerConnexionRedis, verifierConnexionRedis, obtenirStatsRedis } from '@/infrastructure/cache/connexionRedis';
import { routesAuth } from './routes/auth';
import { routesSources } from './routes/sources';
import { routesArticles } from './routes/articles';
import { routesTags } from './routes/tags';
import { routesCommunaute } from './routes/communaute';
import { pluginAuthentification } from './middlewares/authentification';

/**
 * Crée et configure l'instance Fastify
 */
export async function creerServeur(): Promise<FastifyInstance> {
  const serveur = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: estDeveloppement()
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
    },
    trustProxy: true,
    // Limite de taille du body pour prévenir les attaques par déni de service
    bodyLimit: env.BODY_LIMIT,
  });

  // Plugins de sécurité - Helmet avec CSP configuré
  await serveur.register(fastifyHelmet, {
    contentSecurityPolicy: estDeveloppement() ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline pour le SPA
        styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline pour les styles inline
        imgSrc: ["'self'", 'data:', 'https:'], // Autoriser images externes HTTPS
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // Headers de sécurité supplémentaires
    crossOriginEmbedderPolicy: false, // Désactivé pour permettre les images externes
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Permettre les ressources cross-origin
    originAgentCluster: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: {
      maxAge: 31536000, // 1 an
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xDownloadOptions: true,
    xFrameOptions: { action: 'deny' },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
    xXssProtection: true,
  });

  await serveur.register(fastifyCors, {
    origin: (origin, callback) => {
      // En développement, autoriser toutes les origines
      if (estDeveloppement()) {
        return callback(null, true);
      }
      // Sans origine (requête serveur-to-serveur), autoriser
      if (!origin) {
        return callback(null, true);
      }
      // Vérifier si l'origine est dans la liste blanche
      const originesAutorisees = obtenirOriginesCORS();
      if (originesAutorisees.includes(origin)) {
        return callback(null, true);
      }
      // Rejeter l'origine non autorisée
      logger.warn({ origin }, 'Origine CORS rejetée');
      return callback(new Error('Origine non autorisée par CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 heures
  });

  // Rate limiting - Combiné IP + Utilisateur authentifié
  await serveur.register(fastifyRateLimit, {
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request: FastifyRequest) => {
      // Si l'utilisateur est authentifié, utiliser son ID pour un rate limit plus élevé
      const utilisateur = (request as FastifyRequest & { utilisateur?: { sub: string } }).utilisateur;
      if (utilisateur?.sub) {
        return `user:${utilisateur.sub}`;
      }
      // Sinon, utiliser l'IP
      return `ip:${request.ip}`;
    },
    // Limite dynamique selon le type d'utilisateur
    max: (request: FastifyRequest) => {
      const utilisateur = (request as FastifyRequest & { utilisateur?: { sub: string } }).utilisateur;
      if (utilisateur?.sub) {
        return env.RATE_LIMIT_USER_MAX; // 300 requêtes/minute pour les authentifiés
      }
      return env.RATE_LIMIT_IP_MAX; // 60 requêtes/minute pour les anonymes
    },
    errorResponseBuilder: (_request: FastifyRequest, context) => {
      return {
        erreur: 'RATE_LIMIT_DEPASSE',
        message: 'Trop de requêtes. Veuillez réessayer plus tard.',
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // Utilitaires
  await serveur.register(fastifySensible);

  // Documentation Swagger
  await serveur.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Veilleur API',
        description: 'API de l\'agrégateur d\'actualités Veilleur',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Serveur de développement',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await serveur.register(fastifySwaggerUi, {
    routePrefix: '/api/v1/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Route de santé pour Docker healthcheck
  serveur.get('/api/v1/health', {
    schema: {
      tags: ['Système'],
      summary: 'Vérifie l\'état du serveur',
      response: {
        200: {
          type: 'object',
          properties: {
            statut: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                base_de_donnees: { type: 'boolean' },
                cache: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const [bddOk, cacheOk] = await Promise.all([
      verifierConnexion(),
      verifierConnexionRedis(),
    ]);

    return {
      statut: bddOk && cacheOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      services: {
        base_de_donnees: bddOk,
        cache: cacheOk,
      },
    };
  });

  // Route de métriques Redis
  serveur.get('/api/v1/health/cache', {
    schema: {
      tags: ['Système'],
      summary: 'Statistiques du cache Redis',
    },
  }, async () => {
    return obtenirStatsRedis();
  });

  // En production, servir les fichiers statiques du frontend
  const clientDistPath = join(__dirname, '../../dist/client');
  const indexHtmlPath = join(clientDistPath, 'index.html');

  if (!estDeveloppement() && existsSync(clientDistPath)) {
    // Servir les assets statiques (JS, CSS, images)
    await serveur.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback: toutes les routes non-API retournent index.html
    serveur.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      // Ne pas intercepter les routes API
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({
          erreur: 'ROUTE_NON_TROUVEE',
          message: `Route ${request.method} ${request.url} non trouvée`,
        });
      }

      // Retourner index.html pour le SPA routing
      if (existsSync(indexHtmlPath)) {
        const html = readFileSync(indexHtmlPath, 'utf-8');
        return reply.type('text/html').send(html);
      }

      return reply.status(404).send({
        erreur: 'FRONTEND_NON_TROUVE',
        message: 'Frontend non buildé',
      });
    });

    logger.info({ clientDistPath }, 'Mode production: frontend servi depuis dist/client');
  } else {
    // En développement, simple route d'accueil JSON
    serveur.get('/', async () => {
      return {
        nom: 'Veilleur',
        description: 'Votre sentinelle de l\'information',
        version: '0.1.0',
        documentation: '/api/v1/docs',
        mode: 'developpement',
        frontend: 'http://localhost:5173',
      };
    });
  }

  // Plugin d'authentification
  await serveur.register(pluginAuthentification);

  // Routes d'authentification
  await serveur.register(routesAuth, { prefix: '/api/v1/auth' });

  // Routes des sources
  await serveur.register(routesSources, { prefix: '/api/v1/sources' });

  // Routes des articles
  await serveur.register(routesArticles, { prefix: '/api/v1/articles' });

  // Routes des tags
  await serveur.register(routesTags, { prefix: '/api/v1/tags' });

  // Routes de découverte communautaire
  await serveur.register(routesCommunaute, { prefix: '/api/v1/communaute' });

  // Gestion des erreurs
  serveur.setErrorHandler((erreur, request, reply) => {
    const err = erreur as Error & { statusCode?: number };
    logger.error({
      erreur: err.message,
      stack: err.stack,
      url: request.url,
      methode: request.method,
    }, 'Erreur non gérée');

    if (err.statusCode === 429) {
      return reply.status(429).send({
        erreur: 'Trop de requêtes',
        message: 'Veuillez réessayer plus tard',
      });
    }

    const statusCode = err.statusCode ?? 500;
    return reply.status(statusCode).send({
      erreur: statusCode >= 500 ? 'Erreur interne' : err.message,
      ...(estDeveloppement() && { stack: err.stack }),
    });
  });

  return serveur;
}

/**
 * Initialise les connexions aux services externes
 */
export async function initialiserConnexions(): Promise<void> {
  logger.info('Initialisation des connexions...');

  await Promise.all([
    creerConnexion(),
    creerConnexionRedis(),
  ]);

  logger.info('Connexions établies');
}

/**
 * Ferme proprement les connexions
 */
export async function fermerConnexions(): Promise<void> {
  logger.info('Fermeture des connexions...');

  await Promise.all([
    fermerConnexion(),
    fermerConnexionRedis(),
  ]);

  logger.info('Connexions fermées');
}

/**
 * Démarre le serveur
 */
export async function demarrerServeur(): Promise<FastifyInstance> {
  const serveur = await creerServeur();

  // Initialiser les connexions
  await initialiserConnexions();

  // Gestion du shutdown graceful
  const signaux: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signaux) {
    process.on(signal, async () => {
      logger.info({ signal }, 'Signal reçu, arrêt en cours...');

      try {
        await serveur.close();
        await fermerConnexions();
        process.exit(0);
      } catch (erreur) {
        logger.error({ erreur }, 'Erreur lors de l\'arrêt');
        process.exit(1);
      }
    });
  }

  // Démarrer le serveur
  await serveur.listen({ port: env.PORT, host: env.HOST });

  logger.info(`
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║   Veilleur est pret !                     ║
    ║                                           ║
    ║   -> http://localhost:${env.PORT}                 ║
    ║   -> Sante: /api/v1/health                ║
    ║   -> Docs: /api/v1/docs                   ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝
  `);

  return serveur;
}

// Point d'entrée si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  demarrerServeur().catch(erreur => {
    logger.error({ erreur }, 'Échec du démarrage');
    process.exit(1);
  });
}
