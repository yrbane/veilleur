// @vitest-environment jsdom
/**
 * Veilleur - Thème d'affichage : application, mémorisation et bascule depuis l'en-tête
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { appliquerTheme, themeEnregistre, themeSuivant, iconeTheme, libelleTheme } from '@/client/utils/theme';

describe('thème', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('pose data-theme="dark" et mémorise le choix', () => {
    appliquerTheme('sombre');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(themeEnregistre()).toBe('sombre');
  });

  it('retire l\'attribut en mode automatique', () => {
    appliquerTheme('clair');
    appliquerTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeEnregistre()).toBe('auto');
  });

  it('ignore une valeur inconnue en stockage', () => {
    localStorage.setItem('theme', 'violet');
    expect(themeEnregistre()).toBe('auto');
  });

  it('bascule auto → clair → sombre → auto', () => {
    expect(themeSuivant('auto')).toBe('clair');
    expect(themeSuivant('clair')).toBe('sombre');
    expect(themeSuivant('sombre')).toBe('auto');
  });

  it('décrit chaque thème par une icône et un libellé', () => {
    expect(iconeTheme('auto')).toBe('brightness_auto');
    expect(iconeTheme('clair')).toBe('light_mode');
    expect(iconeTheme('sombre')).toBe('dark_mode');
    expect(libelleTheme('sombre')).toContain('sombre');
  });
});
