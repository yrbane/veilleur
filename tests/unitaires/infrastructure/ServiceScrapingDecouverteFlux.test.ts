/**
 * Veilleur - Découverte automatique du flux d'un site
 * L'utilisateur colle souvent l'adresse d'un site (https://www.mediapart.fr) plutôt que
 * celle de son flux : on cherche la balise <link rel="alternate"> puis les chemins usuels.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/scraping/validationUrl', () => ({
  validerUrlScraping: vi.fn((url: string) => ({ valide: true, urlNormalisee: url })),
  normaliserUrlScraping: vi.fn((url: string) => url),
}));
vi.mock('@/config/environnement', () => ({
  env: { SCRAPING_USER_AGENT: 'Test', SCRAPING_TIMEOUT_MS: 1000, SCRAPING_RATE_LIMIT_MS: 0 },
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerScraping: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ServiceScraping } from '@/infrastructure/scraping/ServiceScraping';

const PAGE_AVEC_LIEN = `<html><head>
  <title>Mon journal</title>
  <link rel="alternate" type="application/rss+xml" title="Flux" href="/articles/feed">
  <link rel="icon" href="/favicon.ico">
</head><body></body></html>`;

const PAGE_SANS_LIEN = '<html><head><title>Site muet</title></head><body></body></html>';

const FLUX = `<?xml version="1.0"?><rss version="2.0"><channel><title>Flux du journal</title>
  <link>https://journal.fr</link><category>Politique</category>
  <item><title>A</title><link>https://journal.fr/a</link><category>Écologie</category></item></channel></rss>`;

/**
 * Simule le réseau : les URL de flux listées renvoient le flux, les autres la page HTML
 * (ou une erreur réseau si pageHtml est null). Retourne la liste des URL appelées.
 */
function simulerReseau(
  fluxValides: string[],
  pageHtml: string | null,
  options: { httpsInjoignable?: boolean } = {},
): string[] {
  const appels: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    appels.push(url);
    if (options.httpsInjoignable && url.startsWith('https://')) throw new Error('ECONNREFUSED');
    if (fluxValides.includes(url)) {
      return new Response(FLUX, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
    }
    if (pageHtml === null) throw new Error('réseau');
    return new Response(pageHtml, { status: 200, headers: { 'content-type': 'text/html' } });
  }));
  return appels;
}

describe('ServiceScraping.decouvrirFlux', () => {
  let service: ServiceScraping;

  beforeEach(() => {
    vi.unstubAllGlobals();
    service = new ServiceScraping();
  });

  it('retourne directement l\'URL si c\'est déjà un flux', async () => {
    const appels = simulerReseau(['https://journal.fr/rss.xml'], PAGE_SANS_LIEN);

    const flux = await service.decouvrirFlux('https://journal.fr/rss.xml');

    expect(flux).toMatchObject({ url: 'https://journal.fr/rss.xml', type: 'rss', titre: 'Flux du journal', tags: ['Politique', 'Écologie'] });
    expect(appels).toEqual(['https://journal.fr/rss.xml']);
  });

  it('suit la balise link rel="alternate" de la page (chemin relatif résolu)', async () => {
    simulerReseau(['https://journal.fr/articles/feed'], PAGE_AVEC_LIEN);

    const flux = await service.decouvrirFlux('https://journal.fr');

    expect(flux?.url).toBe('https://journal.fr/articles/feed');
    expect(flux?.type).toBe('rss');
    expect(flux?.titre).toBe('Flux du journal');
    expect(flux?.favicon).toBe('https://journal.fr/favicon.ico');
  });

  it('essaie les chemins usuels quand la page ne déclare aucun flux', async () => {
    const appels = simulerReseau(['https://journal.fr/feed.xml'], PAGE_SANS_LIEN);

    const flux = await service.decouvrirFlux('https://journal.fr/rubrique/politique');

    expect(flux?.url).toBe('https://journal.fr/feed.xml');
    // Les candidats sont essayés depuis la racine du site
    expect(appels).toContain('https://journal.fr/feed');
    expect(appels).toContain('https://journal.fr/rss.xml');
  });

  it('suit les liens <a href> vers un flux, même sur un autre hôte (Blast)', async () => {
    simulerReseau(['https://api.journal.fr/rss.xml'], '<html><head><title>J</title></head><body><a href="https://api.journal.fr/rss.xml">RSS</a></body></html>');

    const flux = await service.decouvrirFlux('https://journal.fr');

    expect(flux?.url).toBe('https://api.journal.fr/rss.xml');
  });

  it('retourne null sans sonder les chemins usuels quand le site est injoignable', async () => {
    const appels = simulerReseau([], null);

    expect(await service.decouvrirFlux('https://journal.fr')).toBeNull();
    // L'URL elle-même puis la page d'accueil : rien d'autre, pour ne pas faire attendre l'utilisateur
    expect(appels).toEqual(['https://journal.fr', 'https://journal.fr']);
  });

  it('retourne null quand la page répond mais qu\'aucun candidat n\'est un flux', async () => {
    simulerReseau([], PAGE_SANS_LIEN);

    expect(await service.decouvrirFlux('https://journal.fr')).toBeNull();
  });
});

