/**
 * Veilleur - Pagination par curseur
 * Alternative performante à la pagination offset pour les grandes listes
 *
 * La pagination par curseur est plus efficace car elle n'a pas besoin
 * de compter tous les enregistrements et utilise directement les index.
 */

/**
 * Direction de la pagination
 */
export type DirectionPagination = 'avant' | 'apres';

/**
 * Critères de pagination par curseur
 */
export interface CriteresPaginationCurseur {
  // Curseur pour la position actuelle (optionnel pour la première page)
  curseur?: string;
  // Direction de la pagination (avant = plus ancien, après = plus récent)
  direction?: DirectionPagination;
  // Nombre d'éléments par page
  limite?: number;
  // Champ de tri (par défaut: datePublication)
  champTri?: string;
  // Ordre de tri (par défaut: desc)
  ordreTri?: 'asc' | 'desc';
}

/**
 * Résultat de pagination par curseur
 */
export interface ResultatPaginationCurseur<T> {
  donnees: T[];
  curseurs: {
    debut: string | null;
    fin: string | null;
    suivant: string | null;
    precedent: string | null;
  };
  aPlus: {
    avant: boolean;
    apres: boolean;
  };
  meta: {
    limite: number;
    direction: DirectionPagination;
    champTri: string;
    ordreTri: 'asc' | 'desc';
  };
}

/**
 * Configuration par défaut de la pagination
 */
const CONFIG_PAGINATION = {
  limiteDefaut: 20,
  limiteMax: 100,
  champTriDefaut: 'datePublication',
  ordreTriDefaut: 'desc' as const,
  directionDefaut: 'apres' as DirectionPagination,
};

/**
 * Données encodées dans un curseur
 */
interface DonneesCurseur {
  id: string;
  valeurTri: string | number | Date;
  timestamp: number;
}

/**
 * Encode un curseur à partir d'un élément
 */
