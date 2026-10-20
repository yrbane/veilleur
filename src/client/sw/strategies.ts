/**
 * Veilleur - Stratégies de cache du service worker (fonctions pures, testables)
 */

export const NOM_CACHE = 'veilleur-coque-v1';

/** Fichiers mis en cache dès l'installation : la coque de l'application */
export const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icones/icone-192.png'];

export type Strategie =
  /** Laisser le navigateur faire (API, autres origines, méthodes non GET) */
  | 'ignorer'
  /** Toujours le réseau, jamais de cache (service worker, manifeste) */
  | 'reseau'
  /** Ressources empreintées : le cache d'abord, le réseau sinon */
  | 'cache-puis-reseau'
  /** Le réseau d'abord, le cache en secours (navigation, images statiques) */
  | 'reseau-puis-cache';

export interface RequeteMinimale {
  url: string;
  method: string;
  mode: string;
}

export function choisirStrategie(requete: RequeteMinimale, origine: string): Strategie {
  if (requete.method !== 'GET') return 'ignorer';
  const url = new URL(requete.url);
  if (url.origin !== origine) return 'ignorer';
  if (url.pathname.startsWith('/api/')) return 'ignorer';
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return 'reseau';
  if (requete.mode === 'navigate') return 'reseau-puis-cache';
  if (url.pathname.startsWith('/assets/')) return 'cache-puis-reseau';
  return 'reseau-puis-cache';
}

/** En mode navigation, la page servie hors ligne est toujours la coque « / » */
export function cleCacheNavigation(requete: RequeteMinimale, origine: string): string {
  return requete.mode === 'navigate' ? `${origine}/` : requete.url;
}
