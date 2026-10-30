/**
 * Veilleur - Tests du message affiché après une synchronisation manuelle de source
 */

import { describe, it, expect } from 'vitest';
import { messageSynchronisation } from '@/client/utils/messageSynchro';

describe('messageSynchronisation', () => {
  it('annonce les nouveaux articles', () => {
    expect(messageSynchronisation({ nouveauxArticles: 1, articlesIgnores: 0, totalArticles: 1 })).toBe('1 nouvel article');
    expect(messageSynchronisation({ nouveauxArticles: 12, articlesIgnores: 3, totalArticles: 184 })).toBe('12 nouveaux articles');
  });

  it('rassure quand rien de neuf mais que le fil contient déjà les articles', () => {
    expect(messageSynchronisation({ nouveauxArticles: 0, articlesIgnores: 50, totalArticles: 184 })).toBe('Source à jour : 184 articles déjà dans votre fil');
    expect(messageSynchronisation({ nouveauxArticles: 0, articlesIgnores: 1, totalArticles: 1 })).toBe('Source à jour : 1 article déjà dans votre fil');
  });

  it('signale un flux vide', () => {
    expect(messageSynchronisation({ nouveauxArticles: 0, articlesIgnores: 0, totalArticles: 0 })).toBe('Aucun article trouvé dans ce flux');
  });
});
