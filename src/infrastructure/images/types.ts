/**
 * Veilleur - Types pour le système de cache d'images
 * Définitions des types et interfaces
 */

/**
 * Tailles de miniatures supportées
 */
export type TailleMiniature = 'sm' | 'md' | 'originale';

/**
 * Dimensions des miniatures
 */
export const DIMENSIONS_MINIATURES: Record<Exclude<TailleMiniature, 'originale'>, { largeur: number; hauteur: number }> = {
  sm: { largeur: 200, hauteur: 150 },
  md: { largeur: 400, hauteur: 300 },
};

/**
 * Formats d'image supportés
 */
export type FormatImage = 'webp' | 'jpeg';

/**
 * Extensions de fichiers par format
 */
export const EXTENSIONS_FORMAT: Record<FormatImage, string> = {
  webp: '.webp',
  jpeg: '.jpg',
};

/**
 * Types MIME par format
 */
export const TYPES_MIME_FORMAT: Record<FormatImage, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

/**
 * Statut du téléchargement/traitement d'une image
 */
export type StatutImageCache = 'en_attente' | 'en_cours' | 'termine' | 'echec';

/**
 * Métadonnées d'une image cachée
 */
export interface ImageCachee {
  id: string;
  hashUrl: string;
  urlOriginale: string;
  cheminLocal: string | null;
  cheminMiniatureSm: string | null;
  cheminMiniatureMd: string | null;
  typeMime: string | null;
  tailleFichier: number | null;
  largeur: number | null;
  hauteur: number | null;
  statut: StatutImageCache;
  nombreUtilisations: number;
  dateCreation: Date;
  dateDernierAcces: Date | null;
}

/**
 * Données pour créer une entrée d'image cachée
 */
export interface CreerImageCachee {
  hashUrl: string;
  urlOriginale: string;
}

/**
 * Données pour mettre à jour une image cachée
 */
export interface MettreAJourImageCachee {
  cheminLocal?: string | null;
  cheminMiniatureSm?: string | null;
  cheminMiniatureMd?: string | null;
  typeMime?: string | null;
  tailleFichier?: number | null;
  largeur?: number | null;
  hauteur?: number | null;
  statut?: StatutImageCache;
  nombreUtilisations?: number;
  dateDernierAcces?: Date | null;
}

/**
 * Résultat du téléchargement d'une image
 */
export interface ResultatTelechargement {
  succes: boolean;
  cheminTemporaire?: string;
  typeMime?: string;
  tailleFichier?: number;
  erreur?: string;
}

/**
 * Résultat du traitement d'une image
 */
export interface ResultatTraitement {
  succes: boolean;
  cheminLocal?: string;
  cheminMiniatureSm?: string;
  cheminMiniatureMd?: string;
  largeur?: number;
  hauteur?: number;
  erreur?: string;
}

/**
 * Options de téléchargement
 */
export interface OptionsTelechargement {
  timeout?: number;
  maxTailleMo?: number;
  userAgent?: string;
}

/**
 * Options de traitement
 */
export interface OptionsTraitement {
  qualiteWebp?: number;
  qualiteJpeg?: number;
  genererJpegFallback?: boolean;
}

/**
 * Job de téléchargement d'image
 */
export interface JobImage {
  type: 'telecharger-image';
  hashUrl: string;
  urlOriginale: string;
  articleId?: string;
}

/**
 * Job de nettoyage d'images
 */
export interface JobNettoyageImages {
  type: 'nettoyage-images';
  retentionJours: number;
}

/**
 * Données des jobs de la queue images
 */
export type DonneesJobImage = JobImage | JobNettoyageImages;

/**
 * Résultat d'un job image
 */
export interface ResultatJobImage {
  hashUrl: string;
  succes: boolean;
  erreur?: string;
}
