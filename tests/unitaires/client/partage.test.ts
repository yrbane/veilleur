// @vitest-environment jsdom
/**
 * Veilleur - Partage d'un article
 */

import { describe, it, expect, vi } from 'vitest';
import { partagerArticle } from '@/client/utils/partage';

const article = { titre: 'Titre', lien: 'https://j.fr/a' };

describe('partagerArticle', () => {
  it('utilise le partage natif quand il existe', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await partagerArticle(article, { share, clipboard: { writeText: vi.fn() } } as never)).toBe('partage');
    expect(share).toHaveBeenCalledWith({ title: 'Titre', url: 'https://j.fr/a' });
  });

  it('signale l\'annulation sans copier', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    const writeText = vi.fn();
    expect(await partagerArticle(article, { share, clipboard: { writeText } } as never)).toBe('annule');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copie le lien sans partage natif, et dit quand même cela échoue', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await partagerArticle(article, { clipboard: { writeText } } as never)).toBe('copie');
    expect(writeText).toHaveBeenCalledWith('https://j.fr/a');
    expect(await partagerArticle(article, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('refusé')) } } as never)).toBe('impossible');
  });
});
