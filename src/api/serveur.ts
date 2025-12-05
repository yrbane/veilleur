/**
 * Veilleur - Serveur API
 * Point d'entrée de l'application
 */

import Fastify from 'fastify';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const serveur = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// Route de santé pour Docker healthcheck
serveur.get('/api/v1/health', async () => {
  return {
    statut: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  };
});

// Route d'accueil
serveur.get('/', async () => {
  return {
    nom: 'Veilleur',
    description: 'Votre sentinelle de l\'information',
    version: '0.1.0',
    documentation: '/api/v1/docs',
  };
});

// Démarrage du serveur
const demarrer = async (): Promise<void> => {
  try {
    await serveur.listen({ port: PORT, host: HOST });
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║   🔭 Veilleur est prêt !                  ║
    ║                                           ║
    ║   → http://localhost:${PORT}                 ║
    ║   → Santé: /api/v1/health                 ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝
    `);
  } catch (erreur) {
    serveur.log.error(erreur);
    process.exit(1);
  }
};

demarrer();
