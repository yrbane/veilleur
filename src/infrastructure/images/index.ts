/**
 * Veilleur - Module de cache d'images
 * Exports publics
 */

// Types
export type {
  TailleMiniature,
  FormatImage,
  StatutImageCache,
  ImageCachee,
  CreerImageCachee,
  MettreAJourImageCachee,
  ResultatTelechargement,
  ResultatTraitement,
  OptionsTelechargement,
  OptionsTraitement,
  JobImage,
  JobNettoyageImages,
  DonneesJobImage,
  ResultatJobImage,
} from './types';

export {
  DIMENSIONS_MINIATURES,
  EXTENSIONS_FORMAT,
  TYPES_MIME_FORMAT,
} from './types';

// Gestionnaire de stockage
export {
  GestionnaireStockage,
  obtenirGestionnaireStockage,
} from './GestionnaireStockage';

// Téléchargeur d'images
export {
  TelechargeursImages,
  obtenirTelechargeursImages,
} from './TelechargeursImages';

// Traitement d'images
export {
  TraitementImages,
  obtenirTraitementImages,
} from './TraitementImages';

// Service principal
export type { DepotImagesCache } from './ServiceImagesCache';
export {
  ServiceImagesCache,
  initialiserServiceImagesCache,
  obtenirServiceImagesCache,
} from './ServiceImagesCache';
