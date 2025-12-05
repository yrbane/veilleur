/**
 * Veilleur - Port DepotArticles
 * Interface pour l'accès aux données articles
 */

import type { Article, ArticleAvecSource } from '../entites/Article';

/**
 * Critères de recherche pour les articles
 */
export interface CriteresArticles {
  utilisateurId?: string;
  sourceId?: string;
  tag?: string;
  depuis?: Date;
  page?: number;
  limite?: number;
}

/**
 * Résultat paginé d'articles
 */
export interface ResultatPagineArticles {
  donnees: ArticleAvecSource[];
  pagination: {
    page: number;
    limite: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Interface du dépôt articles
 */
export interface DepotArticles {
  /**
   * Trouve un article par son ID
   */
  trouverParId(id: string): Promise<Article | null>;

  /**
   * Trouve un article par son hash de contenu
   */
  trouverParHashContenu(hashContenu: string): Promise<Article | null>;

  /**
   * Crée un nouvel article
   */
  creer(article: Omit<Article, 'id' | 'dateExtraction'>): Promise<Article>;

  /**
   * Crée plusieurs articles en une fois
   */
  creerPlusieurs(articles: Omit<Article, 'id' | 'dateExtraction'>[]): Promise<Article[]>;

  /**
   * Met à jour un article
   */
  mettreAJour(id: string, donnees: Partial<Article>): Promise<Article | null>;

  /**
   * Supprime les articles d'une source
   */
  supprimerParSource(sourceId: string): Promise<number>;

  /**
   * Supprime les articles plus anciens que la date donnée
   */
  supprimerAnciens(avantDate: Date): Promise<number>;

  /**
   * Liste les articles pour le fil d'un utilisateur
   */
  listerFilUtilisateur(
    utilisateurId: string,
    criteres?: CriteresArticles,
  ): Promise<ResultatPagineArticles>;

  /**
   * Liste les articles d'une source
   */
  listerParSource(sourceId: string, limite?: number): Promise<Article[]>;

  /**
   * Compte les articles d'une source
   */
  compterParSource(sourceId: string): Promise<number>;

  /**
   * Vérifie si un article existe déjà (par hash)
   */
  articleExiste(hashContenu: string): Promise<boolean>;

  /**
   * Trouve les doublons potentiels par similarité de titre
   */
  trouverDoublonsPotentiels(
    titre: string,
    sourceId: string,
    seuilSimilarite?: number,
  ): Promise<Article[]>;
}

/**
 * Interface pour le cache d'articles
 */
export interface CacheArticles {
  /**
   * Récupère les articles d'une source depuis le cache
   */
  obtenir(sourceId: string): Promise<Article[] | null>;

  /**
   * Stocke les articles d'une source dans le cache
   */
  stocker(sourceId: string, articles: Article[], ttlSecondes?: number): Promise<void>;

  /**
   * Invalide le cache d'une source
   */
  invalider(sourceId: string): Promise<void>;

  /**
   * Vérifie si le cache d'une source est valide
   */
  estValide(sourceId: string): Promise<boolean>;
}
