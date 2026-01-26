/**
 * Veilleur - Port DepotUtilisateurs
 * Interface pour l'accès aux données utilisateurs
 */

import type { Utilisateur } from '../entites/Utilisateur';

/**
 * Interface du dépôt utilisateurs
 */
export interface DepotUtilisateurs {
  /**
   * Trouve un utilisateur par son ID
   */
  trouverParId(id: string): Promise<Utilisateur | null>;

  /**
   * Trouve un utilisateur par son email
   */
  trouverParEmail(email: string): Promise<Utilisateur | null>;

  /**
   * Crée un nouvel utilisateur
   */
  creer(utilisateur: Omit<Utilisateur, 'id' | 'dateCreation'>): Promise<Utilisateur>;

  /**
   * Met à jour un utilisateur
   */
  mettreAJour(id: string, donnees: Partial<Utilisateur>): Promise<Utilisateur | null>;

  /**
   * Vérifie si un email existe déjà
   */
  emailExiste(email: string): Promise<boolean>;

  /**
   * Met à jour la date de dernière connexion
   */
  mettreAJourDerniereConnexion(id: string): Promise<void>;

  /**
   * Désactive un compte utilisateur
   */
  desactiver(id: string): Promise<boolean>;
}

/**
 * Interface pour la gestion des refresh tokens
 */
export interface DepotRefreshTokens {
  /**
   * Crée un nouveau refresh token
   */
  creer(utilisateurId: string, token: string, dateExpiration: Date): Promise<void>;

  /**
   * Trouve un refresh token valide
   */
  trouverTokenValide(token: string): Promise<{ utilisateurId: string } | null>;

  /**
   * Révoque un refresh token
   */
  revoquer(token: string): Promise<boolean>;

  /**
   * Révoque tous les tokens d'un utilisateur
   */
  revoquerTousTokensUtilisateur(utilisateurId: string): Promise<number>;

  /**
   * Nettoie les tokens expirés
   */
  nettoyerTokensExpires(): Promise<number>;
}
