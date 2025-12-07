/**
 * Veilleur - Pagination Keyset (cursor-based) générique
 * Pagination performante pour grandes collections sans offset
 *
 * Avantages vs offset:
 * - Performance constante O(1) vs O(n) pour offset
 * - Résultats cohérents lors d'ajouts/suppressions
 * - Idéal pour scroll infini et temps réel
 *
 * Utilisation:
 * - Listes d'articles (par date)
 * - Historique d'activité
 * - Logs et événements
 * - Résultats de recherche ordonnés
 */

/**
 * Direction de la pagination
 */
export type DirectionPagination = 'suivant' | 'precedent';

/**
 * Paramètres de requête pour pagination keyset
 */
export interface ParamsPaginationKeyset {
  // Curseur encodé (base64 de la position)
  curseur?: string;
  // Nombre d'éléments à récupérer
  limite?: number;
  // Direction de pagination
  direction?: DirectionPagination;
}

/**
 * Valeur du curseur décodé
 */
export interface ValeurCurseur {
  // Champs de tri avec leurs valeurs
  champs: Record<string, unknown>;
  // ID pour désambiguïsation si valeurs identiques
  id: string;
  // Timestamp de création du curseur
  timestamp: number;
}

/**
 * Résultat de pagination keyset
 */
export interface ResultatPaginationKeyset<T> {
  // Données de la page
  donnees: T[];
  // Métadonnées de pagination
  pagination: {
    // Curseur pour la page suivante (null si fin)
    curseurSuivant: string | null;
    // Curseur pour la page précédente (null si début)
    curseurPrecedent: string | null;
    // Nombre d'éléments retournés
    nombreElements: number;
    // Limite demandée
    limite: number;
    // Y a-t-il plus d'éléments ?
    aPlus: boolean;
  };
}

/**
 * Configuration de la pagination
 */
export interface ConfigPaginationKeyset<T> {
  // Limite par défaut
  limiteDefaut?: number;
  // Limite maximale
  limiteMax?: number;
  // Champs de tri (ordre de priorité)
  champsTri: Array<{
    champ: keyof T & string;
    direction: 'asc' | 'desc';
  }>;
  // Champ d'ID unique pour désambiguïsation
  champId: keyof T & string;
}

const CONFIG_DEFAUT = {
  limiteDefaut: 20,
  limiteMax: 100,
};

/**
 * Encode un curseur en base64
 */
export function encoderCurseur(valeur: ValeurCurseur): string {
  const json = JSON.stringify(valeur);
  // Utiliser base64url pour URL-safe
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Décode un curseur base64
 */
export function decoderCurseur(curseur: string): ValeurCurseur | null {
  try {
    // Restaurer le base64 standard
    let base64 = curseur.replace(/-/g, '+').replace(/_/g, '/');
    // Ajouter le padding si nécessaire
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json) as ValeurCurseur;
  } catch {
    return null;
  }
}

/**
 * Crée un curseur à partir d'un élément
 */
export function creerCurseur<T extends Record<string, unknown>>(
  element: T,
  config: ConfigPaginationKeyset<T>,
): string {
  const champs: Record<string, unknown> = {};

  for (const { champ } of config.champsTri) {
    champs[champ] = element[champ];
  }

  const valeur: ValeurCurseur = {
    champs,
    id: String(element[config.champId]),
    timestamp: Date.now(),
  };

  return encoderCurseur(valeur);
}

/**
 * Génère les conditions WHERE pour Drizzle ORM
 * Retourne un objet décrivant les conditions à appliquer
 */
export interface ConditionsCurseur {
  // Type de condition (pour le premier champ de tri)
  comparaison: 'gt' | 'lt' | 'gte' | 'lte';
  // Valeurs des champs de tri
  valeurs: Record<string, unknown>;
  // ID pour désambiguïsation
  id: string;
}

export function genererConditionsCurseur<T>(
  curseur: ValeurCurseur,
  config: ConfigPaginationKeyset<T>,
  direction: DirectionPagination = 'suivant',
): ConditionsCurseur {
  const premierChamp = config.champsTri[0];
  if (!premierChamp) {
    throw new Error('Au moins un champ de tri est requis');
  }

  const estAscendant = premierChamp.direction === 'asc';
  const estSuivant = direction === 'suivant';

  // Détermine la comparaison selon direction du tri et de pagination
  // asc + suivant = gt (plus grand que le curseur)
  // asc + precedent = lt (plus petit que le curseur)
  // desc + suivant = lt (plus petit que le curseur)
  // desc + precedent = gt (plus grand que le curseur)
  const comparaison: 'gt' | 'lt' =
    (estAscendant && estSuivant) || (!estAscendant && !estSuivant) ? 'gt' : 'lt';

  return {
    comparaison,
    valeurs: curseur.champs,
    id: curseur.id,
  };
}

/**
 * Applique la pagination à un tableau en mémoire
 * Utile pour les tests ou petites collections
 */
