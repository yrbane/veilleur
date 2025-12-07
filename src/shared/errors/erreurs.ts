/**
 * Veilleur - Système de gestion d'erreurs structuré
 * Erreurs typées avec codes, messages localisés et contexte
 *
 * Fonctionnalités:
 * - Hiérarchie d'erreurs typées
 * - Codes d'erreur standardisés
 * - Messages localisés (fr/en)
 * - Contexte additionnel pour debug
 * - Sérialisation pour API
 * - Utilitaires de création et traitement
 */

// ============================================================
// CODES D'ERREUR
// ============================================================

/**
 * Codes d'erreur par catégorie
 */
export const CODES_ERREUR = {
  // Authentification (AUTH_xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_REFRESH_FAILED: 'AUTH_REFRESH_FAILED',

  // Validation (VAL_xxx)
  VAL_INVALID_INPUT: 'VAL_INVALID_INPUT',
  VAL_MISSING_FIELD: 'VAL_MISSING_FIELD',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',
  VAL_OUT_OF_RANGE: 'VAL_OUT_OF_RANGE',
  VAL_DUPLICATE_VALUE: 'VAL_DUPLICATE_VALUE',

  // Ressources (RES_xxx)
  RES_NOT_FOUND: 'RES_NOT_FOUND',
  RES_ALREADY_EXISTS: 'RES_ALREADY_EXISTS',
  RES_CONFLICT: 'RES_CONFLICT',
  RES_GONE: 'RES_GONE',

  // Autorisations (PERM_xxx)
  PERM_FORBIDDEN: 'PERM_FORBIDDEN',
  PERM_INSUFFICIENT_ROLE: 'PERM_INSUFFICIENT_ROLE',
  PERM_RESOURCE_OWNER: 'PERM_RESOURCE_OWNER',

  // Rate limiting (RATE_xxx)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_TOO_MANY_REQUESTS: 'RATE_TOO_MANY_REQUESTS',

  // Externes (EXT_xxx)
  EXT_SERVICE_UNAVAILABLE: 'EXT_SERVICE_UNAVAILABLE',
  EXT_TIMEOUT: 'EXT_TIMEOUT',
  EXT_INVALID_RESPONSE: 'EXT_INVALID_RESPONSE',
  EXT_FEED_PARSE_ERROR: 'EXT_FEED_PARSE_ERROR',
  EXT_FEED_UNREACHABLE: 'EXT_FEED_UNREACHABLE',

  // Base de données (DB_xxx)
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_TRANSACTION_ERROR: 'DB_TRANSACTION_ERROR',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',

  // Système (SYS_xxx)
  SYS_INTERNAL_ERROR: 'SYS_INTERNAL_ERROR',
  SYS_NOT_IMPLEMENTED: 'SYS_NOT_IMPLEMENTED',
  SYS_MAINTENANCE: 'SYS_MAINTENANCE',
  SYS_OVERLOADED: 'SYS_OVERLOADED',
} as const;

export type CodeErreur = (typeof CODES_ERREUR)[keyof typeof CODES_ERREUR];

// ============================================================
// MESSAGES LOCALISÉS
// ============================================================

type Langue = 'fr' | 'en';

