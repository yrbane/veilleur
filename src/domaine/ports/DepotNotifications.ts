/**
 * Veilleur - Port : abonnements Web Push et destinataires des notifications
 */

export interface AbonnementPush {
  endpoint: string;
  /** Clé publique du navigateur (p256dh) */
  clePublique: string;
  /** Secret d'authentification (auth) */
  secretAuth: string;
}

export interface AbonnementPushUtilisateur {
  utilisateurId: string;
  abonnement: AbonnementPush;
}

/** Utilisateur à prévenir pour une source (notifications de la source ≠ « aucune ») */
export interface AbonneSource {
  utilisateurId: string;
  sourceId: string;
  nomSource: string;
}

export type FrequenceResume = 'quotidien' | 'hebdomadaire';

export interface DestinataireResume {
  utilisateurId: string;
  email: string;
}

export interface DepotNotifications {
  enregistrerAbonnementPush(utilisateurId: string, abonnement: AbonnementPush, userAgent?: string | null): Promise<void>;
  supprimerAbonnementPush(utilisateurId: string, endpoint: string): Promise<boolean>;
  /** Suppression après un 404/410 du service de push */
  supprimerAbonnementParEndpoint(endpoint: string): Promise<void>;
  listerAbonnementsPush(utilisateurIds: string[]): Promise<AbonnementPushUtilisateur[]>;
  compterAbonnementsPush(utilisateurId: string): Promise<number>;
  listerAbonnesSources(sourceIds: string[]): Promise<AbonneSource[]>;
  listerDestinatairesResume(frequence: FrequenceResume): Promise<DestinataireResume[]>;
}