export function appliquerPaginationEnMemoire<T extends Record<string, unknown>>(
  donnees: T[],
  params: ParamsPaginationKeyset,
  config: ConfigPaginationKeyset<T>,
): ResultatPaginationKeyset<T> {
  const limite = Math.min(
    params.limite ?? CONFIG_DEFAUT.limiteDefaut,
    config.limiteMax ?? CONFIG_DEFAUT.limiteMax,
  );

  let resultat = [...donnees];

  // Appliquer le tri
  resultat.sort((a, b) => {
    for (const { champ, direction } of config.champsTri) {
      const valA = a[champ];
      const valB = b[champ];

      let comparison = 0;
      if (valA < valB) comparison = -1;
      else if (valA > valB) comparison = 1;

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }

    // Désambiguïsation par ID
    const idA = String(a[config.champId]);
    const idB = String(b[config.champId]);
    return idA.localeCompare(idB);
  });

  // Appliquer le curseur si présent
  if (params.curseur) {
    const valeurCurseur = decoderCurseur(params.curseur);
    if (valeurCurseur) {
      const index = resultat.findIndex(item => {
        // Trouver l'élément correspondant au curseur
        for (const { champ } of config.champsTri) {
          if (item[champ] !== valeurCurseur.champs[champ]) {
            return false;
          }
        }
        return String(item[config.champId]) === valeurCurseur.id;
      });

      if (index !== -1) {
        if (params.direction === 'precedent') {
          resultat = resultat.slice(0, index);
        } else {
          resultat = resultat.slice(index + 1);
        }
      }
    }
  }

  // Limiter les résultats (+1 pour savoir s'il y a plus)
  const donneesPage = resultat.slice(0, limite + 1);
  const aPlus = donneesPage.length > limite;

  if (aPlus) {
    donneesPage.pop();
  }

  // Générer les curseurs
  const curseurSuivant = aPlus && donneesPage.length > 0
    ? creerCurseur(donneesPage[donneesPage.length - 1]!, config)
    : null;

  const curseurPrecedent = params.curseur && donneesPage.length > 0
    ? creerCurseur(donneesPage[0]!, config)
    : null;

  return {
    donnees: donneesPage,
    pagination: {
      curseurSuivant,
      curseurPrecedent,
      nombreElements: donneesPage.length,
      limite,
      aPlus,
    },
  };
}

/**
 * Valide et normalise les paramètres de pagination
 */
export function validerParamsPagination(
  params: ParamsPaginationKeyset,
  config: { limiteDefaut?: number; limiteMax?: number } = {},
): ParamsPaginationKeyset {
  const limiteDefaut = config.limiteDefaut ?? CONFIG_DEFAUT.limiteDefaut;
  const limiteMax = config.limiteMax ?? CONFIG_DEFAUT.limiteMax;

  return {
    curseur: params.curseur,
    limite: Math.min(Math.max(1, params.limite ?? limiteDefaut), limiteMax),
    direction: params.direction ?? 'suivant',
  };
}

/**
 * Extrait les paramètres de pagination d'une query string
 */
export function extraireParamsPagination(
  query: Record<string, string | string[] | undefined>,
): ParamsPaginationKeyset {
  const curseur = typeof query.curseur === 'string' ? query.curseur : undefined;
  const limiteStr = typeof query.limite === 'string' ? query.limite : undefined;
  const directionStr = typeof query.direction === 'string' ? query.direction : undefined;

  return {
    curseur,
    limite: limiteStr ? parseInt(limiteStr, 10) : undefined,
    direction: directionStr === 'precedent' ? 'precedent' : 'suivant',
  };
}

/**
 * Génère les headers HTTP pour la pagination
 */
export function genererHeadersPagination(
  pagination: ResultatPaginationKeyset<unknown>['pagination'],
  baseUrl: string,
): Record<string, string> {
  const links: string[] = [];

  if (pagination.curseurSuivant) {
    const url = `${baseUrl}?curseur=${encodeURIComponent(pagination.curseurSuivant)}`;
    links.push(`<${url}>; rel="next"`);
  }

  if (pagination.curseurPrecedent) {
    const url = `${baseUrl}?curseur=${encodeURIComponent(pagination.curseurPrecedent)}&direction=precedent`;
    links.push(`<${url}>; rel="prev"`);
  }

  return {
    'X-Pagination-Count': String(pagination.nombreElements),
    'X-Pagination-Limit': String(pagination.limite),
    'X-Has-More': String(pagination.aPlus),
    ...(links.length > 0 ? { Link: links.join(', ') } : {}),
  };
}

/**
 * Helper pour créer une configuration de pagination
 */
export function creerConfigPagination<T extends Record<string, unknown>>(
  options: ConfigPaginationKeyset<T>,
): ConfigPaginationKeyset<T> {
  return {
    limiteDefaut: CONFIG_DEFAUT.limiteDefaut,
    limiteMax: CONFIG_DEFAUT.limiteMax,
    ...options,
  };
}

/**
 * Type utilitaire pour extraire le type de données d'un résultat
 */
export type DonneesDeResultat<R> = R extends ResultatPaginationKeyset<infer T> ? T : never;

/**
 * Configurations pré-définies pour les entités communes
 */
export const CONFIGS_PAGINATION = {
  articles: creerConfigPagination<{
    id: string;
    dateExtraction: Date;
    titre: string;
  }>({
    champsTri: [
      { champ: 'dateExtraction', direction: 'desc' },
    ],
    champId: 'id',
  }),

  sources: creerConfigPagination<{
    id: string;
    dateAjout: Date;
    titre: string;
  }>({
    champsTri: [
      { champ: 'dateAjout', direction: 'desc' },
    ],
    champId: 'id',
  }),

  activites: creerConfigPagination<{
    id: string;
    timestamp: Date;
  }>({
    champsTri: [
      { champ: 'timestamp', direction: 'desc' },
    ],
    champId: 'id',
    limiteDefaut: 50,
    limiteMax: 200,
  }),
};
