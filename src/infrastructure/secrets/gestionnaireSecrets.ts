/**
 * Veilleur - Gestionnaire de secrets
 * Support pour la rotation des secrets JWT et HMAC
 *
 * Permet d'utiliser plusieurs secrets en parallèle pendant une rotation
 * pour éviter les interruptions de service.
 */

import { logger } from '@/infrastructure/logging/logger';

/**
 * Configuration d'un secret
 */
export interface ConfigSecret {
  // Identifiant unique du secret
  id: string;
  // Valeur du secret
  valeur: string;
  // Date de création
  dateCreation: Date;
  // Date d'expiration (après laquelle le secret n'est plus valide)
  dateExpiration?: Date;
  // Indique si ce secret est le secret principal (pour la signature)
  estPrincipal: boolean;
}

/**
 * Résultat de la rotation
 */
export interface ResultatRotation {
  ancienId: string;
  nouveauId: string;
  dateRotation: Date;
}

/**
 * Gestionnaire de secrets avec support de rotation
 * Permet de maintenir plusieurs secrets actifs simultanément
 */
export class GestionnaireSecrets {
  private secrets = new Map<string, ConfigSecret>();
  private nomSecret: string;

  constructor(nomSecret: string) {
    this.nomSecret = nomSecret;
  }

  /**
   * Ajoute un secret
   */
  ajouterSecret(config: Omit<ConfigSecret, 'dateCreation'>): void {
    const secret: ConfigSecret = {
      ...config,
      dateCreation: new Date(),
    };

    this.secrets.set(config.id, secret);

    // Si c'est le principal, retirer le flag des autres
    if (config.estPrincipal) {
      for (const [id, s] of this.secrets) {
        if (id !== config.id) {
          s.estPrincipal = false;
        }
      }
    }

    logger.info(
      { nomSecret: this.nomSecret, secretId: config.id, estPrincipal: config.estPrincipal },
      'Secret ajouté',
    );
  }

  /**
   * Récupère le secret principal (pour la signature/création)
   */
  obtenirSecretPrincipal(): ConfigSecret | null {
    for (const secret of this.secrets.values()) {
      if (secret.estPrincipal && this.estValide(secret)) {
        return secret;
      }
    }

    // Si pas de principal, retourner le plus récent valide
    let plusRecent: ConfigSecret | null = null;
    for (const secret of this.secrets.values()) {
      if (this.estValide(secret)) {
        if (!plusRecent || secret.dateCreation > plusRecent.dateCreation) {
          plusRecent = secret;
        }
      }
    }

    return plusRecent;
  }

  /**
   * Récupère tous les secrets valides (pour la vérification)
   * Retourne les secrets du plus récent au plus ancien
   */
  obtenirSecretsValides(): ConfigSecret[] {
    const valides: ConfigSecret[] = [];

    for (const secret of this.secrets.values()) {
      if (this.estValide(secret)) {
        valides.push(secret);
      }
    }

    // Trier par date de création décroissante
    valides.sort((a, b) => b.dateCreation.getTime() - a.dateCreation.getTime());

    return valides;
  }

  /**
   * Vérifie une valeur avec tous les secrets valides
   * Utile pour la vérification de signature/token pendant une rotation
   */
  async verifierAvecTousSecrets<T>(
    verifier: (secret: string) => Promise<T | null>,
  ): Promise<{ resultat: T; secretId: string } | null> {
    const secrets = this.obtenirSecretsValides();

    for (const secret of secrets) {
      try {
        const resultat = await verifier(secret.valeur);
        if (resultat !== null) {
          return { resultat, secretId: secret.id };
        }
      } catch {
        // Continuer avec le secret suivant
      }
    }

    return null;
  }

