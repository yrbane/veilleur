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
