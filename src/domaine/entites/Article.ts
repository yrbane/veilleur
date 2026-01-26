/**
 * Veilleur - Entité Article
 * Représente un article extrait d'une source
 */

import { z } from 'zod';

/**
 * Schéma des métadonnées Open Graph
 */
export const schemaMetaOpenGraph = z.object({
  titre: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  type: z.string().optional(),
  url: z.string().url().optional(),
  siteName: z.string().optional(),
});

export type MetaOpenGraph = z.infer<typeof schemaMetaOpenGraph>;

/**
 * Schéma des métadonnées Twitter Cards
 */
export const schemaMetaTwitter = z.object({
  titre: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  card: z.string().optional(),
  site: z.string().optional(),
});

export type MetaTwitter = z.infer<typeof schemaMetaTwitter>;

/**
 * Schéma de validation d'un article
 */
export const schemaArticle = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  titre: z.string().min(1).max(512),
  lien: z.string().url(),
  datePublication: z.date(),
  resume: z.string().max(500).nullable(),
  urlImage: z.string().url().nullable(),
  auteur: z.string().max(255).nullable(),
  metaOpenGraph: schemaMetaOpenGraph.default({}),
  metaTwitter: schemaMetaTwitter.default({}),
  hashContenu: z.string().length(32).nullable(),
  dateExtraction: z.date(),
});

export type Article = z.infer<typeof schemaArticle>;

/**
 * Article avec informations de source pour affichage
 */
export interface ArticleAvecSource extends Article {
  source: {
    nom: string;
    urlFavicon: string | null;
  };
}

/**
 * Données brutes d'un article extrait (avant enrichissement)
 */
export interface ArticleBrut {
  titre: string;
  lien: string;
  datePublication: Date | null;
  resume: string | null;
  urlImage: string | null;
  auteur: string | null;
}

/**
 * Longueur maximale du résumé
 */
export const MAX_LONGUEUR_RESUME = 200;

/**
 * Tronque un résumé à la longueur maximale
 */
export function tronquerResume(resume: string | null): string | null {
  if (!resume) return null;
  if (resume.length <= MAX_LONGUEUR_RESUME) return resume;
  return resume.substring(0, MAX_LONGUEUR_RESUME - 3) + '...';
}

/**
 * Génère un hash de contenu pour déduplication
 */
export async function hashContenu(article: ArticleBrut): Promise<string> {
  const contenu = `${article.titre}|${article.lien}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(contenu);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Tronquer à 32 caractères pour compatibilité avec le schéma BDD
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

/**
 * Sélectionne la meilleure image disponible
 */
export function selectionnerImage(
  article: ArticleBrut,
  meta: { openGraph?: MetaOpenGraph; twitter?: MetaTwitter },
): string | null {
  // Priorité : Open Graph > Twitter > RSS/HTML
  return (
    meta.openGraph?.image ??
    meta.twitter?.image ??
    article.urlImage ??
    null
  );
}

/**
 * Sélectionne le meilleur résumé disponible
 */
export function selectionnerResume(
  article: ArticleBrut,
  meta: { openGraph?: MetaOpenGraph; twitter?: MetaTwitter },
): string | null {
  // Priorité : Open Graph > Twitter > RSS/HTML
  const resume =
    meta.openGraph?.description ??
    meta.twitter?.description ??
    article.resume ??
    null;
  return tronquerResume(resume);
}