  /**
   * Effectue une rotation du secret principal
   *
   * @param nouveauSecret - Nouveau secret
   * @param dureeTransition - Durée pendant laquelle l'ancien secret reste valide (en ms)
   */
  effectuerRotation(
    nouveauSecret: Omit<ConfigSecret, 'dateCreation' | 'estPrincipal'>,
    dureeTransition: number = 24 * 60 * 60 * 1000, // 24h par défaut
  ): ResultatRotation {
    const ancienPrincipal = this.obtenirSecretPrincipal();

    // Ajouter le nouveau secret comme principal
    this.ajouterSecret({
      ...nouveauSecret,
      estPrincipal: true,
    });

    // Mettre à jour l'ancien secret avec une date d'expiration
    if (ancienPrincipal) {
      ancienPrincipal.estPrincipal = false;
      ancienPrincipal.dateExpiration = new Date(Date.now() + dureeTransition);

      logger.info(
        {
          nomSecret: this.nomSecret,
          ancienId: ancienPrincipal.id,
          nouveauId: nouveauSecret.id,
          expirationAncien: ancienPrincipal.dateExpiration,
        },
        'Rotation de secret effectuée',
      );
    }

    return {
      ancienId: ancienPrincipal?.id ?? '',
      nouveauId: nouveauSecret.id,
      dateRotation: new Date(),
    };
  }

  /**
   * Supprime les secrets expirés
   */
  nettoyerSecretsExpires(): number {
    let supprimés = 0;

    for (const [id, secret] of this.secrets) {
      if (!this.estValide(secret)) {
        this.secrets.delete(id);
        supprimés++;
        logger.info(
          { nomSecret: this.nomSecret, secretId: id },
          'Secret expiré supprimé',
        );
      }
    }

    return supprimés;
  }

  /**
   * Vérifie si un secret est valide
   */
  private estValide(secret: ConfigSecret): boolean {
    if (secret.dateExpiration && secret.dateExpiration < new Date()) {
      return false;
    }
    return true;
  }

  /**
   * Retourne les statistiques des secrets
   */
  obtenirStatistiques(): {
    total: number;
    valides: number;
    expires: number;
    principal: string | null;
  } {
    let valides = 0;
    let expires = 0;
    let principal: string | null = null;

    for (const [id, secret] of this.secrets) {
      if (this.estValide(secret)) {
        valides++;
        if (secret.estPrincipal) {
          principal = id;
        }
      } else {
        expires++;
      }
    }

    return {
      total: this.secrets.size,
      valides,
      expires,
      principal,
    };
  }
}

/**
 * Gestionnaire global pour les secrets JWT
 */
export const gestionnaireSecretsJwt = new GestionnaireSecrets('jwt');

/**
 * Gestionnaire global pour les secrets de refresh token
 */
export const gestionnaireSecretsRefresh = new GestionnaireSecrets('jwt-refresh');

/**
 * Gestionnaire global pour les secrets HMAC API
 */
export const gestionnaireSecretsHmac = new GestionnaireSecrets('hmac-api');

/**
 * Initialise les secrets depuis les variables d'environnement
 */
export function initialiserSecrets(env: {
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  API_HMAC_SECRET?: string;
}): void {
  // Initialiser le secret JWT
  gestionnaireSecretsJwt.ajouterSecret({
    id: 'jwt-initial',
    valeur: env.JWT_SECRET,
    estPrincipal: true,
  });

  // Initialiser le secret de refresh
  gestionnaireSecretsRefresh.ajouterSecret({
    id: 'refresh-initial',
    valeur: env.JWT_REFRESH_SECRET,
    estPrincipal: true,
  });

  // Initialiser le secret HMAC si présent
  if (env.API_HMAC_SECRET) {
    gestionnaireSecretsHmac.ajouterSecret({
      id: 'hmac-initial',
      valeur: env.API_HMAC_SECRET,
      estPrincipal: true,
    });
  }

  logger.info('Gestionnaires de secrets initialisés');
}

/**
 * Planifie le nettoyage automatique des secrets expirés
 *
 * @param intervalleMs - Intervalle de nettoyage en millisecondes
 */
export function planifierNettoyageSecrets(intervalleMs: number = 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(() => {
    gestionnaireSecretsJwt.nettoyerSecretsExpires();
    gestionnaireSecretsRefresh.nettoyerSecretsExpires();
    gestionnaireSecretsHmac.nettoyerSecretsExpires();
  }, intervalleMs);
}