const MESSAGES: Record<CodeErreur, Record<Langue, string>> = {
  // Auth
  AUTH_INVALID_CREDENTIALS: {
    fr: 'Identifiants invalides',
    en: 'Invalid credentials',
  },
  AUTH_TOKEN_EXPIRED: {
    fr: 'Session expirée, veuillez vous reconnecter',
    en: 'Session expired, please log in again',
  },
  AUTH_TOKEN_INVALID: {
    fr: 'Token d\'authentification invalide',
    en: 'Invalid authentication token',
  },
  AUTH_TOKEN_MISSING: {
    fr: 'Authentification requise',
    en: 'Authentication required',
  },
  AUTH_ACCOUNT_LOCKED: {
    fr: 'Compte verrouillé suite à plusieurs tentatives échouées',
    en: 'Account locked due to multiple failed attempts',
  },
  AUTH_ACCOUNT_DISABLED: {
    fr: 'Ce compte a été désactivé',
    en: 'This account has been disabled',
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    fr: 'Veuillez vérifier votre email avant de vous connecter',
    en: 'Please verify your email before logging in',
  },
  AUTH_REFRESH_FAILED: {
    fr: 'Impossible de renouveler la session',
    en: 'Unable to refresh session',
  },

  // Validation
  VAL_INVALID_INPUT: {
    fr: 'Données invalides',
    en: 'Invalid input data',
  },
  VAL_MISSING_FIELD: {
    fr: 'Champ requis manquant',
    en: 'Required field missing',
  },
  VAL_INVALID_FORMAT: {
    fr: 'Format invalide',
    en: 'Invalid format',
  },
  VAL_OUT_OF_RANGE: {
    fr: 'Valeur hors limites',
    en: 'Value out of range',
  },
  VAL_DUPLICATE_VALUE: {
    fr: 'Cette valeur existe déjà',
    en: 'This value already exists',
  },

  // Ressources
  RES_NOT_FOUND: {
    fr: 'Ressource non trouvée',
    en: 'Resource not found',
  },
  RES_ALREADY_EXISTS: {
    fr: 'Cette ressource existe déjà',
    en: 'This resource already exists',
  },
  RES_CONFLICT: {
    fr: 'Conflit avec l\'état actuel',
    en: 'Conflict with current state',
  },
  RES_GONE: {
    fr: 'Cette ressource n\'existe plus',
    en: 'This resource no longer exists',
  },

  // Permissions
  PERM_FORBIDDEN: {
    fr: 'Accès refusé',
    en: 'Access denied',
  },
  PERM_INSUFFICIENT_ROLE: {
    fr: 'Permissions insuffisantes',
    en: 'Insufficient permissions',
  },
  PERM_RESOURCE_OWNER: {
    fr: 'Vous n\'êtes pas propriétaire de cette ressource',
    en: 'You do not own this resource',
  },

  // Rate limiting
  RATE_LIMIT_EXCEEDED: {
    fr: 'Limite de requêtes dépassée',
    en: 'Rate limit exceeded',
  },
  RATE_TOO_MANY_REQUESTS: {
    fr: 'Trop de requêtes, veuillez patienter',
    en: 'Too many requests, please wait',
  },

  // Externes
  EXT_SERVICE_UNAVAILABLE: {
    fr: 'Service externe indisponible',
    en: 'External service unavailable',
  },
  EXT_TIMEOUT: {
    fr: 'Délai d\'attente dépassé',
    en: 'Request timeout',
  },
  EXT_INVALID_RESPONSE: {
    fr: 'Réponse invalide du service externe',
    en: 'Invalid response from external service',
  },
  EXT_FEED_PARSE_ERROR: {
    fr: 'Erreur d\'analyse du flux RSS/Atom',
    en: 'RSS/Atom feed parse error',
  },
  EXT_FEED_UNREACHABLE: {
    fr: 'Flux RSS/Atom inaccessible',
    en: 'RSS/Atom feed unreachable',
  },

  // Base de données
  DB_CONNECTION_ERROR: {
    fr: 'Erreur de connexion à la base de données',
    en: 'Database connection error',
  },
  DB_QUERY_ERROR: {
    fr: 'Erreur lors de la requête',
    en: 'Query error',
  },
  DB_TRANSACTION_ERROR: {
    fr: 'Erreur de transaction',
    en: 'Transaction error',
  },
  DB_CONSTRAINT_VIOLATION: {
    fr: 'Contrainte de base de données violée',
    en: 'Database constraint violation',
  },

  // Système
  SYS_INTERNAL_ERROR: {
    fr: 'Une erreur interne est survenue',
    en: 'An internal error occurred',
  },
  SYS_NOT_IMPLEMENTED: {
    fr: 'Fonctionnalité non disponible',
    en: 'Feature not available',
  },
  SYS_MAINTENANCE: {
    fr: 'Service en maintenance',
    en: 'Service under maintenance',
  },
  SYS_OVERLOADED: {
    fr: 'Service surchargé, réessayez plus tard',
    en: 'Service overloaded, try again later',
  },
};