export function encoderCurseur<T extends { id: string }>(
  element: T,
  champTri: string,
): string {
  const valeurTri = (element as Record<string, unknown>)[champTri];

  const donnees: DonneesCurseur = {
    id: element.id,
    valeurTri: valeurTri instanceof Date ? valeurTri.toISOString() : valeurTri as string | number,
    timestamp: Date.now(),
  };

  // Encodage base64 URL-safe
  const json = JSON.stringify(donnees);
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Décode un curseur
 */
export function decoderCurseur(curseur: string): DonneesCurseur | null {
  try {
    const json = Buffer.from(curseur, 'base64url').toString('utf8');
    const donnees = JSON.parse(json) as DonneesCurseur;

    // Valider les données requises
    if (!donnees.id || donnees.valeurTri === undefined) {
      return null;
    }

    return donnees;
  } catch {
    return null;
  }
}

/**
 * Normalise les critères de pagination
 */
export function normaliserCriteres(
  criteres?: CriteresPaginationCurseur,
): Required<CriteresPaginationCurseur> {
  const limite = Math.min(
    criteres?.limite ?? CONFIG_PAGINATION.limiteDefaut,
    CONFIG_PAGINATION.limiteMax,
  );

  return {
    curseur: criteres?.curseur ?? '',
    direction: criteres?.direction ?? CONFIG_PAGINATION.directionDefaut,
    limite,
    champTri: criteres?.champTri ?? CONFIG_PAGINATION.champTriDefaut,
    ordreTri: criteres?.ordreTri ?? CONFIG_PAGINATION.ordreTriDefaut,
  };
}

/**
 * Génère les conditions WHERE pour une requête paginée par curseur
 *
 * @param champTri - Nom du champ de tri
 * @param curseur - Données du curseur décodées
 * @param direction - Direction de la pagination
 * @param ordreTri - Ordre de tri
 * @returns Objet avec la condition SQL et les paramètres
 */
export function genererConditionsCurseur(
  champTri: string,
  curseur: DonneesCurseur | null,
  direction: DirectionPagination,
  ordreTri: 'asc' | 'desc',
): {
  condition: string;
  parametres: Record<string, unknown>;
} {
  if (!curseur) {
    return { condition: '', parametres: {} };
  }

  // Déterminer l'opérateur selon la direction et l'ordre
  // Pour desc + après = <, desc + avant = >
  // Pour asc + après = >, asc + avant = <
  let operateur: '<' | '>';
  if (ordreTri === 'desc') {
    operateur = direction === 'apres' ? '<' : '>';
  } else {
    operateur = direction === 'apres' ? '>' : '<';
  }

  // Condition composée: (champTri < valeur) OR (champTri = valeur AND id < id)
  // Cela garantit un ordre stable même avec des valeurs de tri identiques
  const condition = `(${champTri} ${operateur} :valeurTri OR (${champTri} = :valeurTri AND id ${operateur} :curseurId))`;

  return {
    condition,
    parametres: {
      valeurTri: curseur.valeurTri,
      curseurId: curseur.id,
    },
  };
}

/**
 * Construit un résultat de pagination par curseur
 */
export function construireResultatPaginationCurseur<T extends { id: string }>(
  donnees: T[],
  criteres: Required<CriteresPaginationCurseur>,
  aPlus: { avant: boolean; apres: boolean },
): ResultatPaginationCurseur<T> {
  const premier = donnees[0];
  const dernier = donnees[donnees.length - 1];

  const curseurDebut = premier ? encoderCurseur(premier, criteres.champTri) : null;
  const curseurFin = dernier ? encoderCurseur(dernier, criteres.champTri) : null;

  // Les curseurs suivant/précédent dépendent de la direction actuelle
  let curseurSuivant: string | null = null;
  let curseurPrecedent: string | null = null;

  if (criteres.direction === 'apres') {
    curseurSuivant = aPlus.apres ? curseurFin : null;
    curseurPrecedent = aPlus.avant ? curseurDebut : null;
  } else {
    curseurSuivant = aPlus.avant ? curseurDebut : null;
    curseurPrecedent = aPlus.apres ? curseurFin : null;
  }

  return {
    donnees,
    curseurs: {
      debut: curseurDebut,
      fin: curseurFin,
      suivant: curseurSuivant,
      precedent: curseurPrecedent,
    },
    aPlus,
    meta: {
      limite: criteres.limite,
      direction: criteres.direction,
      champTri: criteres.champTri,
      ordreTri: criteres.ordreTri,
    },
  };
}

/**
 * Interface pour un helper de pagination Drizzle/Prisma
 */
export interface HelperPaginationCurseur<T> {
  /**
   * Exécute une requête paginée par curseur
   */
  paginer(
    criteres?: CriteresPaginationCurseur,
  ): Promise<ResultatPaginationCurseur<T>>;
}

/**
 * Crée un helper de pagination pour une requête Drizzle
 *
 * @example
 * ```typescript
 * const helper = creerHelperPaginationDrizzle(
 *   db,
 *   articles,
 *   { sourceId: sourceId },
 * );
 *
 * const resultat = await helper.paginer({ limite: 20 });
 * ```
 */
export function creerBuilderPaginationCurseur<T extends { id: string }>(
  executerRequete: (options: {
    where?: string;
    parametres?: Record<string, unknown>;
    orderBy: string;
    limite: number;
  }) => Promise<T[]>,
  compterAvant: (curseur: DonneesCurseur) => Promise<boolean>,
  compterApres: (curseur: DonneesCurseur) => Promise<boolean>,
): HelperPaginationCurseur<T> {
  return {
    async paginer(criteres?: CriteresPaginationCurseur): Promise<ResultatPaginationCurseur<T>> {
      const criteresNormalises = normaliserCriteres(criteres);
      const curseurDecode = criteresNormalises.curseur
        ? decoderCurseur(criteresNormalises.curseur)
        : null;

      // Générer les conditions du curseur
      const { condition, parametres } = genererConditionsCurseur(
        criteresNormalises.champTri,
        curseurDecode,
        criteresNormalises.direction,
        criteresNormalises.ordreTri,
      );

      // Construire l'ordre de tri
      const orderBy = `${criteresNormalises.champTri} ${criteresNormalises.ordreTri.toUpperCase()}, id ${criteresNormalises.ordreTri.toUpperCase()}`;

      // Exécuter la requête avec un élément supplémentaire pour détecter s'il y en a plus
      const donnees = await executerRequete({
        where: condition,
        parametres,
        orderBy,
        limite: criteresNormalises.limite + 1,
      });

      // Vérifier s'il y a plus d'éléments dans la direction actuelle
      const aPlusDirection = donnees.length > criteresNormalises.limite;
      const donneesFinales = aPlusDirection
        ? donnees.slice(0, criteresNormalises.limite)
        : donnees;

      // Vérifier s'il y a des éléments dans l'autre direction
      let aPlus = { avant: false, apres: false };

      if (curseurDecode) {
        // Si on a un curseur, vérifier les deux directions
        const [avant, apres] = await Promise.all([
          compterAvant(curseurDecode),
          compterApres(curseurDecode),
        ]);
        aPlus = { avant, apres };

        // Ajuster selon la direction actuelle
        if (criteresNormalises.direction === 'apres') {
          aPlus.apres = aPlusDirection;
        } else {
          aPlus.avant = aPlusDirection;
        }
      } else {
        // Première page
        if (criteresNormalises.direction === 'apres') {
          aPlus.apres = aPlusDirection;
          aPlus.avant = false;
        } else {
          aPlus.avant = aPlusDirection;
          aPlus.apres = false;
        }
      }

      return construireResultatPaginationCurseur(donneesFinales, criteresNormalises, aPlus);
    },
  };
}

/**
 * Utilitaires pour les curseurs
 */
export const curseurUtils = {
  /**
   * Vérifie si un curseur est valide
   */
  estValide(curseur: string): boolean {
    return decoderCurseur(curseur) !== null;
  },

  /**
   * Extrait l'ID d'un curseur
   */
  extraireId(curseur: string): string | null {
    const donnees = decoderCurseur(curseur);
    return donnees?.id ?? null;
  },

  /**
   * Vérifie si un curseur est expiré (optionnel, pour invalidation)
   */
  estExpire(curseur: string, maxAgeMs: number = 3600000): boolean {
    const donnees = decoderCurseur(curseur);
    if (!donnees) return true;
    return Date.now() - donnees.timestamp > maxAgeMs;
  },

  /**
   * Crée un curseur manuel pour un ID et une valeur de tri
   */
  creerManuel(id: string, valeurTri: string | number | Date): string {
    const donnees: DonneesCurseur = {
      id,
      valeurTri: valeurTri instanceof Date ? valeurTri.toISOString() : valeurTri,
      timestamp: Date.now(),
    };
    return Buffer.from(JSON.stringify(donnees), 'utf8').toString('base64url');
  },
};
