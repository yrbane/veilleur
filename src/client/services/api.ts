/**
 * Veilleur - Service API Client
 * Communication avec le backend
 */

import { deduplication, demarrerNettoyageCache } from '../utils/deduplication';

const API_BASE = '/api/v1';

// TTL par défaut pour le cache des requêtes GET (5 minutes)
const TTL_CACHE_DEFAUT = 5 * 60 * 1000;

// Démarrer le nettoyage périodique du cache
if (typeof window !== 'undefined') {
  demarrerNettoyageCache(60000);
}

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
 * Jetons : stockage, rafraîchissement et partage entre onglets dans services/session
 */
import {
  clearTokens,
  estAuthentifie,
  jetonExpire,
  obtenirAccessToken,
  obtenirRefreshToken,
  rafraichirSession,
  setOnDeconnexion,
  setTokens,
} from './session';

export { clearTokens, estAuthentifie, setOnDeconnexion, setTokens };

/**
 * Options de requête avec déduplication
 */
interface OptionsRequete extends RequestInit {
  // TTL du cache (0 = pas de cache, -1 = TTL par défaut)
  ttlCache?: number;
  // Désactiver la déduplication
  sansDeduplication?: boolean;
}

/**
 * Effectue une requête API
 */
async function requete<T>(
  endpoint: string,
  options: OptionsRequete = {},
): Promise<T> {
  const { ttlCache, sansDeduplication, ...fetchOptions } = options;
  const url = `${API_BASE}${endpoint}`;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Ne définir Content-Type que si on a un body
  if (fetchOptions.body) {
    headers['Content-Type'] = 'application/json';
  }

  const poserAutorisation = () => {
    const accessToken = obtenirAccessToken();
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    else delete headers['Authorization'];
  };

  // Fonction qui exécute réellement la requête
  const executerRequete = async (signal?: AbortSignal): Promise<T> => {
    // Jeton d'accès périmé : un seul rafraîchissement partagé avant de partir,
    // sinon des requêtes parallèles feraient tourner le même jeton plusieurs fois
    if (obtenirRefreshToken() && jetonExpire(obtenirAccessToken())) {
      await rafraichirSession();
    }
    poserAutorisation();
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal,
    });

    // Gestion du rafraîchissement de token
    if (response.status === 401 && obtenirRefreshToken()) {
      const refreshed = await rafraichirSession();
      if (refreshed) {
        poserAutorisation();
        const retryResponse = await fetch(url, { ...fetchOptions, headers, signal });
        return handleResponse<T>(retryResponse);
      }
    }

    return handleResponse<T>(response);
  };

  // Utiliser la déduplication uniquement pour les GET (sauf si désactivée)
  if (method === 'GET' && !sansDeduplication) {
    const cacheTtl = ttlCache === -1 ? TTL_CACHE_DEFAUT : (ttlCache || 0);
    return deduplication.executer<T>(
      url,
      executerRequete,
      {
        ttlCache: cacheTtl,
        requestOptions: { ...fetchOptions, headers },
      },
    );
  }

  // Pour les autres méthodes, exécuter directement
  return executerRequete();
}

/**
 * Invalide le cache pour un pattern d'URL
 */
export function invaliderCache(pattern: string | RegExp): void {
  deduplication.invaliderCachePattern(pattern);
}

/**
 * Vide tout le cache de requêtes
 */
export function viderCacheRequetes(): void {
  deduplication.viderCache();
}

/**
 * Obtient les statistiques de déduplication
 */
