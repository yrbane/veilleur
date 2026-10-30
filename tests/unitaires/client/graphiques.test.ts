/**
 * Veilleur - Tests des utilitaires de graphiques du tableau de bord (palette, formats, options)
 */

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { palette, formatOctets, formatDuree, libellesJours, optionsCommunes } from '@/client/utils/graphiques';

describe('palette', () => {
  it('donne autant de couleurs oklch distinctes que demandé', () => {
    const couleurs = palette(6);
    expect(couleurs).toHaveLength(6);
    expect(new Set(couleurs).size).toBe(6);
    expect(couleurs[0]).toMatch(/^oklch\(/);
  });

  it('accepte une opacité', () => {
    expect(palette(1, 0.4)[0]).toMatch(/\/ 0\.4\)$/);
  });
});

describe('formatOctets', () => {
  it('choisit l\'unité lisible', () => {
    expect(formatOctets(0)).toBe('0 o');
    expect(formatOctets(2048)).toBe('2 Ko');
    expect(formatOctets(5 * 1024 * 1024)).toBe('5 Mo');
    expect(formatOctets(1.5 * 1024 ** 3)).toBe('1,5 Go');
  });
});

describe('formatDuree', () => {
  it('écrit une durée en jours, heures, minutes', () => {
    expect(formatDuree(59)).toBe('moins d\'une minute');
    expect(formatDuree(3600 * 5 + 60 * 7)).toBe('5 h 7 min');
    expect(formatDuree(86400 * 3 + 3600 * 2)).toBe('3 j 2 h');
  });
});

describe('libellesJours', () => {
  it('abrège les jours en français', () => {
    expect(libellesJours(['2026-10-01', '2026-10-30'])).toEqual(['1 oct.', '30 oct.']);
  });
});

describe('optionsCommunes', () => {
  it('lit les couleurs du thème et désactive l\'animation', () => {
    const options = optionsCommunes();
    expect(options.animation).toBe(false);
    expect(options.plugins?.legend?.labels?.color).toBeDefined();
  });
});
