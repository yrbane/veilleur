/**
 * Veilleur - Entité Utilisateur
 * Représente un utilisateur inscrit sur la plateforme
 */

import { z } from 'zod';

/**
 * Schéma de validation des préférences utilisateur
 */
export const schemaPreferences = z.object({
  langue: z.string().default('fr'),
  theme: z.enum(['clair', 'sombre', 'auto']).default('auto'),
  frequenceRafraichissement: z.number().min(5).max(1440).default(30),
});

export type Preferences = z.infer<typeof schemaPreferences>;

/**
 * Schéma de validation d'un utilisateur
 */
export const schemaUtilisateur = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  motDePasseHash: z.string().min(1),
  dateCreation: z.date(),
  dateDerniereConnexion: z.date().nullable(),
  preferences: schemaPreferences.default({}),
  estActif: z.boolean().default(true),
  // Champs 2FA TOTP
  totpSecret: z.string().nullable().optional(),
  totpActif: z.boolean().default(false),
});

export type Utilisateur = z.infer<typeof schemaUtilisateur>;

/**
 * Schéma pour la création d'un utilisateur (sans id ni dates)
 */
export const schemaCreationUtilisateur = z.object({
  email: z.string().email('Email invalide'),
  motDePasse: z
    .string()
    .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
});

export type CreationUtilisateur = z.infer<typeof schemaCreationUtilisateur>;

/**
 * Schéma pour la connexion
 */
export const schemaConnexion = z.object({
  email: z.string().email('Email invalide'),
  motDePasse: z.string().min(1, 'Mot de passe requis'),
});

export type Connexion = z.infer<typeof schemaConnexion>;

/**
 * Schéma pour la mise à jour du profil
 */
export const schemaMiseAJourProfil = z.object({
  email: z.string().email('Email invalide').optional(),
  motDePasseActuel: z.string().optional(),
  nouveauMotDePasse: z
    .string()
    .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .optional(),
  preferences: schemaPreferences.partial().optional(),
});

export type MiseAJourProfil = z.infer<typeof schemaMiseAJourProfil>;

/**
 * Utilisateur sans informations sensibles (pour les réponses API)
 */
export interface UtilisateurPublic {
  id: string;
  email: string;
  dateCreation: Date;
  preferences: Preferences;
  totpActif: boolean;
}

/**
 * Convertit un utilisateur en version publique
 */
export function versUtilisateurPublic(utilisateur: Utilisateur): UtilisateurPublic {
  return {
    id: utilisateur.id,
    email: utilisateur.email,
    dateCreation: utilisateur.dateCreation,
    preferences: utilisateur.preferences,
    totpActif: utilisateur.totpActif ?? false,
  };
}
