/**
 * Veilleur - Mots-clés tendance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceTendances } from '@/domaine/services/ServiceTendances';

describe('ServiceTendances', () => {
  const depot = { compterMotsCles: vi.fn() };
  const cache = { obtenir: vi.fn(), stocker: vi.fn() };
  const maintenant = new Date('2026-10-21T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    cache.obtenir.mockResolvedValue(null);
  });

  it('classe les mots par hausse relative, puis par volume récent', async () => {
    depot.compterMotsCles
      .mockResolvedValueOnce([
        { mot: 'budget', nombreArticles: 10 },
        { mot: 'grève', nombreArticles: 6 },
        { mot: 'météo', nombreArticles: 6 },
        { mot: '—', nombreArticles: 40 },
        { mot: 'rare', nombreArticles: 1 },
      ])
      .mockResolvedValueOnce([
        { mot: 'budget', nombreArticles: 70 },
        { mot: 'météo', nombreArticles: 7 },
      ]);

    const tendances = await new ServiceTendances(depot).lister({ utilisateurId: 'u1', maintenant });

    expect(tendances.map(t => t.mot)).toEqual(['grève', 'météo', 'budget']);
    expect(tendances[0]).toEqual({ mot: 'grève', nombreRecents: 6, nombreReference: 0, score: 6 });
    expect(tendances[1]).toEqual({ mot: 'météo', nombreRecents: 6, nombreReference: 7, score: 3 });
    expect(tendances[2]!.score).toBeCloseTo(10 / 11, 2);
  });

  it('interroge les bonnes fenêtres : 24 h récentes puis les 7 jours précédents, restreints aux candidats', async () => {
    depot.compterMotsCles.mockResolvedValueOnce([{ mot: 'a', nombreArticles: 3 }]).mockResolvedValueOnce([]);

    await new ServiceTendances(depot).lister({ utilisateurId: 'u1', maintenant, limite: 5 });

    expect(depot.compterMotsCles).toHaveBeenNthCalledWith(1, {
      utilisateurId: 'u1',
      depuis: new Date('2026-10-20T12:00:00Z'),
      jusqua: maintenant,
      limite: 60,
    });
    expect(depot.compterMotsCles).toHaveBeenNthCalledWith(2, {
      utilisateurId: 'u1',
      depuis: new Date('2026-10-13T12:00:00Z'),
      jusqua: new Date('2026-10-20T12:00:00Z'),
      mots: ['a'],
    });
  });

  it('retourne une liste vide sans seconde requête quand rien ne ressort', async () => {
    depot.compterMotsCles.mockResolvedValueOnce([{ mot: 'seul', nombreArticles: 1 }]);

    expect(await new ServiceTendances(depot).lister({ maintenant })).toEqual([]);
    expect(depot.compterMotsCles).toHaveBeenCalledTimes(1);
  });

  it('met le résultat en cache dix minutes, par portée, et le relit', async () => {
    depot.compterMotsCles.mockResolvedValueOnce([{ mot: 'a', nombreArticles: 3 }]).mockResolvedValueOnce([]);
    const service = new ServiceTendances(depot, cache);

    const tendances = await service.lister({ maintenant });
    expect(cache.stocker).toHaveBeenCalledWith('articles:tendances:global:10', tendances, { ttl: 600 });

    cache.obtenir.mockResolvedValue([{ mot: 'cache', nombreRecents: 2, nombreReference: 0, score: 2 }]);
    expect((await service.lister({ utilisateurId: 'u1', maintenant }))[0]!.mot).toBe('cache');
    expect(cache.obtenir).toHaveBeenLastCalledWith('articles:tendances:u1:10');
    expect(depot.compterMotsCles).toHaveBeenCalledTimes(2);
  });
});