export function obtenirStatsDeduplication() {
  return deduplication.obtenirStatistiques();
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

// ============================================
// Types
// ============================================

export interface Preferences {
  langue?: 'fr' | 'en';
  theme?: 'clair' | 'sombre' | 'auto';
  frequenceRafraichissement?: number;
  pseudo?: string;
  classementPublic?: boolean;
  resumeCourriel?: 'aucun' | 'quotidien' | 'hebdomadaire';
}

export type RoleUtilisateur = 'membre' | 'admin';

export interface Utilisateur {
  id: string;
  email: string;
  dateCreation: string;
  preferences: Preferences;
  totpActif?: boolean;
  role?: RoleUtilisateur;
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
  urlImageOriginale?: string;
  auteur?: string;
  sourceId: string;
  source: {
    nom: string;
    urlFavicon?: string | null;
  };
  note?: number | null;
  favori?: boolean;
  lu?: boolean;
  aLire?: boolean;
  // Classement automatique : mots-clés extraits de l'article
  motsCles?: string[];
}

/**
 * Tri et filtres du fil
 */
export type TriFil = 'date' | 'note' | 'titre' | 'source';

export interface OptionsFil {
  page?: number;
  limite?: number;
  sourceId?: string;
  /** Rubrique : slug d'un tag de source */
  tag?: string;
  /** Date ISO : articles publiés depuis */
  depuis?: string;
  recherche?: string;
  tri?: TriFil;
  ordre?: 'asc' | 'desc';
  noteMin?: number;
  motCle?: string;
  favoris?: boolean;
  nonLus?: boolean;
  aLire?: boolean;
}

export interface ContenuLecture {
  titre: string;
  contenuHtml: string;
  extrait: string | null;
  auteur: string | null;
  nombreMots: number;
  dureeLectureMin: number;
  lien: string;
}

export interface Tendance {
  mot: string;
  nombreRecents: number;
  nombreReference: number;
  score: number;
}

export interface ArticleApprecie {
  id: string;
  titre: string;
  lien: string;
  datePublication: string;
  source: { id: string; nom: string; urlFavicon: string | null };
  nombreFavoris: number;
  nombreNotes: number;
  noteMoyenne: number | null;
}

export interface Badge {
  code: string;
  nom: string;
  description: string;
  icone: string;
  obtenu: boolean;
  progression: number;
}

export interface Progression {
  points: number;
  detail: { libelle: string; nombre: number; parUnite: number; total: number }[];
  niveau: { numero: number; nom: string; seuil: number; prochainSeuil: number | null; progression: number };
  badges: Badge[];
  serie: { courante: number; record: number; activeAujourdhui: boolean };
}

export interface LigneClassement {
  rang: number;
  pseudo: string;
  points: number;
  niveau: string;
  badges: number;
  serie: number;
}

export interface CompteNonLus {
  total: number;
  parSource: Record<string, number>;
  parTag: Record<string, number>;
}

export interface MotCleFil {
  mot: string;
  nombreArticles: number;
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
      await requete('/auth/deconnexion', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: obtenirRefreshToken() }),
      });
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
    const accessToken = obtenirAccessToken();
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
  async listerFil(options: OptionsFil = {}): Promise<ResultatPagine<Article>> {
    const params = new URLSearchParams();
    params.set('page', String(options.page ?? 1));
    params.set('limite', String(options.limite ?? 20));
    if (options.sourceId) params.set('sourceId', options.sourceId);
    if (options.depuis) params.set('depuis', options.depuis);
    if (options.tag) params.set('tag', options.tag);
    if (options.recherche) params.set('recherche', options.recherche);
    if (options.tri) params.set('tri', options.tri);
    if (options.ordre) params.set('ordre', options.ordre);
    if (options.noteMin) params.set('noteMin', String(options.noteMin));
    if (options.motCle) params.set('motCle', options.motCle);
    if (options.favoris) params.set('favoris', 'true');
    if (options.nonLus) params.set('nonLus', 'true');
    if (options.aLire) params.set('aLire', 'true');

    return requete<ResultatPagine<Article>>(`/articles/fil?${params.toString()}`);
  },

  async noter(id: string, note: number | null): Promise<{ note: number | null }> {
    return requete(`/articles/${id}/note`, { method: 'PUT', body: JSON.stringify({ note }) });
  },

  async definirFavori(id: string, favori: boolean): Promise<{ favori: boolean }> {
    return requete(`/articles/${id}/favori`, { method: 'PUT', body: JSON.stringify({ favori }) });
  },

  async definirALire(id: string, aLire: boolean): Promise<{ aLire: boolean }> {
    return requete(`/articles/${id}/a-lire`, { method: 'PUT', body: JSON.stringify({ aLire }) });
  },

  /** Export des annotations : contenu brut (JSON ou CSV) à enregistrer côté navigateur */
  async exporterAnnotations(format: 'json' | 'csv'): Promise<string> {
    const headers: Record<string, string> = {};
    const accessToken = obtenirAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const response = await fetch(`${API_BASE}/articles/export?format=${format}`, { headers });
    if (!response.ok) {
      throw new ErreurAPI('Erreur lors de l\'export', 'EXPORT_ERREUR', response.status);
    }
    return response.text();
  },

  async marquerLu(id: string, lu: boolean): Promise<{ lu: boolean }> {
    return requete(`/articles/${id}/lu`, { method: 'PUT', body: JSON.stringify({ lu }) });
  },

  /** Marque lus les articles du fil publiés avant « avant » (par défaut maintenant), ou ceux d'une source */
  async marquerTousLus(options: { sourceId?: string; avant?: Date } = {}): Promise<{ marques: number }> {
    return requete('/articles/lus', {
      method: 'POST',
      body: JSON.stringify({ sourceId: options.sourceId, avant: (options.avant ?? new Date()).toISOString() }),
    });
  },

  async nonLus(): Promise<CompteNonLus> {
    return requete<CompteNonLus>('/articles/non-lus');
  },

  /** Contenu extrait pour la lecture en place (422 si le site ne s'y prête pas) */
  async lecture(id: string): Promise<ContenuLecture> {
    return requete<ContenuLecture>(`/articles/${id}/lecture`);
  },

  async listerMotsCles(limite = 20): Promise<{ donnees: MotCleFil[] }> {
    return requete(`/articles/mots-cles?limite=${limite}`);
  },

  async obtenir(id: string): Promise<Article> {
    return requete<Article>(`/articles/${id}`);
  },

  async synchroniser(
    sourceId: string,
  ): Promise<{ nouveauxArticles: number; articlesIgnores: number; totalArticles: number }> {
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

  /** Sources suivies par les utilisateurs aux goûts proches (authentifié) */
  async suggestions(limite = 6): Promise<{ donnees: SourcePopulaire[] }> {
    return requete(`/communaute/suggestions?limite=${limite}`);
  },

  async articlesApprecies(limite = 10): Promise<{ donnees: ArticleApprecie[] }> {
    return requete(`/communaute/articles-apprecies?limite=${limite}`);
  },

  async classement(): Promise<{ donnees: LigneClassement[] }> {
    return requete('/communaute/classement');
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

// ============================================
// API Tendances
// ============================================

export const tendances = {
  /** Mots en hausse sur tous les articles (public) */
  async globales(limite = 10): Promise<{ donnees: Tendance[] }> {
    return requete(`/tendances/?limite=${limite}`);
  },

  /** Mots en hausse dans le fil de l'utilisateur */
  async fil(limite = 10): Promise<{ donnees: Tendance[] }> {
    return requete(`/tendances/fil?limite=${limite}`);
  },
};

// ============================================
// API Progression (gamification)
// ============================================

export const progression = {
  async obtenir(): Promise<Progression> {
    return requete<Progression>('/progression/');
  },
};

// ============================================
// API Notifications (Web Push, résumé courriel)
// ============================================

export interface EtatNotifications {
  push: { configure: boolean; appareils: number };
  courriel: { configure: boolean };
}

export const notifications = {
  /** null si le serveur n'a pas de clés VAPID */
  async clePublique(): Promise<string | null> {
    try {
      const reponse = await requete<{ clePublique: string }>('/notifications/push/cle-publique');
      return reponse.clePublique;
    } catch {
      return null;
    }
  },

  async etat(): Promise<EtatNotifications> {
    return requete<EtatNotifications>('/notifications/etat');
  },

  async enregistrerPush(abonnement: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    await requete('/notifications/push/abonnements', { method: 'POST', body: JSON.stringify(abonnement) });
  },

  async supprimerPush(endpoint: string): Promise<void> {
    await requete('/notifications/push/abonnements', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
  },

  async testerPush(): Promise<{ envoyes: number }> {
    return requete('/notifications/push/test', { method: 'POST' });
  },

  async testerResume(frequence: 'quotidien' | 'hebdomadaire'): Promise<{ envoye: boolean; email: string }> {
    return requete('/notifications/resume/test', { method: 'POST', body: JSON.stringify({ frequence }) });
  },
};

// ============================================
// Administration (réservé au rôle admin)
// ============================================

export interface PointSerie {
  jour: string;
  valeur: number;
}

export interface SourceAdmin {
  id: string;
  nom: string;
  url: string;
  typeSource: string;
  statut: 'active' | 'inactive' | 'erreur';
  urlFavicon: string | null;
  nombreEchecs: number;
  dateDerniereSynchro: string | null;
  abonnes: number;
  articles: number;
}

export interface UtilisateurAdmin {
  id: string;
  email: string;
  role: RoleUtilisateur;
  estActif: boolean;
  totpActif: boolean;
  dateCreation: string;
  dateDerniereConnexion: string | null;
  nombreSources: number;
  nombreLectures: number;
}

export interface TableauDeBord {
  utilisateurs: { total: number; actifs: number; admins: number; avec2fa: number; nouveaux7j: number; connectes7j: number; abonnesPush: number };
  sources: { total: number; parType: Record<string, number>; parStatut: Record<string, number>; enEchec: number; abonnements: number; enPause: number };
  articles: { total: number; dernieres24h: number; derniers7j: number; avecImage: number; imagesCachees: number };
  annotations: { lus: number; notes: number; favoris: number; aLire: number; noteMoyenne: number | null; repartitionNotes: number[] };
  images: { parStatut: Record<string, number>; octets: number };
  series: { jours: number; inscriptions: PointSerie[]; articles: PointSerie[]; lectures: PointSerie[] };
  articlesParHeure: number[];
  topSources: SourceAdmin[];
  tagsPopulaires: Array<{ nom: string; slug: string; nombreSources: number }>;
  motsClesFrequents: Array<{ mot: string; nombre: number }>;
}

export interface EtatSysteme {
  version: string;
  node: string;
  uptimeSecondes: number;
  memoire: { rss: number; heapUtilise: number };
  redis: { ok: boolean; memoireOctets: number | null };
  baseDonnees: { octets: number };
  files: Record<string, { attente: number; actifs: number; termines: number; echoues: number; differes: number }>;
}

export interface ListeAdmin<T> {
  donnees: T[];
  total: number;
  page: number;
  limite: number;
}

export interface OptionsListeAdmin {
  page?: number;
  limite?: number;
  recherche?: string;
  tri?: string;
  ordre?: 'asc' | 'desc';
}

const requeteListe = (chemin: string, options: OptionsListeAdmin): string => {
  const params = new URLSearchParams({ page: String(options.page ?? 1), limite: String(options.limite ?? 25) });
  if (options.recherche) params.set('recherche', options.recherche);
  if (options.tri) params.set('tri', options.tri);
  if (options.ordre) params.set('ordre', options.ordre);
  return `${chemin}?${params}`;
};

export const admin = {
  async tableauDeBord(): Promise<TableauDeBord> {
    return requete<TableauDeBord>('/admin/tableau-de-bord');
  },

  async systeme(): Promise<EtatSysteme> {
    return requete<EtatSysteme>('/admin/systeme');
  },

  async listerUtilisateurs(options: OptionsListeAdmin = {}): Promise<ListeAdmin<UtilisateurAdmin>> {
    return requete<ListeAdmin<UtilisateurAdmin>>(requeteListe('/admin/utilisateurs', options));
  },

  async modifierUtilisateur(id: string, changements: { role?: RoleUtilisateur; estActif?: boolean }): Promise<UtilisateurAdmin> {
    return requete<UtilisateurAdmin>(`/admin/utilisateurs/${id}`, { method: 'PATCH', body: JSON.stringify(changements) });
  },

  async supprimerUtilisateur(id: string): Promise<void> {
    await requete(`/admin/utilisateurs/${id}`, { method: 'DELETE' });
  },

  async listerSources(options: OptionsListeAdmin = {}): Promise<ListeAdmin<SourceAdmin>> {
    return requete<ListeAdmin<SourceAdmin>>(requeteListe('/admin/sources', options));
  },

  async modifierSource(id: string, statut: 'active' | 'inactive'): Promise<void> {
    await requete(`/admin/sources/${id}`, { method: 'PATCH', body: JSON.stringify({ statut }) });
  },

  async synchroniserSource(id: string): Promise<void> {
    await requete(`/admin/sources/${id}/synchroniser`, { method: 'POST' });
  },
};