describe('ServiceScraping.detecterSource', () => {
  it('décrit le flux découvert avec son URL', async () => {
    const service = new ServiceScraping();
    simulerReseau(['https://journal.fr/articles/feed'], PAGE_AVEC_LIEN);

    const detection = await service.detecterSource('https://journal.fr');

    expect(detection).toEqual({
      url: 'https://journal.fr/articles/feed',
      type: 'rss',
      titre: 'Flux du journal',
      favicon: 'https://journal.fr/favicon.ico',
      urlSite: 'https://journal.fr',
      tags: ['Politique', 'Écologie'],
      joignable: true,
    });
  });

  it('devine le protocole : https d\'abord, puis http si le site ne répond pas en https', async () => {
    const service = new ServiceScraping();
    simulerReseau(['http://vieux-site.fr/rss.xml'], PAGE_SANS_LIEN, { httpsInjoignable: true });

    const detection = await service.detecterSource('vieux-site.fr');

    expect(detection.url).toBe('http://vieux-site.fr/rss.xml');
    expect(detection.type).toBe('rss');
  });

  it('préfère https quand les deux protocoles répondent', async () => {
    const service = new ServiceScraping();
    simulerReseau(['https://journal.fr/feed', 'http://journal.fr/feed'], PAGE_SANS_LIEN);

    const detection = await service.detecterSource('journal.fr');

    expect(detection.url).toBe('https://journal.fr/feed');
  });

  it('signale un site injoignable plutôt que d\'inventer une source', async () => {
    const service = new ServiceScraping();
    simulerReseau([], null);

    const detection = await service.detecterSource('hote-inexistant.example');

    expect(detection.joignable).toBe(false);
    expect(detection.url).toBe('https://hote-inexistant.example');
  });

  it('retombe sur une source HTML avec le titre et le favicon de la page', async () => {
    const service = new ServiceScraping();
    simulerReseau([], '<html><head><title>Site muet</title><link rel="icon" href="/ico.png"></head></html>');

    const detection = await service.detecterSource('https://journal.fr');

    expect(detection).toEqual({ url: 'https://journal.fr', type: 'html', titre: 'Site muet', favicon: 'https://journal.fr/ico.png', tags: [], joignable: true });
  });

  it('lit le favicon sur la page d\'accueil quand l\'utilisateur colle directement un flux', async () => {
    const service = new ServiceScraping();
    simulerReseau(['https://journal.fr/rss.xml'], '<html><head><link rel="icon" href="/ico.png"></head></html>');

    const detection = await service.detecterSource('https://journal.fr/rss.xml');

    expect(detection.favicon).toBe('https://journal.fr/ico.png');
    expect(detection.tags).toEqual(['Politique', 'Écologie']);
  });

  it('ignore un favicon encodé en data: au profit de /favicon.ico', async () => {
    const service = new ServiceScraping();
    simulerReseau([], '<html><head><title>Site</title><link rel="icon" href="data:image/x-icon;base64,AAAB"></head></html>');

    const detection = await service.detecterSource('https://journal.fr');

    expect(detection.favicon).toBe('https://journal.fr/favicon.ico');
  });

  it('reconnaît un flux dont les catégories portent des attributs', async () => {
    const service = new ServiceScraping();
    const flux = `<?xml version="1.0"?><rss version="2.0"><channel><title>Flux</title><link>https://journal.fr</link>
      <item><title>A</title><link>https://journal.fr/a</link><category domain="https://journal.fr/cat">Société</category></item></channel></rss>`;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('/rss.xml') ? flux : '<html></html>', { status: 200 })));

    const detection = await service.detecterSource('https://journal.fr/rss.xml');

    expect(detection.type).toBe('rss');
    expect(detection.tags).toEqual(['Société']);
  });

  it('déduit les tags des mots-clés de la page pour une source HTML', async () => {
    const service = new ServiceScraping();
    simulerReseau([], '<html><head><title>Site</title><meta name="keywords" content="astronomie, espace"></head></html>');

    const detection = await service.detecterSource('https://journal.fr');

    expect(detection.tags).toEqual(['astronomie', 'espace']);
  });
});
