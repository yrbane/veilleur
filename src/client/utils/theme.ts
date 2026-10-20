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
}

export function themeEnregistre(): Theme {
  try {
    const valeur = localStorage.getItem(CLE_STOCKAGE);
    return valeur === 'clair' || valeur === 'sombre' ? valeur : 'auto';
  } catch {
    return 'auto';
  }
}
