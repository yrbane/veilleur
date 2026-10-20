// @vitest-environment jsdom
/**
 * Veilleur - Bloc des mots-clés tendance
 */

import { describe, it, expect, vi } from 'vitest';
import { creerBlocTendances } from '@/client/composants/Tendances';

describe('creerBlocTendances', () => {
  it('reste masqué sans tendance, puis affiche une puce par mot avec le nombre récent', async () => {
    const onChoix = vi.fn();
    const charger = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { mot: 'grève', nombreRecents: 6, nombreReference: 0, score: 6 },
        { mot: 'budget', nombreRecents: 10, nombreReference: 70, score: 0.9 },
      ]);
    const bloc = creerBlocTendances({ titre: 'Tendances', charger, onChoix });

    await bloc.rafraichir();
    expect(bloc.classList.contains('masque')).toBe(true);

    await bloc.rafraichir();
    expect(bloc.classList.contains('masque')).toBe(false);
    const puces = [...bloc.querySelectorAll('.chip-tendance')];
    expect(puces.map(p => p.getAttribute('data-mot'))).toEqual(['grève', 'budget']);
    expect(puces[0]!.classList.contains('forte')).toBe(true);
    expect(puces[1]!.classList.contains('forte')).toBe(false);
    expect(puces[0]!.querySelector('.chip-tendance-nombre')?.textContent).toBe('6');

    (puces[1] as HTMLButtonElement).click();
    expect(onChoix).toHaveBeenCalledWith('budget');
  });

  it('se masque quand le chargement échoue', async () => {
    const bloc = creerBlocTendances({ titre: 'T', charger: vi.fn().mockRejectedValue(new Error('x')), onChoix: vi.fn() });
    await bloc.rafraichir();
    expect(bloc.classList.contains('masque')).toBe(true);
  });
});
