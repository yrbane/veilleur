/**
 * Veilleur - Port : demandes de réinitialisation de mot de passe (mot de passe oublié)
 * Seul le hachage SHA-256 du jeton envoyé par courriel est conservé.
 */

export interface DemandeReinitialisation {
  id: string;
  utilisateurId: string;
  tokenHash: string;
  dateExpiration: Date;
  /** Posée à l'utilisation du lien ou à son invalidation par une nouvelle demande */
  dateUtilisation: Date | null;
}

export interface DepotReinitialisationsMotDePasse {
  creer(demande: Omit<DemandeReinitialisation, 'id' | 'dateUtilisation'>): Promise<void>;

  trouverParTokenHash(tokenHash: string): Promise<DemandeReinitialisation | null>;

  /** Consomme le lien : il ne pourra plus servir */
  marquerUtilisee(id: string): Promise<boolean>;

  /** Invalide les demandes encore ouvertes d'un compte (nouvelle demande, mot de passe changé) */
  invaliderPourUtilisateur(utilisateurId: string): Promise<number>;

}
