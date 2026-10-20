/**
 * Veilleur - Extraction des images des items RSS
 * Les médias exposent l'image de plusieurs façons : media:content direct (Mediapart),
 * media:content enveloppé dans media:group (Blast), media:thumbnail, enclosure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/scraping/validationUrl', () => ({
  validerUrlScraping: vi.fn().mockResolvedValue({ valide: true, url: 'https://exemple.fr/flux' }),
  normaliserUrlScraping: vi.fn((url: string) => url),
}));
vi.mock('@/config/environnement', () => ({
  env: { SCRAPING_USER_AGENT: 'Test', SCRAPING_TIMEOUT_MS: 1000, SCRAPING_RATE_LIMIT_MS: 0 },
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerScraping: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ServiceScraping } from '@/infrastructure/scraping/ServiceScraping';

const FLUX = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Flux de test</title>
    <item>
      <title>Direct</title>
      <link>https://exemple.fr/direct</link>
      <pubDate>Mon, 20 Oct 2026 10:00:00 +0200</pubDate>
      <media:content url="https://static.exemple.fr/direct.jpg" medium="image"/>
    </item>
    <item>
      <title>Groupe</title>
      <link>https://exemple.fr/groupe</link>
      <pubDate>Mon, 20 Oct 2026 09:00:00 +0200</pubDate>
      <media:group>
        <media:content url="https://static.exemple.fr/groupe.webp" height="152" width="270"/>
      </media:group>
    </item>
    <item>
      <title>Miniature</title>
      <link>https://exemple.fr/miniature</link>
      <media:thumbnail url="https://static.exemple.fr/miniature.png"/>
    </item>
    <item>
      <title>Sans image</title>
      <link>https://exemple.fr/sans-image</link>
      <description>Rien à voir</description>
    </item>
  </channel>
</rss>`;

describe('ServiceScraping - images des items RSS', () => {
  let service: ServiceScraping;

  beforeEach(() => {
    service = new ServiceScraping();
    // Parser réel (customFields compris), mais sur un XML local plutôt qu'une URL
    const parser = (service as unknown as { rssParser: { parseURL: unknown; parseString: (xml: string) => Promise<unknown> } }).rssParser;
    parser.parseURL = () => parser.parseString(FLUX);
  });

  it('lit media:content directement sous l\'item (Mediapart)', async () => {
    const { articles } = await service.extraireRss('https://exemple.fr/flux');
    expect(articles.find(a => a.titre === 'Direct')?.urlImage).toBe('https://static.exemple.fr/direct.jpg');
  });

  it('lit media:content enveloppé dans media:group (Blast)', async () => {
    const { articles } = await service.extraireRss('https://exemple.fr/flux');
    expect(articles.find(a => a.titre === 'Groupe')?.urlImage).toBe('https://static.exemple.fr/groupe.webp');
  });

  it('lit media:thumbnail', async () => {
    const { articles } = await service.extraireRss('https://exemple.fr/flux');
    expect(articles.find(a => a.titre === 'Miniature')?.urlImage).toBe('https://static.exemple.fr/miniature.png');
  });

  it('retourne null sans image', async () => {
    const { articles } = await service.extraireRss('https://exemple.fr/flux');
    expect(articles.find(a => a.titre === 'Sans image')?.urlImage).toBeNull();
  });
});
