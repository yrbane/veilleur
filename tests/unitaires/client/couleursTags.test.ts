// @vitest-environment jsdom
/**
 * Veilleur - Couleur des tags
 * Chaque tag reçoit une teinte stable dérivée de son nom, prise sur une roue de teintes
 * régulièrement espacées à partir de la teinte primaire du thème : deux tags différents
 * se distinguent, le même tag garde sa couleur partout, et l'ensemble reste harmonieux.
 */

import { describe, it, expect } from 'vitest';
import { teinteTag, colorerTag, normaliserNomTag, NOMBRE_TEINTES, TEINTE_BASE } from '@/client/utils/couleursTags';

describe('teinteTag', () => {
  it('est déterministe : même nom, même teinte', () => {
    expect(teinteTag('Écologie')).toBe(teinteTag('Écologie'));
  });

  it('ignore la casse, les accents et les espaces superflus', () => {
    expect(teinteTag('  Écologie ')).toBe(teinteTag('ecologie'));
    expect(normaliserNomTag('  Sciences  Humaines ')).toBe('sciences humaines');
  });

  it('retourne une teinte entière de la roue, décalée de la teinte primaire par pas réguliers', () => {
    const pas = 360 / NOMBRE_TEINTES;
    for (const nom of ['Politique', 'Sciences', 'Tech', 'International', 'Actualité', 'Société']) {
      const teinte = teinteTag(nom);
      expect(Number.isInteger(teinte)).toBe(true);
      expect(teinte).toBeGreaterThanOrEqual(0);
      expect(teinte).toBeLessThan(360);
      expect(((teinte - TEINTE_BASE) % 360 + 360) % 360 % pas).toBe(0);
    }
  });

  it('répartit des noms courants sur des teintes distinctes', () => {
    const noms = ['Politique', 'Sciences', 'Écologie', 'Tech', 'International', 'Actualité', 'Culture', 'Économie'];
    const distinctes = new Set(noms.map(teinteTag));
    expect(distinctes.size).toBeGreaterThanOrEqual(6);
  });

  it('accepte un nom vide sans planter', () => {
    expect(teinteTag('')).toBe(TEINTE_BASE);
  });
});

describe('colorerTag', () => {
  it('pose la classe et la variable CSS de teinte sur l\'élément, et le retourne', () => {
    const element = document.createElement('span');

    expect(colorerTag(element, 'Écologie')).toBe(element);

    expect(element.classList.contains('tag-colore')).toBe(true);
    expect(element.style.getPropertyValue('--tag-teinte')).toBe(String(teinteTag('Écologie')));
  });
});
