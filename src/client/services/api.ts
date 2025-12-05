/**
 * Veilleur - Service API Client
 * Communication avec le backend
 */

const API_BASE = '/api/v1';

/**
 * Erreur API personnalisée
 */
export class ErreurAPI extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ErreurAPI';
  }
}

/**
 * Stockage du token d'accès
 */
let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');
let onDeconnexionCallback: (() => void) | null = null;

/**
 * Définit le callback appelé lors d'une déconnexion automatique
 */
export function setOnDeconnexion(callback: () => void): void {
  onDeconnexionCallback = callback;
}

/**
 * Définit les tokens d'authentification
 */
export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

/**
 * Efface les tokens d'authentification
 */
export function clearTokens(notifier = false): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (notifier && onDeconnexionCallback) {
    onDeconnexionCallback();
  }
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
export function estAuthentifie(): boolean {
  return accessToken !== null;
}

/**
 * Effectue une requête API
 */
async function requete<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Gestion du rafraîchissement de token
  if (response.status === 401 && refreshToken) {
    const refreshed = await rafraichirTokens();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retryResponse = await fetch(url, { ...options, headers });
      return handleResponse<T>(retryResponse);
    }
  }

  return handleResponse<T>(response);
}

/**
 * Traite la réponse de l'API
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ErreurAPI(
      data?.message || 'Une erreur est survenue',
      data?.erreur || 'ERREUR_INCONNUE',
      response.status,
      data?.details,
    );
  }

  return data as T;
}

/**
 * Rafraîchit les tokens d'authentification
 */
async function rafraichirTokens(): Promise<boolean> {
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/rafraichir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearTokens(true);
      return false;
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens(true);
    return false;
  }
}

// ============================================
// Types
// ============================================

export interface Preferences {
  langue?: 'fr' | 'en';
  theme?: 'clair' | 'sombre' | 'auto';
  frequenceRafraichissement?: number;
}

export interface Utilisateur {
  id: string;
  email: string;
  dateCreation: string;
  preferences: Preferences;
}

export interface ResultatAuth {
  utilisateur: Utilisateur;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Source {
  id: string;
  url: string;
  nom: string;
  typeSource: 'rss' | 'atom' | 'html';
  statut: 'active' | 'inactive' | 'erreur';
  urlFavicon?: string;
  dateAjout: string;
  note?: number;
  estEnPause: boolean;
}

export interface Article {
  id: string;
  titre: string;
  lien: string;
  datePublication: string;
  resume?: string;
  urlImage?: string;
  auteur?: string;
  source: {
    nom: string;
    urlFavicon?: string;
  };
}

export interface Pagination {
  page: number;
  limite: number;
  total: number;
  totalPages: number;
}

export interface ResultatPagine<T> {
  donnees: T[];
  pagination: Pagination;
}

export interface Statistiques {
  totalArticles: number;
  articlesAujourdhui: number;
  articlesCetteSemaine: number;
}

// ============================================
// API Authentification
// ============================================

export interface ResultatConnexion extends ResultatAuth {
  totpRequis?: boolean;
  message?: string;
}

export interface Statut2FA {
  actif: boolean;
  configure: boolean;
}

export interface ResultatActiver2FA {
  secret: string;
  qrCode: string;
  message: string;
}

export const auth = {
  async inscription(email: string, motDePasse: string): Promise<ResultatAuth> {
    const result = await requete<ResultatAuth>('/auth/inscription', {
      method: 'POST',
      body: JSON.stringify({ email, motDePasse }),
    });
    setTokens(result.accessToken, result.refreshToken);
    return result;
  },

  async connexion(email: string, motDePasse: string, codeTOTP?: string): Promise<ResultatConnexion> {
    const result = await requete<ResultatConnexion>('/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ email, motDePasse, codeTOTP }),
    });
    // Si 2FA requis, ne pas stocker les tokens
    if (result.totpRequis) {
      return result;
    }
    if (result.accessToken && result.refreshToken) {
      setTokens(result.accessToken, result.refreshToken);
    }
    return result;
  },

