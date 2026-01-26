/**
 * Veilleur - Entité ParametresSource
 * Configuration personnalisée d'une source par un utilisateur
 */

import { z } from 'zod';

/**
 * Priorités d'affichage
 */
export const Priorites = ['haute', 'normale', 'basse'] as const;
export type Priorite = (typeof Priorites)[number];

/**
 * Modes d'extraction
 */
export const ModesExtraction = ['rss', 'scraping', 'auto'] as const;
export type ModeExtraction = (typeof ModesExtraction)[number];

/**
 * Types de notifications
 */
export const TypesNotification = ['aucune', 'nouveaux', 'tous'] as const;
export type TypeNotification = (typeof TypesNotification)[number];

/**
 * Schéma des filtres par mots-clés
 */
export const schemaFiltresMotsCles = z.object({
  inclure: z.array(z.string()).optional(),
  exclure: z.array(z.string()).optional(),
});

export type FiltresMotsCles = z.infer<typeof schemaFiltresMotsCles>;

/**
 * Schéma de la plage horaire
 */
export const schemaPlageHoraire = z.object({
  debut: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format HH:MM requis'),
  fin: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format HH:MM requis'),
  joursActifs: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
});

export type PlageHoraire = z.infer<typeof schemaPlageHoraire>;

/**
 * Schéma de validation des paramètres source
 */
export const schemaParametresSource = z.object({
  id: z.string().min(1),
  utilisateurSourceId: z.string().min(1),
  nombreMaxArticles: z.number().int().min(1).max(100).default(20),
  frequenceMinutes: z.number().int().min(5).max(1440).default(30),
  retentionJours: z.number().int().min(1).max(365).default(30),
  priorite: z.enum(Priorites).default('normale'),
  modeExtraction: z.enum(ModesExtraction).default('auto'),
  filtresMotsCles: schemaFiltresMotsCles.default({}),
  notifications: z.enum(TypesNotification).default('nouveaux'),
  plageHoraire: schemaPlageHoraire.nullable().default(null),
});

export type ParametresSource = z.infer<typeof schemaParametresSource>;

/**
 * Schéma pour la mise à jour des paramètres
 */
export const schemaMiseAJourParametres = z.object({
  nombreMaxArticles: z.number().int().min(1).max(100).optional(),
  frequenceMinutes: z.number().int().min(5).max(1440).optional(),
  retentionJours: z.number().int().min(1).max(365).optional(),
  priorite: z.enum(Priorites).optional(),
  modeExtraction: z.enum(ModesExtraction).optional(),
  filtresMotsCles: schemaFiltresMotsCles.optional(),
  notifications: z.enum(TypesNotification).optional(),
  plageHoraire: schemaPlageHoraire.nullable().optional(),
});

export type MiseAJourParametres = z.infer<typeof schemaMiseAJourParametres>;

/**
 * Valeurs par défaut des paramètres
 */
export const PARAMETRES_DEFAUT: Omit<ParametresSource, 'id' | 'utilisateurSourceId'> = {
  nombreMaxArticles: 20,
  frequenceMinutes: 30,
  retentionJours: 30,
  priorite: 'normale',
  modeExtraction: 'auto',
  filtresMotsCles: {},
  notifications: 'nouveaux',
  plageHoraire: null,
};

/**
 * Vérifie si la fréquence est trop agressive
 */
export function estFrequenceTropAgressive(frequenceMinutes: number): boolean {
  return frequenceMinutes < 15;
}

/**
 * Vérifie si on est dans la plage horaire active
 */
export function estDansPlageHoraire(plage: PlageHoraire | null): boolean {
  if (!plage) return true;

  const maintenant = new Date();
  const jour = maintenant.getDay();
  const heures = maintenant.getHours();
  const minutes = maintenant.getMinutes();
  const heureActuelle = `${heures.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  if (!plage.joursActifs.includes(jour)) {
    return false;
  }

  return heureActuelle >= plage.debut && heureActuelle <= plage.fin;
}

/**
 * Vérifie si un article correspond aux filtres
 */
export function articleCorrespondAuxFiltres(
  titre: string,
  resume: string | null,
  filtres: FiltresMotsCles,
): boolean {
  const contenu = `${titre} ${resume ?? ''}`.toLowerCase();

  // Vérifier les mots à exclure
  if (filtres.exclure?.some(mot => contenu.includes(mot.toLowerCase()))) {
    return false;
  }

  // Si des mots à inclure sont définis, vérifier qu'au moins un est présent
  if (filtres.inclure && filtres.inclure.length > 0) {
    return filtres.inclure.some(mot => contenu.includes(mot.toLowerCase()));
  }

  return true;
}
