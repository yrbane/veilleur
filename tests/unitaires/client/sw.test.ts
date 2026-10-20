/**
 * Veilleur - Stratégies de cache du service worker
 */

import { describe, it, expect } from 'vitest';
import { choisirStrategie, cleCacheNavigation, PRECACHE, NOM_CACHE } from '@/client/sw/strategies';

const ORIGINE = 'https://news.ex';
const req = (url: string, mode = 'cors', method = 'GET') => ({ url, mode, method });

describe('choisirStrategie', () => {
  it('ignore l\'API, les autres origines et les écritures', () => {
    expect(choisirStrategie(req(`${ORIGINE}/api/v1/articles`), ORIGINE)).toBe('ignorer');
    expect(choisirStrategie(req('https://cdn.autre/x.js'), ORIGINE)).toBe('ignorer');
    expect(choisirStrategie(req(`${ORIGINE}/assets/js/a.js`, 'cors', 'POST'), ORIGINE)).toBe('ignorer');
  });

  it('ne met jamais en cache le service worker ni le manifeste', () => {
    expect(choisirStrategie(req(`${ORIGINE}/sw.js`), ORIGINE)).toBe('reseau');
    expect(choisirStrategie(req(`${ORIGINE}/manifest.webmanifest`), ORIGINE)).toBe('reseau');
  });

  it('sert les ressources empreintées depuis le cache, et le reste réseau d\'abord', () => {
    expect(choisirStrategie(req(`${ORIGINE}/assets/js/main-abc.js`), ORIGINE)).toBe('cache-puis-reseau');
    expect(choisirStrategie(req(`${ORIGINE}/parametres`, 'navigate'), ORIGINE)).toBe('reseau-puis-cache');
    expect(choisirStrategie(req(`${ORIGINE}/icones/icone-192.png`), ORIGINE)).toBe('reseau-puis-cache');
  });

  it('rabat toute navigation hors ligne sur la coque', () => {
    expect(cleCacheNavigation(req(`${ORIGINE}/parametres?x=1`, 'navigate'), ORIGINE)).toBe(`${ORIGINE}/`);
    expect(cleCacheNavigation(req(`${ORIGINE}/favicon.svg`), ORIGINE)).toBe(`${ORIGINE}/favicon.svg`);
    expect(PRECACHE).toContain('/');
    expect(NOM_CACHE).toMatch(/^veilleur-/);
  });
});