  async deconnexion(): Promise<void> {
    try {
      await requete('/auth/deconnexion', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },

  async profil(): Promise<Utilisateur> {
    return requete<Utilisateur>('/auth/profil');
  },

  async mettreAJourProfil(preferences: Partial<Preferences>): Promise<Utilisateur> {
    return requete<Utilisateur>('/auth/profil', {
      method: 'PATCH',
      body: JSON.stringify({ preferences }),
    });
  },

  async changerMotDePasse(motDePasseActuel: string, nouveauMotDePasse: string): Promise<void> {
    await requete('/auth/mot-de-passe', {
      method: 'PUT',
      body: JSON.stringify({ motDePasseActuel, nouveauMotDePasse }),
    });
  },

  // Méthodes 2FA
  async statut2FA(): Promise<Statut2FA> {
    return requete<Statut2FA>('/auth/2fa/statut');
  },

  async activer2FA(): Promise<ResultatActiver2FA> {
    return requete<ResultatActiver2FA>('/auth/2fa/activer', { method: 'POST' });
  },

  async confirmer2FA(code: string): Promise<{ message: string }> {
    return requete<{ message: string }>('/auth/2fa/confirmer', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async desactiver2FA(code: string): Promise<{ message: string }> {
    return requete<{ message: string }>('/auth/2fa/desactiver', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
};

// ============================================
// API Sources
// ============================================

export interface FiltresMotsCles {
  inclure?: string[];
  exclure?: string[];
}

export interface PlageHoraire {
  debut: string;
  fin: string;
  joursActifs: number[];
}

export interface ParametresSource {
  nombreMaxArticles: number;
  frequenceMinutes: number;
  retentionJours: number;
  priorite: 'haute' | 'normale' | 'basse';
  modeExtraction: 'rss' | 'scraping' | 'auto';
  filtresMotsCles: FiltresMotsCles;
  notifications: 'aucune' | 'nouveaux' | 'tous';
  plageHoraire: PlageHoraire | null;
}

export interface ResultatImportOPML {
  importees: number;
  ignorees: number;
  erreurs: Array<{ url: string; raison: string }>;
}

export const sources = {
  async lister(page = 1, limite = 20): Promise<ResultatPagine<Source>> {
    return requete<ResultatPagine<Source>>(
      `/sources/?page=${page}&limite=${limite}`,
    );
  },

  async ajouter(url: string, nom?: string): Promise<Source> {
    return requete<Source>('/sources/', {
      method: 'POST',
      body: JSON.stringify({ url, nom }),
    });
  },

  async supprimer(id: string): Promise<void> {
    await requete(`/sources/${id}`, { method: 'DELETE' });
  },

  async mettreEnPause(id: string, estEnPause: boolean): Promise<void> {
    await requete(`/sources/${id}/pause`, {
      method: 'PUT',
      body: JSON.stringify({ estEnPause }),
    });
  },

  async noter(id: string, note: number): Promise<void> {
    await requete(`/sources/${id}/note`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    });
  },

  async obtenirParametres(id: string): Promise<ParametresSource> {
    return requete<ParametresSource>(`/sources/${id}/parametres`);
  },

  async mettreAJourParametres(id: string, parametres: Partial<ParametresSource>): Promise<void> {
    await requete(`/sources/${id}/parametres`, {
      method: 'PUT',
      body: JSON.stringify(parametres),
    });
  },

  async exporterOPML(): Promise<string> {
    const url = `${API_BASE}/sources/export/opml`;
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new ErreurAPI('Erreur lors de l\'export', 'EXPORT_ERREUR', response.status);
    }
    return response.text();
  },

  async importerOPML(contenu: string): Promise<ResultatImportOPML> {
    return requete<ResultatImportOPML>('/sources/import/opml', {
      method: 'POST',
      body: JSON.stringify({ contenu }),
    });
  },
};

// ============================================
// API Articles
// ============================================

export const articles = {
  async listerFil(
    page = 1,
    limite = 20,
    sourceId?: string,
  ): Promise<ResultatPagine<Article>> {
    let url = `/articles/fil?page=${page}&limite=${limite}`;
    if (sourceId) {
      url += `&sourceId=${sourceId}`;
    }
    return requete<ResultatPagine<Article>>(url);
  },

  async obtenir(id: string): Promise<Article> {
    return requete<Article>(`/articles/${id}`);
  },

  async synchroniser(
    sourceId: string,
  ): Promise<{ nouveauxArticles: number; articlesIgnores: number }> {
    return requete(`/articles/synchroniser/${sourceId}`, { method: 'POST' });
  },

  async statistiques(): Promise<Statistiques> {
    return requete<Statistiques>('/articles/statistiques');
  },
};

// ============================================
// Types Tags
// ============================================

export interface Tag {
  id: string;
  nom: string;
  slug: string;
  nombreSources?: number;
  dateCreation?: string;
}

// ============================================
// API Tags
// ============================================

// ============================================
// Types Communauté
// ============================================

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

export interface TagPopulaire {
  id: string;
  nom: string;
  slug: string;
  nombreSources: number;
}

export interface CriteresCommunaute {
  page?: number;
  limite?: number;
  tag?: string;
  tri?: 'populaire' | 'note' | 'recent';
  recherche?: string;
}

// ============================================
// API Communauté
// ============================================

export const communaute = {
  async listerSourcesPopulaires(
    criteres: CriteresCommunaute = {},
  ): Promise<ResultatPagine<SourcePopulaire>> {
    const params = new URLSearchParams();
    if (criteres.page) params.set('page', String(criteres.page));
    if (criteres.limite) params.set('limite', String(criteres.limite));
    if (criteres.tag) params.set('tag', criteres.tag);
    if (criteres.tri) params.set('tri', criteres.tri);
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    const query = params.toString();
    return requete<ResultatPagine<SourcePopulaire>>(
      `/communaute/sources-populaires${query ? `?${query}` : ''}`,
    );
  },

  async listerTagsPopulaires(limite = 20): Promise<{ donnees: TagPopulaire[] }> {
    return requete<{ donnees: TagPopulaire[] }>(
      `/communaute/tags-populaires?limite=${limite}`,
    );
  },

  async rechercher(
    terme: string,
    criteres: CriteresCommunaute = {},
  ): Promise<ResultatPagine<SourcePopulaire>> {
    const params = new URLSearchParams({ q: terme });
    if (criteres.page) params.set('page', String(criteres.page));
    if (criteres.limite) params.set('limite', String(criteres.limite));
    if (criteres.tag) params.set('tag', criteres.tag);
    if (criteres.tri) params.set('tri', criteres.tri);
    return requete<ResultatPagine<SourcePopulaire>>(
      `/communaute/recherche?${params.toString()}`,
    );
  },
};

export const tags = {
  async lister(): Promise<{ donnees: Tag[] }> {
    return requete<{ donnees: Tag[] }>('/tags/');
  },

  async creer(nom: string): Promise<Tag> {
    return requete<Tag>('/tags/', {
      method: 'POST',
      body: JSON.stringify({ nom }),
    });
  },

  async supprimer(id: string): Promise<void> {
    await requete(`/tags/${id}`, { method: 'DELETE' });
  },

  async listerPourSource(sourceId: string): Promise<{ donnees: Tag[] }> {
    return requete<{ donnees: Tag[] }>(`/tags/sources/${sourceId}/tags`);
  },

  async ajouterASource(sourceId: string, tagNom: string): Promise<{ tag: Tag }> {
    return requete<{ tag: Tag }>(`/tags/sources/${sourceId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagNom }),
    });
  },

  async retirerDeSource(sourceId: string, tagId: string): Promise<void> {
    await requete(`/tags/sources/${sourceId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  },
};
