/**
 * Veilleur - Logger structuré avancé
 * Logging avec contexte, corrélation et formatage
 *
 * Fonctionnalités:
 * - Contexte de requête (request ID, user ID)
 * - Corrélation entre logs
 * - Masquage automatique des données sensibles
 * - Support AsyncLocalStorage
 * - Métriques de performance
 */

import { AsyncLocalStorage } from 'async_hooks';

// ============================================================
// TYPES
// ============================================================

type NiveauLog = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface ContexteLog {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  module?: string;
  action?: string;
  [key: string]: unknown;
}

interface EntreeLog {
  niveau: NiveauLog;
  message: string;
  timestamp: string;
  contexte: ContexteLog;
  donnees?: Record<string, unknown>;
  erreur?: {
    nom: string;
    message: string;
    stack?: string;
    cause?: unknown;
  };
  duree?: number;
}

interface OptionsLogger {
  niveau?: NiveauLog;
  destination?: (entree: EntreeLog) => void;
  formateur?: (entree: EntreeLog) => string;
  masquerCles?: string[];
  environnement?: string;
}

// ============================================================
// CONSTANTES
// ============================================================

const NIVEAUX_PRIORITE: Record<NiveauLog, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const CLES_SENSIBLES_DEFAUT = [
  'password',
  'mot_de_passe',
  'motDePasse',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'creditCard',
  'carte_credit',
  'cvv',
  'ssn',
  'privateKey',
  'cle_privee',
];

// ============================================================
// ASYNC LOCAL STORAGE
// ============================================================

const contextStorage = new AsyncLocalStorage<ContexteLog>();

/**
 * Obtient le contexte actuel depuis AsyncLocalStorage
 */
export function obtenirContexte(): ContexteLog {
  return contextStorage.getStore() ?? {};
}

/**
 * Exécute une fonction avec un contexte de log
 */
export function avecContexte<T>(contexte: ContexteLog, fn: () => T): T {
  const contexteActuel = obtenirContexte();
  return contextStorage.run({ ...contexteActuel, ...contexte }, fn);
}

/**
 * Exécute une fonction async avec un contexte de log
 */
export async function avecContexteAsync<T>(
  contexte: ContexteLog,
  fn: () => Promise<T>,
): Promise<T> {
  const contexteActuel = obtenirContexte();
  return contextStorage.run({ ...contexteActuel, ...contexte }, fn);
}

// ============================================================
// MASQUAGE
// ============================================================

/**
 * Masque les valeurs sensibles dans un objet
 */
function masquerSensible(
  obj: unknown,
  clesSensibles: string[],
  profondeur = 0,
): unknown {
  if (profondeur > 10) return '[Profondeur max atteinte]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => masquerSensible(item, clesSensibles, profondeur + 1));
  }

  const resultat: Record<string, unknown> = {};

  for (const [cle, valeur] of Object.entries(obj as Record<string, unknown>)) {
    const cleMinuscule = cle.toLowerCase();
    const estSensible = clesSensibles.some(
      sensible => cleMinuscule.includes(sensible.toLowerCase()),
    );

    if (estSensible) {
      resultat[cle] = '[MASQUÉ]';
    } else if (typeof valeur === 'object' && valeur !== null) {
      resultat[cle] = masquerSensible(valeur, clesSensibles, profondeur + 1);
    } else {
      resultat[cle] = valeur;
    }
  }

  return resultat;
}

// ============================================================
// FORMATEURS
// ============================================================

/**
 * Formateur JSON (pour production/agrégation)
 */
function formateurJson(entree: EntreeLog): string {
  return JSON.stringify(entree);
}

/**
 * Formateur lisible (pour développement)
 */
