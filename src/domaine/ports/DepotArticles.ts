/**
 * Veilleur - Port DepotArticles
 * Interface pour l'accès aux données articles
 */

import type { Article, ArticleAvecSource, TriArticles, OrdreTri, MotCleFil } from '../entites/Article';

/**
 * Critères de recherche pour les articles
 */
export interface CriteresArticles {
  utilisateurId?: string;
  sourceId?: string;
  tag?: string;
  depuis?: Date;
  // Recherche full-text
  recherche?: string;
  // Pagination offset (legacy)
  page?: number;
  limite?: number;
  // Pagination curseur (nouvelle)
  curseur?: string;
  direction?: 'avant' | 'apres';
  // Tri (date par défaut) ; le curseur n'est utilisé que pour le tri par date décroissante
  tri?: TriArticles;
  ordre?: OrdreTri;
  // Filtres sur les annotations de l'utilisateur
  noteMin?: number;
  favoris?: boolean;
  nonLus?: boolean;
  aLire?: boolean;
  // Mot-clé extrait automatiquement
  motCle?: string;
}

/**
 * Résultat paginé d'articles
 */
export interface ResultatPagineArticles {
  donnees: ArticleAvecSource[];
  // Pagination classique (offset)
  pagination?: {
    page: number;
    limite: number;
    total: number;
    totalPages: number;
  };
  // Pagination par curseur
  curseurs?: {
    debut: string | null;
    fin: string | null;
    suivant: string | null;
    precedent: string | null;
  };
  aPlus?: {
    avant: boolean;
    apres: boolean;
  };
}

/**
 * Interface du dépôt articles
 */
/**
 * Articles non lus du fil d'un utilisateur, en tout et par source
 */
export interface CompteNonLus {
  total: number;
  parSource: Record<string, number>;
  /** Par rubrique (slug du tag de source) ; une source à plusieurs tags compte dans chacun */
  parTag: Record<string, number>;
}

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
   * Remplace les mots-clés d'un article
   */
  definirMotsCles(articleId: string, mots: string[]): Promise<void>;

  /**
   * Mots-clés d'un lot d'articles (clé = id d'article, ordre d'importance)
   */
  obtenirMotsCles(articleIds: string[]): Promise<Map<string, string[]>>;

  /**
   * Mots-clés les plus fréquents dans le fil d'un utilisateur
   */
  listerMotsClesFil(utilisateurId: string, limite?: number): Promise<MotCleFil[]>;

  /**
   * Articles sans aucun mot-clé (rattrapage des articles antérieurs à l'extraction)
   */
  listerSansMotsCles(limite?: number): Promise<Article[]>;

  /**
   * Compte les articles d'une source
   */
  compterParSource(sourceId: string): Promise<number>;

  /**
   * Marque lus tous les articles du fil publiés avant `avant` (option : une seule source) ; renvoie le nombre marqué
   */
  marquerTousLus(utilisateurId: string, options: { sourceId?: string; avant: Date }): Promise<number>;

  /**
   * Compte les articles non lus du fil (sources actives), en tout et par source
   */
  compterNonLus(utilisateurId: string): Promise<CompteNonLus>;

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
