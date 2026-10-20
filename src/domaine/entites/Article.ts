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
  // Mots-clés extraits automatiquement (classement sans intervention de l'utilisateur)
  motsCles: z.array(z.string().max(50)).optional(),
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

/**
 * Tris disponibles pour le fil d'actualités
 */
export const TRIS_ARTICLES = ['date', 'note', 'titre', 'source'] as const;
export type TriArticles = (typeof TRIS_ARTICLES)[number];
export type OrdreTri = 'asc' | 'desc';

/**
 * Résout un tri demandé (valeurs inconnues → date, ordre par défaut selon le champ :
 * croissant pour les textes, décroissant pour la date et la note)
 */
export function resoudreTri(tri?: string | null, ordre?: string | null): { tri: TriArticles; ordre: OrdreTri } {
  const triValide: TriArticles = (TRIS_ARTICLES as readonly string[]).includes(tri ?? '') ? (tri as TriArticles) : 'date';
  const ordreDefaut: OrdreTri = triValide === 'titre' || triValide === 'source' ? 'asc' : 'desc';
  const ordreValide: OrdreTri = ordre === 'asc' || ordre === 'desc' ? ordre : ordreDefaut;
  return { tri: triValide, ordre: ordreValide };
}

/**
 * Note d'un article par un utilisateur : entier de 1 à 5
 */
export const NOTE_ARTICLE_MIN = 1;
export const NOTE_ARTICLE_MAX = 5;

export function estNoteValide(note: unknown): note is number {
  return typeof note === 'number' && Number.isInteger(note) && note >= NOTE_ARTICLE_MIN && note <= NOTE_ARTICLE_MAX;
}

/**
 * Annotations personnelles d'un utilisateur sur un article
 */
export interface AnnotationArticle {
  note: number | null;
  favori: boolean;
  /** L'utilisateur a ouvert ou marqué l'article comme lu */
  lu: boolean;
  /** Mis de côté dans la liste de lecture */
  aLire: boolean;
}

/**
 * Article plébiscité par la communauté (favoris et notes des derniers jours)
 */
export interface ArticleApprecie {
  id: string;
  titre: string;
  lien: string;
  datePublication: Date;
  source: { id: string; nom: string; urlFavicon: string | null };
  nombreFavoris: number;
  nombreNotes: number;
  noteMoyenne: number | null;
}

/**
 * Annotation accompagnée de l'article, telle qu'exportée (JSON / CSV)
 */
export interface AnnotationExportee {
  articleId: string;
  titre: string;
  lien: string;
  source: string;
  datePublication: Date;
  note: number | null;
  favori: boolean;
  aLire: boolean;
  lu: boolean;
  dateMiseAJour: Date;
}

/**
 * Mot-clé présent dans le fil d'un utilisateur, avec le nombre d'articles qui le portent
 */
export interface MotCleFil {
  mot: string;
  nombreArticles: number;
}
