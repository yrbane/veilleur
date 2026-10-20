/**
 * Veilleur - Traitement d'images
 * Génération de miniatures avec Sharp
 */

import sharp from 'sharp';
import { loggerJobs } from '@/infrastructure/logging/logger';
import { GestionnaireStockage, obtenirGestionnaireStockage } from './GestionnaireStockage';
import type { ResultatTraitement, OptionsTraitement, TailleMiniature } from './types';
import { DIMENSIONS_MINIATURES } from './types';

/**
 * Options par défaut
 */
const OPTIONS_DEFAUT: Required<OptionsTraitement> = {
  qualiteWebp: 80,
  qualiteJpeg: 85,
  genererJpegFallback: true,
};

/**
 * Service de traitement d'images avec Sharp
 */
export class TraitementImages {
  private readonly options: Required<OptionsTraitement>;
  private readonly gestionnaire: GestionnaireStockage;

  constructor(
    gestionnaire?: GestionnaireStockage,
    options?: OptionsTraitement,
  ) {
    this.options = { ...OPTIONS_DEFAUT, ...options };
    this.gestionnaire = gestionnaire ?? obtenirGestionnaireStockage();
  }

  /**
   * Traite une image téléchargée et génère les miniatures
   */
  async traiter(
    cheminSource: string,
    hashUrl: string,
  ): Promise<ResultatTraitement> {
    try {
      // Initialiser les dossiers
      await this.gestionnaire.initialiser();

      // Obtenir les métadonnées de l'image source
      const metadata = await sharp(cheminSource).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          succes: false,
          erreur: 'Impossible de lire les dimensions de l\'image',
        };
      }

      // Traiter l'image originale en WebP
      const cheminOriginalWebp = this.gestionnaire.genererChemin(hashUrl, 'originale', 'webp');
      await this.convertirEnWebp(cheminSource, cheminOriginalWebp, metadata.width, metadata.height);

      // Générer les miniatures
      const cheminSmWebp = this.gestionnaire.genererChemin(hashUrl, 'sm', 'webp');
      const cheminMdWebp = this.gestionnaire.genererChemin(hashUrl, 'md', 'webp');

      await this.genererMiniature(cheminSource, cheminSmWebp, 'sm');
      await this.genererMiniature(cheminSource, cheminMdWebp, 'md');

      // Générer les fallback JPEG si demandé
      if (this.options.genererJpegFallback) {
        const cheminOriginalJpeg = this.gestionnaire.genererChemin(hashUrl, 'originale', 'jpeg');
        const cheminSmJpeg = this.gestionnaire.genererChemin(hashUrl, 'sm', 'jpeg');
        const cheminMdJpeg = this.gestionnaire.genererChemin(hashUrl, 'md', 'jpeg');

        await this.convertirEnJpeg(cheminSource, cheminOriginalJpeg, metadata.width, metadata.height);
        await this.genererMiniatureJpeg(cheminSource, cheminSmJpeg, 'sm');
        await this.genererMiniatureJpeg(cheminSource, cheminMdJpeg, 'md');
      }

      loggerJobs.debug(
        { hashUrl, largeur: metadata.width, hauteur: metadata.height },
        'Image traitée avec succès',
      );

      return {
        succes: true,
        cheminLocal: this.gestionnaire.genererCheminRelatif(hashUrl, 'originale', 'webp'),
        cheminMiniatureSm: this.gestionnaire.genererCheminRelatif(hashUrl, 'sm', 'webp'),
        cheminMiniatureMd: this.gestionnaire.genererCheminRelatif(hashUrl, 'md', 'webp'),
        largeur: metadata.width,
        hauteur: metadata.height,
      };
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : 'Erreur inconnue';
      loggerJobs.error({ hashUrl, erreur: message }, 'Erreur traitement image');

      return {
        succes: false,
        erreur: message,
      };
    }
  }

  /**
   * Convertit une image en WebP
   */
  private async convertirEnWebp(
    source: string,
    destination: string,
    largeur: number,
    hauteur: number,
  ): Promise<void> {
    const donnees = await sharp(source)
      .resize(largeur, hauteur, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: this.options.qualiteWebp })
      .toBuffer();

    await this.gestionnaire.sauvegarder(destination, donnees);
  }

  /**
   * Convertit une image en JPEG
   */
  private async convertirEnJpeg(
    source: string,
    destination: string,
    largeur: number,
    hauteur: number,
  ): Promise<void> {
    const donnees = await sharp(source)
      .resize(largeur, hauteur, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: this.options.qualiteJpeg })
      .toBuffer();

    await this.gestionnaire.sauvegarder(destination, donnees);
  }

  /**
   * Génère une miniature WebP
   */
  private async genererMiniature(
    source: string,
    destination: string,
    taille: Exclude<TailleMiniature, 'originale'>,
  ): Promise<void> {
    const dimensions = DIMENSIONS_MINIATURES[taille];

    const donnees = await sharp(source)
      .resize(dimensions.largeur, dimensions.hauteur, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: this.options.qualiteWebp })
      .toBuffer();

    await this.gestionnaire.sauvegarder(destination, donnees);
  }

  /**
   * Génère une miniature JPEG (fallback)
   */
  private async genererMiniatureJpeg(
    source: string,
    destination: string,
    taille: Exclude<TailleMiniature, 'originale'>,
  ): Promise<void> {
    const dimensions = DIMENSIONS_MINIATURES[taille];

    const donnees = await sharp(source)
      .resize(dimensions.largeur, dimensions.hauteur, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: this.options.qualiteJpeg })
      .toBuffer();

    await this.gestionnaire.sauvegarder(destination, donnees);
  }

  /**
   * Obtient les métadonnées d'une image
   */
  async obtenirMetadonnees(chemin: string): Promise<{
    largeur: number;
    hauteur: number;
    format: string;
  } | null> {
    try {
      const metadata = await sharp(chemin).metadata();
      if (!metadata.width || !metadata.height || !metadata.format) {
        return null;
      }
      return {
        largeur: metadata.width,
        hauteur: metadata.height,
        format: metadata.format,
      };
    } catch {
      return null;
    }
  }

  /**
   * Valide qu'un fichier est une image valide
   */
  async estImageValide(chemin: string): Promise<boolean> {
    try {
      const metadata = await sharp(chemin).metadata();
      return !!(metadata.width && metadata.height);
    } catch {
      return false;
    }
  }
}

/**
 * Instance singleton
 */
let traitementImages: TraitementImages | null = null;

/**
 * Obtient l'instance du service de traitement
 */
export function obtenirTraitementImages(): TraitementImages {
  if (!traitementImages) {
    traitementImages = new TraitementImages();
  }
  return traitementImages;
}
