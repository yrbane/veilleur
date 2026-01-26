/**
 * Veilleur - Constantes de l'application
 * Valeurs globales centralisées et immuables
 *
 * Fonctionnalités:
 * - Constantes métier
 * - Limites et quotas
 * - Configuration par défaut
 * - Messages et labels
 * - Patterns de validation
 */

// ============================================================
// INFORMATIONS APPLICATION
// ============================================================

export const APP = {
  NOM: 'Veilleur',
  VERSION: '1.0.0',
  DESCRIPTION: 'Agrégateur d\'actualités RSS/Atom',
  AUTEUR: 'Veilleur Team',
  URL: 'https://veilleur.app',
} as const;

// ============================================================
// LIMITES ET QUOTAS
// ============================================================

export const LIMITES = {
  // Articles
  ARTICLES_PAR_PAGE_MIN: 5,
  ARTICLES_PAR_PAGE_MAX: 100,
  ARTICLES_PAR_PAGE_DEFAUT: 20,
  ARTICLES_MAX_PAR_SOURCE: 1000,
  ARTICLES_RETENTION_JOURS: 90,

  // Sources
  SOURCES_MAX_PAR_UTILISATEUR: 500,
  SOURCES_SYNC_INTERVALLE_MIN: 5, // minutes
  SOURCES_SYNC_INTERVALLE_MAX: 1440, // 24h
  SOURCES_SYNC_INTERVALLE_DEFAUT: 60, // 1h
  SOURCES_TIMEOUT_MS: 30000,
  SOURCES_MAX_REDIRECTS: 5,

  // Utilisateurs
  MOT_DE_PASSE_MIN: 8,
  MOT_DE_PASSE_MAX: 128,
  NOM_MIN: 2,
  NOM_MAX: 100,
  EMAIL_MAX: 255,
  BIO_MAX: 500,

  // Fichiers
  UPLOAD_MAX_SIZE: 5 * 1024 * 1024, // 5 MB
  AVATAR_MAX_SIZE: 1 * 1024 * 1024, // 1 MB
  OPML_MAX_SIZE: 10 * 1024 * 1024, // 10 MB

  // Rate limiting
  REQUETES_PAR_MINUTE_ANON: 30,
  REQUETES_PAR_MINUTE_AUTH: 100,
  REQUETES_PAR_MINUTE_API: 300,
  TENTATIVES_LOGIN_MAX: 5,
  VERROUILLAGE_DUREE_MIN: 15, // minutes
  VERROUILLAGE_DUREE_MAX: 1440, // 24h après récidives

  // Recherche
  RECHERCHE_MIN_CHARS: 2,
  RECHERCHE_MAX_CHARS: 200,
  RECHERCHE_MAX_RESULTATS: 500,

  // Cache
  CACHE_TTL_COURT: 60, // 1 minute
  CACHE_TTL_MOYEN: 300, // 5 minutes
  CACHE_TTL_LONG: 3600, // 1 heure
  CACHE_TTL_JOUR: 86400, // 24 heures
} as const;

// ============================================================
// DURÉES ET TIMEOUTS
// ============================================================

export const DUREES = {
  // Sessions
  SESSION_ACCESS_TOKEN: 15 * 60 * 1000, // 15 minutes
  SESSION_REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 jours
  SESSION_REMEMBER_ME: 30 * 24 * 60 * 60 * 1000, // 30 jours

  // Timeouts réseau
  TIMEOUT_API: 10000, // 10s
  TIMEOUT_FETCH_FEED: 30000, // 30s
  TIMEOUT_UPLOAD: 60000, // 1min

  // Debounce/Throttle
  DEBOUNCE_RECHERCHE: 300, // 300ms
  DEBOUNCE_SAUVEGARDE: 1000, // 1s
  THROTTLE_SCROLL: 100, // 100ms

  // Polling
  POLL_NOTIFICATIONS: 30000, // 30s
  POLL_SYNC_STATUS: 5000, // 5s

  // Animations
  ANIMATION_RAPIDE: 150,
  ANIMATION_NORMALE: 300,
  ANIMATION_LENTE: 500,
} as const;

