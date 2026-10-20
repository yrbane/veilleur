/**
 * Veilleur - Favicons servis par Veilleur
 * Le serveur met les favicons en cache : le navigateur ne contacte jamais le site source.
 */

export function urlFaviconLocale(source: { id: string; urlFavicon?: string | null }): string | null {
  return source.urlFavicon ? `/api/v1/favicons/${encodeURIComponent(source.id)}` : null;
}
