/**
 * Veilleur - Configuration d'environnement
 * Variables d'environnement typées et validées
 */

import { z } from 'zod';

/**
 * Schéma de validation des variables d'environnement
 */
const schemaEnvironnement = z.object({
  // Serveur
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // CORS - Liste des origines autorisées (séparées par des virgules)
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  // Base de données MariaDB
  DATABASE_URL: z.string().url().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('veilleur'),
  DB_PASSWORD: z.string().default('veilleur_secret'),
  DB_NAME: z.string().default('veilleur'),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // JWT
  JWT_SECRET: z.string().min(32).default('dev-jwt-secret-change-in-production-32chars'),
  JWT_REFRESH_SECRET: z.string().min(32).default('dev-refresh-secret-change-in-production32'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Scraping
  SCRAPING_USER_AGENT: z.string().default('Veilleur/1.0 (+https://github.com/yrbane/veilleur)'),
  SCRAPING_RATE_LIMIT_MS: z.coerce.number().default(5000),
  SCRAPING_TIMEOUT_MS: z.coerce.number().default(10000),

  // Rate Limiting
  RATE_LIMIT_IP_MAX: z.coerce.number().default(60),
  RATE_LIMIT_USER_MAX: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Limites de taille des requêtes (en octets)
  BODY_LIMIT: z.coerce.number().default(1048576), // 1 Mo par défaut

  // Signature HMAC pour les requêtes API-to-API
  API_HMAC_SECRET: z.string().min(32).optional(),
});

export type Environnement = z.infer<typeof schemaEnvironnement>;

/**
 * Parse et valide les variables d'environnement
 */
function chargerEnvironnement(): Environnement {
  const resultat = schemaEnvironnement.safeParse(process.env);

  if (!resultat.success) {
    console.error('❌ Variables d\'environnement invalides:');
    for (const erreur of resultat.error.errors) {
      console.error(`  - ${erreur.path.join('.')}: ${erreur.message}`);
    }
    throw new Error('Configuration d\'environnement invalide');
  }

  return resultat.data;
}

/**
 * Configuration d'environnement validée
 */
export const env = chargerEnvironnement();

/**
 * URL de connexion à la base de données
 */
export function obtenirUrlBaseDeDonnees(): string {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  return `mysql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
}

/**
 * URL de connexion à Redis
 */
export function obtenirUrlRedis(): string {
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }
  return `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`;
}

/**
 * Vérifie si on est en mode développement
 */
export function estDeveloppement(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Vérifie si on est en mode production
 */
export function estProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Vérifie si on est en mode test
 */
export function estTest(): boolean {
  return env.NODE_ENV === 'test';
}

/**
 * Retourne la liste des origines CORS autorisées
 */
export function obtenirOriginesCORS(): string[] {
  return env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean);
}