// ============================================================
// PATTERNS DE VALIDATION
// ============================================================

export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  COULEUR_HEX: /^#[0-9A-Fa-f]{6}$/,
  MOT_DE_PASSE_FORT: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/,
  TELEPHONE_FR: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
  CODE_POSTAL_FR: /^(?:0[1-9]|[1-8]\d|9[0-5])\d{3}$/,
} as const;

// ============================================================
// TYPES DE CONTENU
// ============================================================

export const TYPES_CONTENU = {
  // Images
  IMAGES_ACCEPTEES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  IMAGES_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],

  // Feeds
  FEEDS_ACCEPTES: ['application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml'],

  // Documents
  DOCUMENTS_ACCEPTES: ['application/pdf', 'application/xml', 'text/plain', 'text/html'],

  // OPML
  OPML_ACCEPTES: ['application/xml', 'text/xml', 'text/x-opml'],
} as const;

// ============================================================
// STATUTS ET ÉNUMÉRATIONS
// ============================================================

export const STATUTS = {
  // Source
  SOURCE: {
    ACTIVE: 'active',
    PAUSE: 'pause',
    ERREUR: 'erreur',
    SUSPENDUE: 'suspendue',
  },

  // Article
  ARTICLE: {
    NON_LU: 'non_lu',
    LU: 'lu',
    ARCHIVE: 'archive',
    FAVORI: 'favori',
  },

  // Utilisateur
  UTILISATEUR: {
    ACTIF: 'actif',
    INACTIF: 'inactif',
    VERROUILLE: 'verrouille',
    SUPPRIME: 'supprime',
  },

  // Synchronisation
  SYNC: {
    EN_ATTENTE: 'en_attente',
    EN_COURS: 'en_cours',
    TERMINE: 'termine',
    ECHEC: 'echec',
  },
} as const;

export type StatutSource = (typeof STATUTS.SOURCE)[keyof typeof STATUTS.SOURCE];
export type StatutArticle = (typeof STATUTS.ARTICLE)[keyof typeof STATUTS.ARTICLE];
export type StatutUtilisateur = (typeof STATUTS.UTILISATEUR)[keyof typeof STATUTS.UTILISATEUR];
export type StatutSync = (typeof STATUTS.SYNC)[keyof typeof STATUTS.SYNC];

// ============================================================
// CATÉGORIES PAR DÉFAUT
// ============================================================

export const CATEGORIES = {
  DEFAUT: [
    'Actualités',
    'Technologie',
    'Science',
    'Sports',
    'Culture',
    'Économie',
    'Politique',
    'Environnement',
    'Santé',
    'Lifestyle',
    'Divertissement',
    'Gaming',
    'Musique',
    'Cinéma',
    'Littérature',
  ],

  ICONES: {
    'Actualités': '📰',
    'Technologie': '💻',
    'Science': '🔬',
    'Sports': '⚽',
    'Culture': '🎭',
    'Économie': '💰',
    'Politique': '🏛️',
    'Environnement': '🌍',
    'Santé': '🏥',
    'Lifestyle': '✨',
    'Divertissement': '🎉',
    'Gaming': '🎮',
    'Musique': '🎵',
    'Cinéma': '🎬',
    'Littérature': '📚',
  } as Record<string, string>,
} as const;

// ============================================================
// PRÉFÉRENCES PAR DÉFAUT
// ============================================================

export const PREFERENCES_DEFAUT = {
  theme: 'auto' as const,
  langue: 'fr' as const,
  articlesPardPage: 20,
  notificationsEmail: true,
  notificationsPush: false,
  lectureAutomatique: false,
  ouvrirDansNouvelOnglet: false,
  afficherImages: true,
  afficherExtraits: true,
  marquerLuAuScroll: true,
  raccourcisClavier: true,
} as const;

export type Preferences = typeof PREFERENCES_DEFAUT;

// ============================================================
// CLÉS DE STOCKAGE LOCAL
// ============================================================

