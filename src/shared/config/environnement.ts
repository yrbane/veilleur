/**
 * Veilleur - Configuration d'environnement
 * Gestion typée et validée des variables d'environnement
 *
 * Fonctionnalités:
 * - Validation des variables au démarrage
 * - Valeurs par défaut
 * - Types stricts
 * - Documentation des variables
 * - Support de plusieurs environnements
 */

// ============================================================
// TYPES
// ============================================================

type Environnement = 'development' | 'test' | 'staging' | 'production';

interface ConfigBase {
  readonly NODE_ENV: Environnement;
  readonly PORT: number;
  readonly HOST: string;
  readonly LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

interface ConfigDatabase {
  readonly DATABASE_URL: string;
  readonly DATABASE_POOL_MIN: number;
  readonly DATABASE_POOL_MAX: number;
  readonly DATABASE_SSL: boolean;
}

interface ConfigAuth {
  readonly JWT_SECRET: string;
  readonly JWT_ACCESS_EXPIRATION: string;
  readonly JWT_REFRESH_EXPIRATION: string;
  readonly BCRYPT_ROUNDS: number;
}

interface ConfigRedis {
  readonly REDIS_URL: string | null;
  readonly REDIS_PREFIX: string;
}

interface ConfigMail {
  readonly SMTP_HOST: string | null;
  readonly SMTP_PORT: number;
  readonly SMTP_USER: string | null;
  readonly SMTP_PASSWORD: string | null;
  readonly SMTP_FROM: string;
  readonly SMTP_SECURE: boolean;
}

interface ConfigExternal {
  readonly CORS_ORIGINS: string[];
  readonly API_RATE_LIMIT: number;
  readonly API_RATE_WINDOW_MS: number;
}

interface ConfigFeatures {
  readonly FEATURE_REGISTRATION: boolean;
  readonly FEATURE_EMAIL_VERIFICATION: boolean;
  readonly FEATURE_PASSWORD_RESET: boolean;
  readonly FEATURE_PUSH_NOTIFICATIONS: boolean;
}

export interface Config
  extends ConfigBase,
    ConfigDatabase,
    ConfigAuth,
    ConfigRedis,
    ConfigMail,
    ConfigExternal,
    ConfigFeatures {
  // Méthodes utilitaires
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly isTest: boolean;
}

// ============================================================
// PARSERS
// ============================================================

/**
 * Parse une string en nombre
 */
function parseNumber(value: string | undefined, defaut: number): number {
  if (!value) return defaut;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaut : parsed;
}

/**
 * Parse une string en booléen
 */
function parseBoolean(value: string | undefined, defaut: boolean): boolean {
  if (!value) return defaut;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse une liste séparée par virgules
 */
function parseArray(value: string | undefined, defaut: string[] = []): string[] {
  if (!value) return defaut;
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Obtient une variable obligatoire
 */
function requise(name: string, defautDev?: string): string {
  const value = process.env[name];

  if (!value) {
    // En développement, utiliser la valeur par défaut si fournie
    if (process.env.NODE_ENV === 'development' && defautDev !== undefined) {
      return defautDev;
    }
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }

  return value;
}

/**
 * Obtient une variable optionnelle
 */
function optionnelle(name: string, defaut: string = ''): string {
  return process.env[name] ?? defaut;
}

/**
 * Obtient une variable optionnelle qui peut être null
 */
function optionnelleOuNull(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : null;
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Valide l'environnement
 */
function validerEnvironnement(value: string): Environnement {
  const valides: Environnement[] = ['development', 'test', 'staging', 'production'];
  if (!valides.includes(value as Environnement)) {
    throw new Error(
      `NODE_ENV invalide: ${value}. Valeurs acceptées: ${valides.join(', ')}`,
    );
  }
  return value as Environnement;
}

/**
 * Valide le niveau de log
 */
function validerLogLevel(
  value: string,
): 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' {
  const valides = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
  if (!valides.includes(value as (typeof valides)[number])) {
    throw new Error(
      `LOG_LEVEL invalide: ${value}. Valeurs acceptées: ${valides.join(', ')}`,
    );
  }
  return value as (typeof valides)[number];
}

/**
 * Valide le secret JWT
 */
function validerJwtSecret(value: string, env: Environnement): void {
  if (env === 'production' && value.length < 32) {
    throw new Error('JWT_SECRET doit faire au moins 32 caractères en production');
  }
}

/**
 * Valide l'URL de la base de données
 */
function validerDatabaseUrl(value: string): void {
  if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL doit commencer par postgres:// ou postgresql://');
  }
}

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Charge et valide la configuration
 */
function chargerConfig(): Config {
  const nodeEnv = validerEnvironnement(optionnelle('NODE_ENV', 'development'));
  const isDev = nodeEnv === 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  // Database
  const databaseUrl = requise(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veilleur',
  );
  validerDatabaseUrl(databaseUrl);

  // JWT
  const jwtSecret = requise('JWT_SECRET', 'dev-secret-change-me-in-production');
  validerJwtSecret(jwtSecret, nodeEnv);

  const config: Config = {
    // Base
    NODE_ENV: nodeEnv,
    PORT: parseNumber(process.env.PORT, 3000),
    HOST: optionnelle('HOST', '0.0.0.0'),
    LOG_LEVEL: validerLogLevel(optionnelle('LOG_LEVEL', isDev ? 'debug' : 'info')),

    // Database
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_MIN: parseNumber(process.env.DATABASE_POOL_MIN, 2),
    DATABASE_POOL_MAX: parseNumber(process.env.DATABASE_POOL_MAX, 10),
    DATABASE_SSL: parseBoolean(process.env.DATABASE_SSL, isProd),

    // Auth
    JWT_SECRET: jwtSecret,
    JWT_ACCESS_EXPIRATION: optionnelle('JWT_ACCESS_EXPIRATION', '15m'),
    JWT_REFRESH_EXPIRATION: optionnelle('JWT_REFRESH_EXPIRATION', '7d'),
    BCRYPT_ROUNDS: parseNumber(process.env.BCRYPT_ROUNDS, isProd ? 12 : 10),

    // Redis
    REDIS_URL: optionnelleOuNull('REDIS_URL'),
    REDIS_PREFIX: optionnelle('REDIS_PREFIX', 'veilleur:'),

    // Mail
    SMTP_HOST: optionnelleOuNull('SMTP_HOST'),
    SMTP_PORT: parseNumber(process.env.SMTP_PORT, 587),
    SMTP_USER: optionnelleOuNull('SMTP_USER'),
    SMTP_PASSWORD: optionnelleOuNull('SMTP_PASSWORD'),
    SMTP_FROM: optionnelle('SMTP_FROM', 'noreply@veilleur.app'),
    SMTP_SECURE: parseBoolean(process.env.SMTP_SECURE, false),

    // External
    CORS_ORIGINS: parseArray(
      process.env.CORS_ORIGINS,
      isDev ? ['http://localhost:5173', 'http://localhost:3000'] : [],
    ),
    API_RATE_LIMIT: parseNumber(process.env.API_RATE_LIMIT, 100),
    API_RATE_WINDOW_MS: parseNumber(process.env.API_RATE_WINDOW_MS, 60000),

    // Features
    FEATURE_REGISTRATION: parseBoolean(process.env.FEATURE_REGISTRATION, true),
    FEATURE_EMAIL_VERIFICATION: parseBoolean(process.env.FEATURE_EMAIL_VERIFICATION, isProd),
    FEATURE_PASSWORD_RESET: parseBoolean(process.env.FEATURE_PASSWORD_RESET, true),
    FEATURE_PUSH_NOTIFICATIONS: parseBoolean(process.env.FEATURE_PUSH_NOTIFICATIONS, false),

    // Computed
    isDevelopment: isDev,
    isProduction: isProd,
    isTest: isTest,
  };

  return Object.freeze(config);
}

// ============================================================
// EXPORTS
// ============================================================

/**
 * Configuration de l'application (chargée une seule fois)
 */
export const config = chargerConfig();

/**
 * Vérifie que toutes les variables requises sont présentes
 */
export function verifierConfiguration(): { valide: boolean; erreurs: string[] } {
  const erreurs: string[] = [];

  // Vérifications critiques pour la production
  if (config.isProduction) {
    if (!config.REDIS_URL) {
      erreurs.push('REDIS_URL est recommandé en production');
    }

    if (!config.SMTP_HOST) {
      erreurs.push('SMTP_HOST est requis en production pour les emails');
    }

    if (config.CORS_ORIGINS.length === 0) {
      erreurs.push('CORS_ORIGINS doit être configuré en production');
    }

    if (config.JWT_SECRET.includes('dev') || config.JWT_SECRET.includes('secret')) {
      erreurs.push('JWT_SECRET semble être une valeur par défaut non sécurisée');
    }
  }

  return {
    valide: erreurs.length === 0,
    erreurs,
  };
}

/**
 * Affiche la configuration (masque les secrets)
 */
export function afficherConfiguration(): Record<string, unknown> {
  const masquer = (value: string | null): string => {
    if (!value) return '(non défini)';
    if (value.length <= 8) return '***';
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  };

  return {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    HOST: config.HOST,
    LOG_LEVEL: config.LOG_LEVEL,

    DATABASE_URL: masquer(config.DATABASE_URL),
    DATABASE_POOL_MIN: config.DATABASE_POOL_MIN,
    DATABASE_POOL_MAX: config.DATABASE_POOL_MAX,
    DATABASE_SSL: config.DATABASE_SSL,

    JWT_SECRET: masquer(config.JWT_SECRET),
    JWT_ACCESS_EXPIRATION: config.JWT_ACCESS_EXPIRATION,
    JWT_REFRESH_EXPIRATION: config.JWT_REFRESH_EXPIRATION,
    BCRYPT_ROUNDS: config.BCRYPT_ROUNDS,

    REDIS_URL: config.REDIS_URL ? masquer(config.REDIS_URL) : '(non défini)',
    REDIS_PREFIX: config.REDIS_PREFIX,

    SMTP_HOST: config.SMTP_HOST ?? '(non défini)',
    SMTP_PORT: config.SMTP_PORT,
    SMTP_USER: config.SMTP_USER ? masquer(config.SMTP_USER) : '(non défini)',
    SMTP_FROM: config.SMTP_FROM,

    CORS_ORIGINS: config.CORS_ORIGINS,
    API_RATE_LIMIT: config.API_RATE_LIMIT,
    API_RATE_WINDOW_MS: config.API_RATE_WINDOW_MS,

    FEATURE_REGISTRATION: config.FEATURE_REGISTRATION,
    FEATURE_EMAIL_VERIFICATION: config.FEATURE_EMAIL_VERIFICATION,
    FEATURE_PASSWORD_RESET: config.FEATURE_PASSWORD_RESET,
    FEATURE_PUSH_NOTIFICATIONS: config.FEATURE_PUSH_NOTIFICATIONS,
  };
}

/**
 * Helper pour les tests - permet de surcharger temporairement la config
 */
export function avecConfig<T>(
  overrides: Partial<Config>,
  fn: () => T,
): T {
  const original = { ...config };

  // Note: En production, ceci lancerait une erreur car config est frozen
  // C'est prévu uniquement pour les tests
  Object.assign(config as Config, overrides);

  try {
    return fn();
  } finally {
    Object.assign(config as Config, original);
  }
}