// ============================================================
// CLASSES D'ERREUR
// ============================================================

/**
 * Contexte d'erreur pour debug
 */
export interface ContexteErreur {
  [cle: string]: unknown;
}

/**
 * Erreur sérialisée pour API
 */
export interface ErreurSerialisee {
  code: CodeErreur;
  message: string;
  statusHttp: number;
  details?: ContexteErreur;
  timestamp: string;
  requestId?: string;
}

/**
 * Erreur applicative de base
 */
export class ErreurApplication extends Error {
  public readonly code: CodeErreur;
  public readonly statusHttp: number;
  public readonly contexte: ContexteErreur;
  public readonly timestamp: Date;
  public readonly estOperationnelle: boolean;

  constructor(
    code: CodeErreur,
    messagePersonnalise?: string,
    statusHttp: number = 500,
    contexte: ContexteErreur = {},
    estOperationnelle: boolean = true,
  ) {
    const message = messagePersonnalise ?? MESSAGES[code]?.fr ?? code;
    super(message);

    this.name = 'ErreurApplication';
    this.code = code;
    this.statusHttp = statusHttp;
    this.contexte = contexte;
    this.timestamp = new Date();
    this.estOperationnelle = estOperationnelle;

    // Capture la stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Obtient le message localisé
   */
  obtenirMessage(langue: Langue = 'fr'): string {
    return MESSAGES[this.code]?.[langue] ?? this.message;
  }

  /**
   * Sérialise l'erreur pour API
   */
  serialiser(requestId?: string, inclureDetails: boolean = false): ErreurSerialisee {
    return {
      code: this.code,
      message: this.obtenirMessage(),
      statusHttp: this.statusHttp,
      ...(inclureDetails && Object.keys(this.contexte).length > 0 ? { details: this.contexte } : {}),
      timestamp: this.timestamp.toISOString(),
      ...(requestId ? { requestId } : {}),
    };
  }
}

/**
 * Erreur d'authentification
 */
export class ErreurAuthentification extends ErreurApplication {
  constructor(
    code: CodeErreur = CODES_ERREUR.AUTH_TOKEN_INVALID,
    messagePersonnalise?: string,
    contexte: ContexteErreur = {},
  ) {
    super(code, messagePersonnalise, 401, contexte);
    this.name = 'ErreurAuthentification';
  }
}

/**
 * Erreur de validation
 */
export class ErreurValidation extends ErreurApplication {
  public readonly erreurs: Array<{ chemin: string; message: string }>;

  constructor(
    erreurs: Array<{ chemin: string; message: string }>,
    messagePersonnalise?: string,
  ) {
    super(
      CODES_ERREUR.VAL_INVALID_INPUT,
      messagePersonnalise ?? 'Données invalides',
      400,
      { erreurs },
    );
    this.name = 'ErreurValidation';
    this.erreurs = erreurs;
  }
}

/**
 * Erreur ressource non trouvée
 */
export class ErreurNonTrouvee extends ErreurApplication {
  constructor(
    ressource: string,
    identifiant?: string,
  ) {
    super(
      CODES_ERREUR.RES_NOT_FOUND,
      `${ressource}${identifiant ? ` (${identifiant})` : ''} non trouvé(e)`,
      404,
      { ressource, identifiant },
    );
    this.name = 'ErreurNonTrouvee';
  }
}

/**
 * Erreur d'autorisation
 */
export class ErreurAutorisation extends ErreurApplication {
  constructor(
    code: CodeErreur = CODES_ERREUR.PERM_FORBIDDEN,
    messagePersonnalise?: string,
    contexte: ContexteErreur = {},
  ) {
    super(code, messagePersonnalise, 403, contexte);
    this.name = 'ErreurAutorisation';
  }
}

/**
 * Erreur de rate limiting
 */
export class ErreurRateLimit extends ErreurApplication {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      CODES_ERREUR.RATE_LIMIT_EXCEEDED,
      undefined,
      429,
      { retryAfter },
    );
    this.name = 'ErreurRateLimit';
    this.retryAfter = retryAfter;
  }
}

