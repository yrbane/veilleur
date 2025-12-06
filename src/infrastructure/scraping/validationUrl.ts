/**
 * Veilleur - Validation et sanitisation des URLs
 * Protection contre les attaques SSRF (Server-Side Request Forgery)
 */

import { loggerScraping } from '../logging/logger';

/**
 * Résultat de la validation d'URL
 */
export interface ResultatValidationUrl {
  valide: boolean;
  urlNormalisee: string | null;
  erreur?: string;
}

/**
 * Plages d'adresses IP privées/réservées à bloquer
 */
const PLAGES_IP_BLOQUEES = [
  // IPv4 privées
  /^127\./,                         // Loopback
  /^10\./,                          // Classe A privée
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Classe B privée
  /^192\.168\./,                    // Classe C privée
  /^169\.254\./,                    // Link-local
  /^0\./,                           // Réseau actuel
  /^224\./,                         // Multicast
  /^255\./,                         // Broadcast

  // IPv6
  /^::1$/,                          // Loopback
  /^fe80:/i,                        // Link-local
  /^fc00:/i,                        // Unique local
  /^fd00:/i,                        // Unique local
];

/**
 * Noms d'hôtes à bloquer (métadonnées cloud, services internes)
 */
const HOTES_BLOQUES = [
  // Métadonnées cloud
  '169.254.169.254',                // AWS/GCP/Azure metadata
  'metadata.google.internal',       // GCP
  'metadata.google.com',            // GCP
  'metadata',                       // Docker
  'kubernetes',                     // K8s
  'kubernetes.default',             // K8s
  'kubernetes.default.svc',         // K8s

  // Localhost variations
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '[::1]',

  // Services internes communs
  'host.docker.internal',
  'gateway.docker.internal',
];

/**
 * Schémas d'URL autorisés
 */
const SCHEMAS_AUTORISES = ['http:', 'https:'];

/**
 * Vérifie si une adresse IP est dans une plage bloquée
 */
function estIpBloquee(ip: string): boolean {
  return PLAGES_IP_BLOQUEES.some(pattern => pattern.test(ip));
}

/**
 * Vérifie si un nom d'hôte est bloqué
 */
function estHoteBloque(hote: string): boolean {
  const hoteNormalise = hote.toLowerCase().trim();

  // Vérification exacte
  if (HOTES_BLOQUES.includes(hoteNormalise)) {
    return true;
  }

  // Vérification si c'est une IP bloquée
  if (estIpBloquee(hoteNormalise)) {
    return true;
  }

  // Bloquer les sous-domaines de localhost
  if (hoteNormalise.endsWith('.localhost') || hoteNormalise.endsWith('.local')) {
    return true;
  }

  // Bloquer les adresses .internal
  if (hoteNormalise.endsWith('.internal')) {
    return true;
  }

  return false;
}

/**
 * Vérifie si une URL contient des caractères d'échappement dangereux
 */
function contientCaracteresInterdits(url: string): boolean {
  // Caractères qui pourraient être utilisés pour contourner les filtres
  const patternsInterdits = [
    /@/,                              // Credentials dans URL
    /\\x[0-9a-f]{2}/i,               // Échappements hexadécimaux
    /\\u[0-9a-f]{4}/i,               // Échappements Unicode
    /%00/,                            // Null byte
    /%0[ad]/i,                        // CR/LF
    /[\x00-\x1f\x7f]/,               // Caractères de contrôle
  ];

  return patternsInterdits.some(pattern => pattern.test(url));
}

/**
 * Valide et normalise une URL pour le scraping
 * Bloque les URLs internes et potentiellement dangereuses
 */
export function validerUrlScraping(urlBrute: string): ResultatValidationUrl {
  // Vérifier que l'URL n'est pas vide
  if (!urlBrute || typeof urlBrute !== 'string') {
    return {
      valide: false,
      urlNormalisee: null,
      erreur: 'URL vide ou invalide',
    };
  }

  const urlNettoyee = urlBrute.trim();

  // Vérifier les caractères interdits avant le parsing
  if (contientCaracteresInterdits(urlNettoyee)) {
    loggerScraping.warn({ url: urlNettoyee }, 'URL avec caractères interdits bloquée');
    return {
      valide: false,
      urlNormalisee: null,
      erreur: 'URL contient des caractères non autorisés',
    };
  }

  // Parser l'URL
  let url: URL;
  try {
    url = new URL(urlNettoyee);
  } catch {
    return {
      valide: false,
      urlNormalisee: null,
      erreur: 'URL mal formée',
    };
  }

  // Vérifier le schéma
  if (!SCHEMAS_AUTORISES.includes(url.protocol)) {
    return {
      valide: false,
      urlNormalisee: null,
      erreur: `Protocole non autorisé: ${url.protocol}`,
    };
  }

  // Vérifier le nom d'hôte
  const hostname = url.hostname.toLowerCase();

  if (!hostname) {
    return {
      valide: false,
      urlNormalisee: null,
      erreur: 'Nom d\'hôte manquant',
    };
  }

  if (estHoteBloque(hostname)) {
    loggerScraping.warn({ url: urlNettoyee, hostname }, 'URL vers hôte bloqué rejetée (SSRF)');
    return {
      valide: false,
      urlNormalisee: null,
      erreur: 'Accès aux ressources internes non autorisé',
    };
  }

  // Vérifier les ports dangereux (non-HTTP)
  const portStr = url.port;
  if (portStr) {
    const port = parseInt(portStr, 10);
    // Autoriser uniquement les ports HTTP standards
    if (port !== 80 && port !== 443 && port !== 8080 && port !== 8443) {
      // Autoriser aussi les ports > 1024 pour les serveurs de dev
      if (port < 1024) {
        loggerScraping.warn({ url: urlNettoyee, port }, 'Port non autorisé');
        return {
          valide: false,
          urlNormalisee: null,
          erreur: `Port non autorisé: ${port}`,
        };
      }
    }
  }

  // Supprimer les credentials de l'URL
  url.username = '';
  url.password = '';

  // Normaliser l'URL
  const urlNormalisee = url.toString();

  return {
    valide: true,
    urlNormalisee,
  };
}

/**
 * Vérifie qu'une URL de redirection est sûre
 * (même domaine ou domaine autorisé)
 */
export function validerRedirection(
  urlOriginale: string,
  urlRedirection: string,
): ResultatValidationUrl {
  // D'abord valider l'URL de redirection normalement
  const resultat = validerUrlScraping(urlRedirection);
  if (!resultat.valide) {
    return resultat;
  }

  // Vérifier que la redirection reste sur un domaine proche
  try {
    const original = new URL(urlOriginale);
    const redirection = new URL(urlRedirection);

    // Autoriser même domaine ou sous-domaine
    const domaineOriginal = original.hostname.split('.').slice(-2).join('.');
    const domaineRedirection = redirection.hostname.split('.').slice(-2).join('.');

    if (domaineOriginal !== domaineRedirection) {
      loggerScraping.info(
        { urlOriginale, urlRedirection },
        'Redirection vers domaine différent (autorisée avec prudence)',
      );
    }

    return resultat;
  } catch {
    return {
      valide: false,
      urlNormalisee: null,
      erreur: 'Erreur lors de la validation de la redirection',
    };
  }
}

/**
 * Extrait et valide le domaine d'une URL
 */
export function extraireDomaine(url: string): string | null {
  const resultat = validerUrlScraping(url);
  if (!resultat.valide || !resultat.urlNormalisee) {
    return null;
  }

  try {
    const parsed = new URL(resultat.urlNormalisee);
    return parsed.hostname;
  } catch {
    return null;
  }
}
