/**
 * Veilleur - Validation des URLs de redirection
 * Protection contre les attaques Open Redirect
 *
 * Utilisé pour valider les paramètres redirect_uri dans OAuth,
 * les liens de confirmation email, et autres redirections.
 */

import { obtenirOriginesCORS, estDeveloppement } from '@/config/environnement';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Résultat de la validation d'URL de redirection
 */
export interface ResultatValidationRedirect {
  valide: boolean;
  url: string | null;
  erreur?: string;
}

/**
 * Caractères dangereux dans les URLs de redirection
 */
const CARACTERES_DANGEREUX = [
  '@',           // Credentials
  '\\',          // Backslash (peut être utilisé pour contourner)
  '%00',         // Null byte
  '%0d',         // CR
  '%0a',         // LF
  'javascript:', // XSS
  'data:',       // XSS
  'vbscript:',   // XSS
];

/**
 * Patterns d'URLs dangereuses
 */
const PATTERNS_DANGEREUX = [
  /\/\/[^/]/,    // Double slash suivi d'autre chose que / (protocol-relative)
  /[\x00-\x1f]/, // Caractères de contrôle
];

/**
 * Vérifie si une URL contient des caractères ou patterns dangereux
 */
function contientPatternsDangereux(url: string): boolean {
  const urlLower = url.toLowerCase();

  // Vérifier les caractères dangereux
  for (const char of CARACTERES_DANGEREUX) {
    if (urlLower.includes(char)) {
      return true;
    }
  }

  // Vérifier les patterns dangereux
  for (const pattern of PATTERNS_DANGEREUX) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Valide une URL de redirection pour l'authentification
 *
 * Vérifie que l'URL:
 * - Est une URL valide
 * - Utilise HTTPS (sauf en développement)
 * - Appartient à un domaine autorisé
 * - Ne contient pas de patterns dangereux
 *
 * @param redirectUrl - URL de redirection à valider
 * @returns Résultat de la validation
 */
export function validerUrlRedirection(redirectUrl: string): ResultatValidationRedirect {
  // Vérifier que l'URL n'est pas vide
  if (!redirectUrl || typeof redirectUrl !== 'string') {
    return {
      valide: false,
      url: null,
      erreur: 'URL de redirection vide ou invalide',
    };
  }

  const urlNettoyee = redirectUrl.trim();

  // Vérifier les patterns dangereux avant le parsing
  if (contientPatternsDangereux(urlNettoyee)) {
    logger.warn({ url: urlNettoyee }, 'URL de redirection avec patterns dangereux bloquée');
    return {
      valide: false,
      url: null,
      erreur: 'URL de redirection contient des caractères non autorisés',
    };
  }

  // Parser l'URL
  let url: URL;
  try {
    url = new URL(urlNettoyee);
  } catch {
    // Autoriser les chemins relatifs (/callback, /login, etc.)
    if (urlNettoyee.startsWith('/') && !urlNettoyee.startsWith('//')) {
      // Valider que c'est un chemin simple sans injection
      if (/^\/[\w\-./]*$/.test(urlNettoyee)) {
        return {
          valide: true,
          url: urlNettoyee,
        };
      }
    }

    return {
      valide: false,
      url: null,
      erreur: 'URL mal formée',
    };
  }

  // Vérifier le protocole (HTTPS requis en production)
  if (!estDeveloppement() && url.protocol !== 'https:') {
    logger.warn({ url: urlNettoyee }, 'URL de redirection non-HTTPS bloquée');
    return {
      valide: false,
      url: null,
      erreur: 'HTTPS requis pour les redirections',
    };
  }

  // En développement, autoriser HTTP aussi
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      valide: false,
      url: null,
      erreur: 'Protocole non autorisé',
    };
  }

  // Vérifier que l'origine est dans la liste blanche
  const originesAutorisees = obtenirOriginesCORS();
  const origine = `${url.protocol}//${url.host}`;

  if (!originesAutorisees.includes(origine)) {
    // En développement, être plus permissif
    if (estDeveloppement() && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
      return {
        valide: true,
        url: url.toString(),
      };
    }

    logger.warn({ url: urlNettoyee, origine }, 'URL de redirection vers origine non autorisée');
    return {
      valide: false,
      url: null,
      erreur: 'Origine de redirection non autorisée',
    };
  }

  return {
    valide: true,
    url: url.toString(),
  };
}

/**
 * Valide une URL de redirection et retourne une URL par défaut si invalide
 *
 * @param redirectUrl - URL de redirection à valider
 * @param urlDefaut - URL par défaut si la validation échoue
 * @returns URL validée ou URL par défaut
 */
export function validerAvecDefaut(redirectUrl: string | undefined, urlDefaut: string): string {
  if (!redirectUrl) {
    return urlDefaut;
  }

  const resultat = validerUrlRedirection(redirectUrl);
  if (!resultat.valide || !resultat.url) {
    logger.info(
      { redirectUrl, urlDefaut, erreur: resultat.erreur },
      'URL de redirection invalide, utilisation de la valeur par défaut',
    );
    return urlDefaut;
  }

  return resultat.url;
}

/**
 * Middleware Fastify pour valider le paramètre redirect_uri
 *
 * Usage:
 * ```
 * fastify.get('/callback', {
 *   preHandler: validerRedirectUri
 * }, handler);
 * ```
 */
export function creerValidateurRedirectUri(parametre: string = 'redirect_uri') {
  return (
    request: { query: Record<string, unknown> },
    reply: { status: (code: number) => { send: (body: unknown) => void } },
    done: () => void,
  ) => {
    const redirectUri = request.query[parametre] as string | undefined;

    if (redirectUri) {
      const resultat = validerUrlRedirection(redirectUri);
      if (!resultat.valide) {
        reply.status(400).send({
          erreur: 'REDIRECT_URI_INVALIDE',
          message: resultat.erreur,
        });
        return;
      }
    }

    done();
  };
}