function formateurLisible(entree: EntreeLog): string {
  const { niveau, message, timestamp, contexte, donnees, erreur, duree } = entree;

  const couleurs: Record<NiveauLog, string> = {
    trace: '\x1b[90m',
    debug: '\x1b[36m',
    info: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    fatal: '\x1b[35m',
  };
  const reset = '\x1b[0m';

  const temps = new Date(timestamp).toLocaleTimeString('fr-FR');
  const niveauFormate = niveau.toUpperCase().padEnd(5);

  let ligne = `${couleurs[niveau]}${temps} ${niveauFormate}${reset}`;

  if (contexte.module) {
    ligne += ` [${contexte.module}]`;
  }

  if (contexte.requestId) {
    ligne += ` (${contexte.requestId.substring(0, 8)})`;
  }

  ligne += ` ${message}`;

  if (duree !== undefined) {
    ligne += ` (${duree}ms)`;
  }

  if (donnees && Object.keys(donnees).length > 0) {
    ligne += ` ${JSON.stringify(donnees)}`;
  }

  if (erreur) {
    ligne += `\n${couleurs.error}${erreur.nom}: ${erreur.message}${reset}`;
    if (erreur.stack) {
      ligne += `\n${erreur.stack}`;
    }
  }

  return ligne;
}

// ============================================================
// LOGGER
// ============================================================

/**
 * Crée un logger avec les options spécifiées
 */
export function creerLogger(options: OptionsLogger = {}) {
  const {
    niveau: niveauMin = 'info',
    destination = (entree: EntreeLog) => {
      const sortie = process.env.NODE_ENV === 'production'
        ? formateurJson(entree)
        : (options.formateur ?? formateurLisible)(entree);

      if (NIVEAUX_PRIORITE[entree.niveau] >= NIVEAUX_PRIORITE.error) {
        console.error(sortie);
      } else {
        console.log(sortie);
      }
    },
    masquerCles = CLES_SENSIBLES_DEFAUT,
    environnement = process.env.NODE_ENV ?? 'development',
  } = options;

  const doitLogger = (niveau: NiveauLog): boolean => {
    return NIVEAUX_PRIORITE[niveau] >= NIVEAUX_PRIORITE[niveauMin];
  };

  const log = (
    niveau: NiveauLog,
    message: string,
    donnees?: Record<string, unknown>,
    erreur?: Error,
  ) => {
    if (!doitLogger(niveau)) return;

    const contexte = obtenirContexte();
    const entree: EntreeLog = {
      niveau,
      message,
      timestamp: new Date().toISOString(),
      contexte: {
        ...contexte,
        environnement,
      },
    };

    if (donnees) {
      entree.donnees = masquerSensible(donnees, masquerCles) as Record<
        string,
        unknown
      >;
    }

    if (erreur) {
      entree.erreur = {
        nom: erreur.name,
        message: erreur.message,
        stack: erreur.stack,
        cause: erreur.cause,
      };
    }

    destination(entree);
  };

  return {
    trace: (message: string, donnees?: Record<string, unknown>) =>
      log('trace', message, donnees),

    debug: (message: string, donnees?: Record<string, unknown>) =>
      log('debug', message, donnees),

    info: (message: string, donnees?: Record<string, unknown>) =>
      log('info', message, donnees),

    warn: (message: string, donnees?: Record<string, unknown>) =>
      log('warn', message, donnees),

    error: (
      message: string,
      erreurOuDonnees?: Error | Record<string, unknown>,
      donnees?: Record<string, unknown>,
    ) => {
      if (erreurOuDonnees instanceof Error) {
        log('error', message, donnees, erreurOuDonnees);
      } else {
        log('error', message, erreurOuDonnees);
      }
    },

    fatal: (
      message: string,
      erreurOuDonnees?: Error | Record<string, unknown>,
      donnees?: Record<string, unknown>,
    ) => {
      if (erreurOuDonnees instanceof Error) {
        log('fatal', message, donnees, erreurOuDonnees);
      } else {
        log('fatal', message, erreurOuDonnees);
      }
    },

    /**
     * Crée un child logger avec contexte supplémentaire
     */
    child: (contexteSupp: ContexteLog) => {
      return {
        trace: (message: string, donnees?: Record<string, unknown>) =>
          avecContexte(contexteSupp, () => log('trace', message, donnees)),

        debug: (message: string, donnees?: Record<string, unknown>) =>
          avecContexte(contexteSupp, () => log('debug', message, donnees)),

        info: (message: string, donnees?: Record<string, unknown>) =>
          avecContexte(contexteSupp, () => log('info', message, donnees)),

        warn: (message: string, donnees?: Record<string, unknown>) =>
          avecContexte(contexteSupp, () => log('warn', message, donnees)),

        error: (
          message: string,
          erreurOuDonnees?: Error | Record<string, unknown>,
          donnees?: Record<string, unknown>,
        ) =>
          avecContexte(contexteSupp, () => {
            if (erreurOuDonnees instanceof Error) {
              log('error', message, donnees, erreurOuDonnees);
            } else {
              log('error', message, erreurOuDonnees);
            }
          }),

        fatal: (
          message: string,
          erreurOuDonnees?: Error | Record<string, unknown>,
          donnees?: Record<string, unknown>,
        ) =>
          avecContexte(contexteSupp, () => {
            if (erreurOuDonnees instanceof Error) {
              log('fatal', message, donnees, erreurOuDonnees);
            } else {
              log('fatal', message, erreurOuDonnees);
            }
          }),
      };
    },

    /**
     * Mesure et log le temps d'exécution
     */
    time: (label: string) => {
      const debut = performance.now();
      return {
        end: (donnees?: Record<string, unknown>) => {
          const duree = Math.round(performance.now() - debut);
          const contexte = obtenirContexte();

          const entree: EntreeLog = {
            niveau: 'info',
            message: label,
            timestamp: new Date().toISOString(),
            contexte,
            duree,
          };

          if (donnees) {
            entree.donnees = masquerSensible(donnees, masquerCles) as Record<
              string,
              unknown
            >;
          }

          destination(entree);
          return duree;
        },
      };
    },

    /**
     * Wrapper pour mesurer une fonction
     */
    mesurer: async <T>(
      label: string,
      fn: () => Promise<T>,
    ): Promise<{ resultat: T; duree: number }> => {
      const timer = performance.now();
      try {
        const resultat = await fn();
        const duree = Math.round(performance.now() - timer);
        log('debug', `${label} terminé`, { duree });
        return { resultat, duree };
      } catch (erreur) {
        const duree = Math.round(performance.now() - timer);
        log('error', `${label} échoué`, { duree }, erreur as Error);
        throw erreur;
      }
    },
  };
}

