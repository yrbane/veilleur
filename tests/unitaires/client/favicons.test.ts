/**
 * Veilleur - Adresse locale des favicons côté client
 */

import { describe, it, expect } from 'vitest';
import { urlFaviconLocale } from '@/client/utils/favicons';

describe('urlFaviconLocale', () => {
  it('pointe vers le cache du serveur quand la source a un favicon', () => {
    expect(urlFaviconLocale({ id: 'abc', urlFavicon: 'https://journal.fr/favicon.ico' })).toBe('/api/v1/favicons/abc');
  });

  it('renvoie null sans favicon connu', () => {
    expect(urlFaviconLocale({ id: 'abc', urlFavicon: null })).toBeNull();
    expect(urlFaviconLocale({ id: 'abc' })).toBeNull();
  });
});
