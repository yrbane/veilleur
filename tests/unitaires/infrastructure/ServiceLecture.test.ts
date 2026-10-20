/**
 * Veilleur - Lecture en place : extraction du contenu principal d'un article
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/scraping/validationUrl', () => ({
  validerUrlScraping: vi.fn((url: string) =>
    url.includes('interne') ? { valide: false, erreur: 'bloquée' } : { valide: true, urlNormalisee: url }),
  validerRedirection: vi.fn((_o: string, url: string) => ({ valide: true, urlNormalisee: url })),
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerScraping: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ServiceLecture } from '@/infrastructure/lecture/ServiceLecture';

const PARAGRAPHE = 'Le conseil municipal a voté hier soir la rénovation complète du quartier de la gare, un chantier de trois ans. ';
const PAGE = `<html><head><title>Rénovation de la gare | Journal</title>
  <meta name="author" content="Jeanne Dupont"></head>
  <body><nav><a href="/">Accueil</a></nav>
  <article><h1>Rénovation de la gare</h1>
    <p>${PARAGRAPHE.repeat(3)}<a href="/dossier" onclick="alert(1)">le dossier</a></p>
    <p>${PARAGRAPHE.repeat(3)}</p>
    <figure><img src="https://journal.fr/img/gare.jpg" alt="La gare"><figcaption>La gare</figcaption></figure>
    <img src="http://journal.fr/img/http.jpg" alt="non https">
    <p>${PARAGRAPHE.repeat(3)}<script>document.cookie</script><span style="color:red">fin</span></p>
  </article><footer>Mentions légales</footer></body></html>`;

function simulerReseau(reponses: Record<string, { corps?: string; type?: string; statut?: number; taille?: number }>): { fetchImpl: typeof fetch; appels: string[] } {
  const appels: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    appels.push(url);
    const r = reponses[url];
    if (!r) throw new Error('réseau');
    const headers = new Headers({ 'content-type': r.type ?? 'text/html; charset=utf-8' });
    if (r.taille) headers.set('content-length', String(r.taille));
    return new Response(r.corps ?? '', { status: r.statut ?? 200, headers });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, appels };
}

describe('ServiceLecture', () => {
  const cache = { obtenir: vi.fn(), stocker: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    cache.obtenir.mockResolvedValue(null);
  });

  it('extrait le contenu principal, nettoyé, avec titre, auteur et durée de lecture', async () => {
    const { fetchImpl } = simulerReseau({ 'https://journal.fr/gare': { corps: PAGE } });

    const contenu = await new ServiceLecture({ fetchImpl, seuilCaracteres: 50 }).extraire('art-1', 'https://journal.fr/gare');

    expect(contenu).not.toBeNull();
    expect(contenu!.titre).toBe('Rénovation de la gare');
    expect(contenu!.auteur).toBe('Jeanne Dupont');
    expect(contenu!.contenuHtml).toContain('rénovation complète du quartier');
    expect(contenu!.contenuHtml).not.toContain('<script');
    expect(contenu!.contenuHtml).not.toContain('onclick');
    expect(contenu!.contenuHtml).not.toContain('style=');
    expect(contenu!.contenuHtml).not.toContain('Mentions légales');
    expect(contenu!.nombreMots).toBeGreaterThan(100);
    expect(contenu!.dureeLectureMin).toBeGreaterThanOrEqual(1);
  });

  it('résout les liens en absolu, les ouvre dans un nouvel onglet et ne garde que les images https', async () => {
    const { fetchImpl } = simulerReseau({ 'https://journal.fr/gare': { corps: PAGE } });

    const contenu = await new ServiceLecture({ fetchImpl, seuilCaracteres: 50 }).extraire('art-1', 'https://journal.fr/gare');

    expect(contenu!.contenuHtml).toMatch(/<a href="https:\/\/journal\.fr\/dossier"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(contenu!.contenuHtml).toContain('src="https://journal.fr/img/gare.jpg"');
    expect(contenu!.contenuHtml).not.toContain('http.jpg');
  });

  it('refuse une URL bloquée par la validation anti-SSRF sans appel réseau', async () => {
    const { fetchImpl, appels } = simulerReseau({});

    expect(await new ServiceLecture({ fetchImpl }).extraire('art-1', 'https://interne.local/page')).toBeNull();
    expect(appels).toEqual([]);
  });

  it('abandonne une page trop volumineuse ou qui n\'est pas du HTML', async () => {
    const { fetchImpl } = simulerReseau({
      'https://journal.fr/gros': { corps: PAGE, taille: 10_000_000 },
      'https://journal.fr/pdf': { corps: PAGE, type: 'application/pdf' },
    });
    const service = new ServiceLecture({ fetchImpl, seuilCaracteres: 50, tailleMaxOctets: 1_000_000 });

    expect(await service.extraire('a', 'https://journal.fr/gros')).toBeNull();
    expect(await service.extraire('b', 'https://journal.fr/pdf')).toBeNull();
  });

  it('retourne null quand la page n\'a pas de contenu lisible', async () => {
    const { fetchImpl } = simulerReseau({ 'https://journal.fr/vide': { corps: '<html><body><nav>menu</nav></body></html>' } });

    expect(await new ServiceLecture({ fetchImpl }).extraire('art-1', 'https://journal.fr/vide')).toBeNull();
  });

  it('sert le cache quand il est garni et y range une extraction réussie', async () => {
    const { fetchImpl, appels } = simulerReseau({ 'https://journal.fr/gare': { corps: PAGE } });
    const service = new ServiceLecture({ fetchImpl, seuilCaracteres: 50, serviceCache: cache, dureeCacheS: 3600 });

    await service.extraire('art-1', 'https://journal.fr/gare');
    expect(cache.stocker).toHaveBeenCalledWith('articles:lecture:art-1', expect.objectContaining({ titre: 'Rénovation de la gare' }), { ttl: 3600 });

    cache.obtenir.mockResolvedValue({ titre: 'En cache', contenuHtml: '<p>x</p>', extrait: null, auteur: null, nombreMots: 1, dureeLectureMin: 1 });
    expect((await service.extraire('art-1', 'https://journal.fr/gare'))!.titre).toBe('En cache');
    expect(appels).toHaveLength(1);
  });
});
