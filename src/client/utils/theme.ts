/**
 * Veilleur - Thème d'affichage
 * Lunar Aurora lit l'attribut data-theme de <html> (light / dark) ; sans attribut,
 * il suit la préférence du système.
 */

export type Theme = 'clair' | 'sombre' | 'auto';

const CLE_STOCKAGE = 'theme';

export function appliquerTheme(theme: Theme): void {
  const html = document.documentElement;
  if (theme === 'auto') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme === 'sombre' ? 'dark' : 'light');
  }
  try {
    localStorage.setItem(CLE_STOCKAGE, theme);
  } catch {
    // Stockage indisponible (navigation privée) : le thème vaut pour la session
  }
  document.dispatchEvent(new CustomEvent<Theme>('veilleur:theme', { detail: theme }));
}

export function themeEnregistre(): Theme {
  try {
    const valeur = localStorage.getItem(CLE_STOCKAGE);
    return valeur === 'clair' || valeur === 'sombre' ? valeur : 'auto';
  } catch {
    return 'auto';
  }
}

const ORDRE_BASCULE: Theme[] = ['auto', 'clair', 'sombre'];

/** Thème suivant quand on clique sur le bouton de l'en-tête */
export function themeSuivant(theme: Theme): Theme {
  return ORDRE_BASCULE[(ORDRE_BASCULE.indexOf(theme) + 1) % ORDRE_BASCULE.length] ?? 'auto';
}

export function iconeTheme(theme: Theme): string {
  return { auto: 'brightness_auto', clair: 'light_mode', sombre: 'dark_mode' }[theme];
}

export function libelleTheme(theme: Theme): string {
  return { auto: 'Thème automatique (système)', clair: 'Thème clair', sombre: 'Thème sombre' }[theme];
}
