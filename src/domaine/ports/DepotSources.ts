/**
 * Veilleur - Port DepotSources
 * Interface pour l'accès aux données sources
 */

import type { Source, SourceUtilisateur } from '../entites/Source';
import type { ParametresSource, MiseAJourParametres } from '../entites/ParametresSource';

/**
 * Source populaire avec statistiques communautaires
 */
export interface SourcePopulaire {
  id: string;
  url: string;
  nom: string;
  typeSource: 'rss' | 'atom' | 'html';
  statut: 'active' | 'inactive' | 'erreur';
  urlFavicon?: string | null;
  nombreUtilisateurs: number;
  noteMoyenne: number | null;
  tags: { id: string; nom: string; slug: string }[];
}

/**
 * Tag populaire avec nombre de sources
 */
export interface TagPopulaire {
  id: string;
  nom: string;
  slug: string;
  nombreSources: number;
}

/**
 * Critères de recherche communautaire
 */
export interface CriteresCommunaute {
  page?: number;
  limite?: number;
  tag?: string;
  tri?: 'populaire' | 'note' | 'recent';
  recherche?: string;
}

/**
 * Critères de recherche pour les sources
 */
export interface CriteresSources {
  utilisateurId?: string;
  statut?: 'active' | 'inactive' | 'erreur' | 'toutes';
  tag?: string;
  page?: number;
  limite?: number;
}

/**
 * Résultat paginé
 */
export interface ResultatPagine<T> {
  donnees: T[];
  pagination: {
    page: number;
    limite: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Interface du dépôt sources
 */
export interface DepotSources {
  /**
   * Trouve une source par son ID
   */
  trouverParId(id: string): Promise<Source | null>;

  /**
   * Trouve une source par son hash URL
   */
  trouverParHashUrl(hashUrl: string): Promise<Source | null>;

  /**
   * Crée une nouvelle source
   */
  creer(source: Omit<Source, 'id' | 'dateCreation'>): Promise<Source>;

  /**
   * Met à jour une source
   */
  mettreAJour(id: string, donnees: Partial<Source>): Promise<Source | null>;

  /**
   * Supprime une source (si plus aucun utilisateur ne la suit)
   */
  supprimer(id: string): Promise<boolean>;

  /**
   * Liste les sources d'un utilisateur
   */
  listerPourUtilisateur(
    utilisateurId: string,
    criteres?: CriteresSources,
  ): Promise<ResultatPagine<SourceUtilisateur>>;

  /**
   * Ajoute une source à un utilisateur
   */
  ajouterPourUtilisateur(utilisateurId: string, sourceId: string): Promise<SourceUtilisateur>;

  /**
   * Retire une source d'un utilisateur
   */
  retirerPourUtilisateur(utilisateurId: string, sourceId: string): Promise<boolean>;

  /**
   * Vérifie si un utilisateur suit une source
   */
  utilisateurSuitSource(utilisateurId: string, sourceId: string): Promise<boolean>;

  /**
   * Met à jour la note d'une source pour un utilisateur
   */
  noterSource(utilisateurId: string, sourceId: string, note: number | null): Promise<boolean>;

  /**
   * Met en pause/réactive une source pour un utilisateur
   */
  basculerPause(utilisateurId: string, sourceId: string, estEnPause: boolean): Promise<boolean>;

  /**
   * Incrémente le compteur d'échecs d'une source
   */
  incrementerEchecs(id: string): Promise<number>;

  /**
   * Réinitialise le compteur d'échecs d'une source
   */
  reinitialiserEchecs(id: string): Promise<void>;

  /**
   * Liste les sources à rafraîchir
   */
  listerSourcesARafraichir(limite?: number): Promise<Source[]>;

  /**
   * Compte le nombre de sources d'un utilisateur
   */
  compterSourcesUtilisateur(utilisateurId: string): Promise<number>;

  /**
   * Liste les sources populaires de la communauté
   */
  listerSourcesPopulaires(
    criteres: CriteresCommunaute,
  ): Promise<ResultatPagine<SourcePopulaire>>;

  /**
   * Liste les tags populaires
   */
  listerTagsPopulaires(limite?: number): Promise<TagPopulaire[]>;
}

/**
 * Interface du dépôt paramètres sources
 */
export interface DepotParametresSources {
  /**
   * Trouve les paramètres d'une source utilisateur
   */
  trouverParUtilisateurSource(utilisateurSourceId: string): Promise<ParametresSource | null>;

  /**
   * Crée les paramètres par défaut
   */
  creerDefaut(utilisateurSourceId: string): Promise<ParametresSource>;

  /**
   * Met à jour les paramètres
   */
  mettreAJour(
    utilisateurSourceId: string,
    donnees: MiseAJourParametres,
  ): Promise<ParametresSource | null>;

  /**
   * Réinitialise les paramètres aux valeurs par défaut
   */
  reinitialiser(utilisateurSourceId: string): Promise<ParametresSource | null>;
}
