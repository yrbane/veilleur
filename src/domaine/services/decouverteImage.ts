/**
 * Veilleur - Découverte d'une image d'illustration pour un article qui n'en a pas :
 * les flux sans média (Hacker News, certains SPIP) laissent la page de l'article
 * annoncer son image par Open Graph ou Twitter Cards.
 */

import type { MetaOpenGraph, MetaTwitter } from '@/domaine/entites/Article';

export interface MetadonneesPage {
  openGraph: MetaOpenGraph;
  twitter: MetaTwitter;
}

/** Adresse absolue http(s) ou null si la valeur est vide, relative sans base, ou d'un autre protocole */
function normaliserUrlImage(valeur: string | undefined, urlPage: string): string | null {
  const brute = valeur?.trim();
  if (!brute) return null;
  try {
    const url = new URL(brute, urlPage);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Choisit la meilleure image annoncée par la page : og:image d'abord, twitter:image ensuite
 */
export function choisirImageDecouverte(metas: MetadonneesPage, urlPage: string): string | null {
  return normaliserUrlImage(metas.openGraph.image, urlPage) ?? normaliserUrlImage(metas.twitter.image, urlPage);
}

const ID_VIDEO_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Image déductible de l'adresse seule, sans lire la page.
 * YouTube : la page sert un écran de consentement sans Open Graph aux serveurs, mais la vignette est publique.
 */
export function imageConnueDepuisUrl(urlPage: string): string | null {
  let url: URL;
  try {
    url = new URL(urlPage);
  } catch {
    return null;
  }
  const hote = url.hostname.replace(/^(www|m)\./, '');
  let idVideo: string | null = null;
  if (hote === 'youtube.com' && url.pathname === '/watch') idVideo = url.searchParams.get('v');
  else if (hote === 'youtu.be') idVideo = url.pathname.slice(1).split('/')[0] ?? null;
  if (!idVideo || !ID_VIDEO_YOUTUBE.test(idVideo)) return null;
  return `https://i.ytimg.com/vi/${idVideo}/hqdefault.jpg`;
}
