/**
 * Veilleur - Entité Source
 * Représente une source d'actualités (RSS, Atom ou site web)
 */

import { z } from 'zod';

/**
 * Types de sources supportés
 */
export const TypesSource = ['rss', 'atom', 'html'] as const;
export type TypeSource = (typeof TypesSource)[number];

/**
 * Statuts possibles d'une source
 */
export const StatutsSource = ['active', 'inactive', 'erreur'] as const;
export type StatutSource = (typeof StatutsSource)[number];

/**
 * Schéma de validation d'une source
 */
export const schemaSource = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  nom: z.string().min(1).max(255),
  typeSource: z.enum(TypesSource),
  statut: z.enum(StatutsSource).default('active'),
  urlFavicon: z.string().url().nullable(),
  dateCreation: z.date(),
  dateDerniereSynchro: z.date().nullable(),
  hashUrlNormalise: z.string().length(32).nullable(),
  nombreEchecs: z.number().int().min(0).default(0),
});

export type Source = z.infer<typeof schemaSource>;

/**
 * Schéma pour l'ajout d'une source
 */
export const schemaAjoutSource = z.object({
  url: z.string().url('URL invalide'),
  nom: z.string().min(1).max(255).optional(),
});

export type AjoutSource = z.infer<typeof schemaAjoutSource>;

/**
 * Source avec informations utilisateur
 */
export interface SourceUtilisateur extends Source {
  dateAjout: Date;
  note: number | null;
  estEnPause: boolean;
  tags: { id: string; nom: string; slug: string }[];
}

/**
 * Seuil d'échecs avant marquage comme erreur
 */
export const SEUIL_ECHECS_SOURCE = 3;

/**
 * Vérifie si une source doit être marquée en erreur
 */
export function doitEtreEnErreur(source: Source): boolean {
  return source.nombreEchecs >= SEUIL_ECHECS_SOURCE;
}

/**
 * Normalise une URL pour comparaison
 */
export function normaliserUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Retirer le protocole, www, et les paramètres de tracking
    let normalise = parsed.hostname.replace(/^www\./, '');
    normalise += parsed.pathname.replace(/\/$/, '');
    return normalise.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Génère un hash SHA-256 d'une URL normalisée (tronqué à 32 chars)
 */
export async function hashUrl(url: string): Promise<string> {
  const normalise = normaliserUrl(url);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalise);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Tronquer à 32 caractères pour compatibilité avec le schéma BDD
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}