// ============================================================
// INSTANCE PAR DÉFAUT
// ============================================================

/**
 * Logger par défaut de l'application
 */
export const log = creerLogger({
  niveau: (process.env.LOG_LEVEL as NiveauLog) ?? 'info',
});

// ============================================================
// MIDDLEWARE EXPRESS
// ============================================================

/**
 * Génère un ID de requête unique
 */
export function genererRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Crée un middleware de logging pour Express
 * Note: Retourne une fonction compatible avec Express middleware
 */
export function creerMiddlewareLog() {
  return (
    req: { method: string; url: string; headers: Record<string, string | string[] | undefined>; ip?: string },
    res: { statusCode: number; on: (event: string, fn: () => void) => void },
    next: () => void,
  ) => {
    const requestId = genererRequestId();
    const debut = performance.now();

    // Extraire userId si présent (à adapter selon votre auth)
    const userId = (req as Record<string, unknown>).userId as string | undefined;

    const contexte: ContexteLog = {
      requestId,
      userId,
      module: 'http',
    };

    avecContexte(contexte, () => {
      log.info('Requête entrante', {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      res.on('finish', () => {
        const duree = Math.round(performance.now() - debut);
        const niveau: NiveauLog = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        avecContexte(contexte, () => {
          log[niveau]('Requête terminée', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duree,
          });
        });
      });

      next();
    });
  };
}

// ============================================================
// EXPORTS TYPES
// ============================================================

export type { NiveauLog, ContexteLog, EntreeLog, OptionsLogger };
