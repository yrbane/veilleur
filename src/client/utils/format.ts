/**
 * Veilleur - Utilitaires de formatage
 * Dates, nombres, textes
 */

/**
 * Formate une date relative (il y a X minutes/heures/jours)
 */
export function formatDateRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHeures = Math.floor(diffMinutes / 60);
  const diffJours = Math.floor(diffHeures / 24);

  if (diffMinutes < 1) {
    return "À l'instant";
  }

  if (diffMinutes < 60) {
    return `Il y a ${diffMinutes} min`;
  }

  if (diffHeures < 24) {
    return `Il y a ${diffHeures} h`;
  }

  if (diffJours < 7) {
    return `Il y a ${diffJours} j`;
  }

  return formatDate(dateStr);
}

/**
 * Formate une date complète
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Formate un nombre avec séparateurs
 */
export function formatNombre(n: number): string {
  return n.toLocaleString('fr-FR');
}

/**
 * Tronque un texte à une longueur maximale
 */
export function tronquer(texte: string, maxLength: number): string {
  if (texte.length <= maxLength) {
    return texte;
  }
  return texte.slice(0, maxLength - 3) + '...';
}

/**
 * Extrait le domaine d'une URL
 */
export function extraireDomaine(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Échappe le HTML pour éviter les injections XSS
 */
export function echapperHtml(texte: string): string {
  const div = document.createElement('div');
  div.textContent = texte;
  return div.innerHTML;
}
