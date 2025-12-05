/**
 * Veilleur - Entité Tag
 * Représente une étiquette pour catégoriser les sources
 */

import { z } from 'zod';

/**
 * Schéma de validation d'un tag
 */
export const schemaTag = z.object({
  id: z.string().min(1),
  nom: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
  dateCreation: z.date(),
});

export type Tag = z.infer<typeof schemaTag>;

/**
 * Schéma pour la création d'un tag
 */
export const schemaCreationTag = z.object({
  nom: z.string().min(1, 'Le nom du tag est requis').max(50, 'Le nom du tag est trop long'),
});

export type CreationTag = z.infer<typeof schemaCreationTag>;

/**
 * Tag avec statistiques
 */
export interface TagAvecStats extends Tag {
  nombreSources: number;
}

/**
 * Tag populaire (pour la communauté)
 */
export interface TagPopulaire extends Tag {
  nombreUtilisations: number;
}

/**
 * Génère un slug à partir d'un nom
 */
export function genererSlug(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9]+/g, '-') // Remplacer les caractères spéciaux par des tirets
    .replace(/^-+|-+$/g, '') // Supprimer les tirets en début/fin
    .substring(0, 50);
}

/**
 * Valide un slug
 */
export function estSlugValide(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 50;
}