/**
 * Erreur de service externe
 */
export class ErreurExterne extends ErreurApplication {
  constructor(
    code: CodeErreur = CODES_ERREUR.EXT_SERVICE_UNAVAILABLE,
    service: string,
    messagePersonnalise?: string,
    contexte: ContexteErreur = {},
  ) {
    super(code, messagePersonnalise, 502, { service, ...contexte });
    this.name = 'ErreurExterne';
  }
}

/**
 * Erreur de conflit (ressource existante, etc.)
 */
export class ErreurConflit extends ErreurApplication {
  constructor(
    messagePersonnalise?: string,
    contexte: ContexteErreur = {},
  ) {
    super(CODES_ERREUR.RES_CONFLICT, messagePersonnalise, 409, contexte);
    this.name = 'ErreurConflit';
  }
}

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Vérifie si une erreur est une ErreurApplication
 */
export function estErreurApplication(erreur: unknown): erreur is ErreurApplication {
  return erreur instanceof ErreurApplication;
}

/**
 * Convertit une erreur inconnue en ErreurApplication
 */
export function normaliserErreur(erreur: unknown): ErreurApplication {
  if (estErreurApplication(erreur)) {
    return erreur;
  }

  if (erreur instanceof Error) {
    return new ErreurApplication(
      CODES_ERREUR.SYS_INTERNAL_ERROR,
      erreur.message,
      500,
      { originalError: erreur.name, stack: erreur.stack },
      false,
    );
  }

  return new ErreurApplication(
    CODES_ERREUR.SYS_INTERNAL_ERROR,
    String(erreur),
    500,
    {},
    false,
  );
}

/**
 * Crée une erreur à partir d'un code
 */
export function creerErreur(
  code: CodeErreur,
  options?: {
    message?: string;
    contexte?: ContexteErreur;
    statusHttp?: number;
  },
): ErreurApplication {
  const statusParDefaut = obtenirStatusParDefaut(code);
  return new ErreurApplication(
    code,
    options?.message,
    options?.statusHttp ?? statusParDefaut,
    options?.contexte,
  );
}

/**
 * Obtient le status HTTP par défaut pour un code d'erreur
 */
function obtenirStatusParDefaut(code: CodeErreur): number {
  if (code.startsWith('AUTH_')) return 401;
  if (code.startsWith('VAL_')) return 400;
  if (code.startsWith('PERM_')) return 403;
  if (code.startsWith('RES_NOT_FOUND')) return 404;
  if (code.startsWith('RES_')) return 409;
  if (code.startsWith('RATE_')) return 429;
  if (code.startsWith('EXT_')) return 502;
  if (code.startsWith('DB_')) return 503;
  return 500;
}

/**
 * Wrapper pour exécuter une fonction et capturer les erreurs
 */
export async function capturer<T>(
  fn: () => Promise<T>,
  transformateur?: (erreur: unknown) => ErreurApplication,
): Promise<T> {
  try {
    return await fn();
  } catch (erreur) {
    if (transformateur) {
      throw transformateur(erreur);
    }
    throw normaliserErreur(erreur);
  }
}

/**
 * Asserts qu'une condition est vraie, sinon lance une erreur
 */
export function asserter(
  condition: boolean,
  code: CodeErreur,
  message?: string,
): asserts condition {
  if (!condition) {
    throw creerErreur(code, { message });
  }
}

/**
 * Asserts qu'une valeur n'est pas null/undefined
 */
export function asserterDefini<T>(
  valeur: T | null | undefined,
  ressource: string,
  identifiant?: string,
): asserts valeur is T {
  if (valeur === null || valeur === undefined) {
    throw new ErreurNonTrouvee(ressource, identifiant);
  }
}
