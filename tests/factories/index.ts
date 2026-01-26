/**
 * Veilleur - Factories de test
 * Création d'objets de test avec des valeurs par défaut
 */

import { vi } from 'vitest';

// ============================================================
// TYPES
// ============================================================

interface Article {
  id: string;
  titre: string;
  contenu: string;
  url: string;
  datePublication: Date;
  dateMaj?: Date;
  sourceId: string;
  auteur?: string;
  image?: string;
  resume?: string;
  lu: boolean;
  favori: boolean;
  archive: boolean;
  score?: number;
}

interface Source {
  id: string;
  nom: string;
  url: string;
  siteUrl?: string;
  description?: string;
  image?: string;
  categorieId?: string;
  utilisateurId: string;
  intervalleSync: number;
  derniereSync?: Date;
  prochaineSync: Date;
  statut: 'active' | 'pause' | 'erreur' | 'suspendue';
  nombreErreurs: number;
  derniereErreur?: string;
  articlesCount: number;
  articlesNonLus: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  motDePasseHash?: string;
  avatar?: string;
  bio?: string;
  statut: 'actif' | 'inactif' | 'verrouille' | 'supprime';
  role: 'utilisateur' | 'admin';
  derniereConnexion?: Date;
  preferences: Record<string, unknown>;
  emailVerifie: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Categorie {
  id: string;
  nom: string;
  slug: string;
  description?: string;
  icone?: string;
  couleur?: string;
  utilisateurId: string;
  ordre: number;
  sourcesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// COUNTERS
// ============================================================

let articleCounter = 0;
let sourceCounter = 0;
let utilisateurCounter = 0;
let categorieCounter = 0;

export function resetCounters(): void {
  articleCounter = 0;
  sourceCounter = 0;
  utilisateurCounter = 0;
  categorieCounter = 0;
}

// ============================================================
// HELPERS
// ============================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================================
// ARTICLE FACTORY
// ============================================================

export function createArticle(overrides: Partial<Article> = {}): Article {
  articleCounter++;
  const now = new Date();

  return {
    id: generateUUID(),
    titre: `Article de test ${articleCounter}`,
    contenu: `<p>Contenu de l'article ${articleCounter}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`,
    url: `https://example.com/articles/${articleCounter}`,
    datePublication: new Date(now.getTime() - articleCounter * 3600000),
    sourceId: generateUUID(),
    auteur: `Auteur ${articleCounter}`,
    image: `https://picsum.photos/seed/${articleCounter}/800/400`,
    resume: `Résumé de l'article ${articleCounter}...`,
    lu: false,
    favori: false,
    archive: false,
    score: Math.random() * 100,
    ...overrides,
  };
}

export function createArticles(count: number, overrides: Partial<Article> = {}): Article[] {
  return Array.from({ length: count }, () => createArticle(overrides));
}

// ============================================================
// SOURCE FACTORY
// ============================================================

export function createSource(overrides: Partial<Source> = {}): Source {
  sourceCounter++;
  const now = new Date();

  return {
    id: generateUUID(),
    nom: `Source ${sourceCounter}`,
    url: `https://example-${sourceCounter}.com/feed.xml`,
    siteUrl: `https://example-${sourceCounter}.com`,
    description: `Description de la source ${sourceCounter}`,
    utilisateurId: generateUUID(),
    intervalleSync: 60,
    derniereSync: new Date(now.getTime() - 1800000),
    prochaineSync: new Date(now.getTime() + 1800000),
    statut: 'active',
    nombreErreurs: 0,
    articlesCount: Math.floor(Math.random() * 100),
    articlesNonLus: Math.floor(Math.random() * 20),
    createdAt: new Date(now.getTime() - sourceCounter * 86400000),
    updatedAt: now,
    ...overrides,
  };
}

export function createSources(count: number, overrides: Partial<Source> = {}): Source[] {
  return Array.from({ length: count }, () => createSource(overrides));
}

// ============================================================
// UTILISATEUR FACTORY
// ============================================================

export function createUtilisateur(overrides: Partial<Utilisateur> = {}): Utilisateur {
  utilisateurCounter++;
  const now = new Date();

  return {
    id: generateUUID(),
    email: `utilisateur${utilisateurCounter}@test.com`,
    nom: `Utilisateur ${utilisateurCounter}`,
    motDePasseHash: '$2b$10$hashedpassword',
    statut: 'actif',
    role: 'utilisateur',
    derniereConnexion: now,
    preferences: {
      theme: 'auto',
      langue: 'fr',
      articlesPardPage: 20,
    },
    emailVerifie: true,
    createdAt: new Date(now.getTime() - utilisateurCounter * 86400000 * 7),
    updatedAt: now,
    ...overrides,
  };
}

export function createAdmin(overrides: Partial<Utilisateur> = {}): Utilisateur {
  return createUtilisateur({
    role: 'admin',
    ...overrides,
  });
}

// ============================================================
// CATEGORIE FACTORY
// ============================================================

export function createCategorie(overrides: Partial<Categorie> = {}): Categorie {
  categorieCounter++;
  const nom = overrides.nom ?? `Catégorie ${categorieCounter}`;
  const now = new Date();

  return {
    id: generateUUID(),
    nom,
    slug: generateSlug(nom),
    description: `Description de la catégorie ${categorieCounter}`,
    icone: '📁',
    couleur: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    utilisateurId: generateUUID(),
    ordre: categorieCounter,
    sourcesCount: Math.floor(Math.random() * 10),
    createdAt: new Date(now.getTime() - categorieCounter * 86400000),
    updatedAt: now,
    ...overrides,
  };
}

export function createCategories(count: number, overrides: Partial<Categorie> = {}): Categorie[] {
  return Array.from({ length: count }, () => createCategorie(overrides));
}

// ============================================================
// REQUEST/RESPONSE MOCKS
// ============================================================

export interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  user?: { id: string; email: string; role: string };
}

export function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method: 'GET',
    url: '/api/v1/test',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: undefined,
    params: {},
    query: {},
    ...overrides,
  };
}

export interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

export function createMockResponse(): MockResponse {
  const res: MockResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return res;
}

// ============================================================
// API RESPONSE MOCKS
// ============================================================

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function createApiResponse<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
  return { data, meta };
}

export function createPaginatedResponse<T>(
  items: T[],
  page = 1,
  limit = 20,
  total?: number,
): ApiResponse<T[]> {
  const actualTotal = total ?? items.length;
  return {
    data: items,
    meta: {
      total: actualTotal,
      page,
      limit,
      totalPages: Math.ceil(actualTotal / limit),
    },
  };
}

// ============================================================
// JWT/AUTH MOCKS
// ============================================================

export function createAuthToken(payload: Record<string, unknown> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      sub: generateUUID(),
      email: 'test@example.com',
      role: 'utilisateur',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    }),
  ).toString('base64url');
  const signature = 'test-signature';

  return `${header}.${body}.${signature}`;
}

export function createAuthHeaders(token?: string): Record<string, string> {
  return {
    authorization: `Bearer ${token ?? createAuthToken()}`,
  };
}

// ============================================================
// FEED/RSS MOCKS
// ============================================================

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content?: string;
  author?: string;
  guid?: string;
}

export function createFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  const count = ++articleCounter;
  return {
    title: `Feed Item ${count}`,
    link: `https://example.com/feed/${count}`,
    pubDate: new Date().toISOString(),
    description: `Description de l'item ${count}`,
    content: `<p>Contenu complet de l'item ${count}</p>`,
    author: `Author ${count}`,
    guid: `guid-${count}`,
    ...overrides,
  };
}

export function createRssFeed(items: FeedItem[] = []): string {
  const feedItems = items.length > 0 ? items : [createFeedItem(), createFeedItem(), createFeedItem()];

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test RSS feed</description>
    <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
    ${feedItems
      .map(
        (item) => `
    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[${item.description}]]></description>
      ${item.content ? `<content:encoded><![CDATA[${item.content}]]></content:encoded>` : ''}
      ${item.author ? `<author>${item.author}</author>` : ''}
      ${item.guid ? `<guid>${item.guid}</guid>` : ''}
    </item>`,
      )
      .join('\n')}
  </channel>
</rss>`;
}

// ============================================================
// EXPORTS
// ============================================================

export const factories = {
  article: createArticle,
  articles: createArticles,
  source: createSource,
  sources: createSources,
  utilisateur: createUtilisateur,
  admin: createAdmin,
  categorie: createCategorie,
  categories: createCategories,
  request: createMockRequest,
  response: createMockResponse,
  apiResponse: createApiResponse,
  paginatedResponse: createPaginatedResponse,
  authToken: createAuthToken,
  authHeaders: createAuthHeaders,
  feedItem: createFeedItem,
  rssFeed: createRssFeed,
  reset: resetCounters,
};

export default factories;