export const STORAGE_KEYS = {
  // Auth
  ACCESS_TOKEN: 'veilleur_access_token',
  REFRESH_TOKEN: 'veilleur_refresh_token',
  USER: 'veilleur_user',

  // Préférences
  THEME: 'veilleur_theme',
  LANGUE: 'veilleur_langue',
  PREFERENCES: 'veilleur_preferences',

  // État UI
  SIDEBAR_COLLAPSED: 'veilleur_sidebar_collapsed',
  ARTICLES_VIEW: 'veilleur_articles_view',
  DERNIERE_SOURCE: 'veilleur_derniere_source',

  // Cache
  SOURCES_CACHE: 'veilleur_sources_cache',
  CATEGORIES_CACHE: 'veilleur_categories_cache',
} as const;

// ============================================================
// ROUTES ET ENDPOINTS
// ============================================================

export const ROUTES = {
  // Auth
  CONNEXION: '/connexion',
  INSCRIPTION: '/inscription',
  DECONNEXION: '/deconnexion',
  MOT_DE_PASSE_OUBLIE: '/mot-de-passe-oublie',

  // Application
  ACCUEIL: '/',
  FIL: '/fil',
  SOURCES: '/sources',
  SOURCE: '/sources/:id',
  ARTICLE: '/articles/:id',
  FAVORIS: '/favoris',
  ARCHIVES: '/archives',
  RECHERCHE: '/recherche',

  // Paramètres
  PARAMETRES: '/parametres',
  PROFIL: '/parametres/profil',
  ABONNEMENTS: '/parametres/abonnements',
  IMPORT_EXPORT: '/parametres/import-export',
} as const;

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/v1/auth/connexion',
  REGISTER: '/api/v1/auth/inscription',
  LOGOUT: '/api/v1/auth/deconnexion',
  REFRESH: '/api/v1/auth/rafraichir',
  ME: '/api/v1/auth/moi',

  // Sources
  SOURCES: '/api/v1/sources',
  SOURCE: '/api/v1/sources/:id',
  SOURCE_SYNC: '/api/v1/sources/:id/synchroniser',

  // Articles
  ARTICLES: '/api/v1/articles',
  ARTICLE: '/api/v1/articles/:id',
  ARTICLES_LU: '/api/v1/articles/:id/lu',
  ARTICLES_FAVORI: '/api/v1/articles/:id/favori',

  // Utilisateur
  UTILISATEUR: '/api/v1/utilisateur',
  PREFERENCES: '/api/v1/utilisateur/preferences',

  // Health
  HEALTH: '/api/v1/health',
} as const;

// ============================================================
// MESSAGES UTILISATEUR
// ============================================================

export const MESSAGES = {
  SUCCES: {
    CONNEXION: 'Connexion réussie',
    INSCRIPTION: 'Compte créé avec succès',
    DECONNEXION: 'Déconnexion réussie',
    SOURCE_AJOUTEE: 'Source ajoutée',
    SOURCE_SUPPRIMEE: 'Source supprimée',
    PREFERENCES_SAUVEGARDEES: 'Préférences sauvegardées',
    IMPORT_TERMINE: 'Import terminé',
    EXPORT_TERMINE: 'Export terminé',
  },

  ERREUR: {
    GENERIQUE: 'Une erreur est survenue',
    CONNEXION_ECHEC: 'Identifiants incorrects',
    SESSION_EXPIREE: 'Session expirée, veuillez vous reconnecter',
    RESEAU: 'Erreur de connexion réseau',
    CHARGEMENT: 'Erreur lors du chargement',
    SAUVEGARDE: 'Erreur lors de la sauvegarde',
  },

  CONFIRMATION: {
    SUPPRESSION_SOURCE: 'Voulez-vous vraiment supprimer cette source ?',
    SUPPRESSION_COMPTE: 'Voulez-vous vraiment supprimer votre compte ?',
    DECONNEXION: 'Voulez-vous vous déconnecter ?',
    TOUT_MARQUER_LU: 'Marquer tous les articles comme lus ?',
  },

  VIDE: {
    AUCUN_ARTICLE: 'Aucun article',
    AUCUNE_SOURCE: 'Aucune source',
    AUCUN_RESULTAT: 'Aucun résultat',
    AUCUN_FAVORI: 'Aucun favori',
  },
} as const;
