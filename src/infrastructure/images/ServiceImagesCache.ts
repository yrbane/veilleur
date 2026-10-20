/**
 * Veilleur - Service de cache d'images
 * Service principal pour la gestion des images cachées
 */

import { createHash } from 'crypto';
import { loggerJobs } from '@/infrastructure/logging/logger';
import { obtenirServiceCache, ServiceCacheRedis } from '@/infrastructure/cache/ServiceCacheRedis';
import { cles, TTL } from '@/infrastructure/cache/clesRedis';
import { GestionnaireStockage, obtenirGestionnaireStockage } from './GestionnaireStockage';
import { TelechargeursImages, obtenirTelechargeursImages } from './TelechargeursImages';
import { TraitementImages, obtenirTraitementImages } from './TraitementImages';
import type {
  ImageCachee,
  TailleMiniature,
  FormatImage,
  StatutImageCache,
} from './types';
import { TYPES_MIME_FORMAT } from './types';

/**
 * Interface du dépôt d'images (pour injection de dépendances)
 */
export interface DepotImagesCache {
  trouverParHash(hashUrl: string): Promise<ImageCachee | null>;
  creer(hashUrl: string, urlOriginale: string): Promise<ImageCachee>;
  mettreAJour(hashUrl: string, donnees: Partial<ImageCachee>): Promise<ImageCachee | null>;
  incrementerUtilisation(hashUrl: string): Promise<void>;
  listerParStatut(statut: StatutImageCache, limite?: number): Promise<ImageCachee[]>;
  listerNonAccedeesDepuis(dateLimit: Date): Promise<ImageCachee[]>;
  supprimer(hashUrl: string): Promise<boolean>;
}

/**
 * Service principal de cache d'images
 */
export class ServiceImagesCache {
  constructor(
    private readonly depotImages: DepotImagesCache,
    private readonly gestionnaire: GestionnaireStockage = obtenirGestionnaireStockage(),
    private readonly telecharger: TelechargeursImages = obtenirTelechargeursImages(),
    private readonly traitement: TraitementImages = obtenirTraitementImages(),
    private readonly cache: ServiceCacheRedis = obtenirServiceCache(),
  ) {}

  /**
   * Génère le hash MD5 d'une URL
   */
  static hashUrl(url: string): string {
    return createHash('md5').update(url.toLowerCase().trim()).digest('hex');
  }

  /**
   * Demande le cache d'une image (crée un job si nécessaire)
   */
  async demanderCache(urlImage: string): Promise<string> {
    const hashUrl = ServiceImagesCache.hashUrl(urlImage);

    // Vérifier si l'image est déjà en cache Redis
    const cleCache = cles.image.parHash(hashUrl);
    const enCache = await this.cache.obtenir<ImageCachee>(cleCache);

    if (enCache && enCache.statut === 'termine') {
      await this.depotImages.incrementerUtilisation(hashUrl);
      return hashUrl;
    }

    // Vérifier en base de données
    let image = await this.depotImages.trouverParHash(hashUrl);

    if (!image) {
      // Créer une nouvelle entrée
      image = await this.depotImages.creer(hashUrl, urlImage);
      loggerJobs.debug({ hashUrl, url: urlImage }, 'Nouvelle image à cacher');
    } else if (image.statut === 'termine') {
      // Image déjà traitée, mettre en cache Redis
      await this.cache.stocker(cleCache, image, { ttl: TTL.CACHE_LONG });
      await this.depotImages.incrementerUtilisation(hashUrl);
    }

    return hashUrl;
  }

  /**
   * Traite le téléchargement et le cache d'une image
   */
  async traiterImage(hashUrl: string, urlOriginale: string): Promise<boolean> {
    // Les jobs ajoutés directement par la synchronisation ne passent pas par demanderCache :
    // sans ligne en base, les mises à jour de statut ne toucheraient rien et l'image resterait introuvable
    const existante = await this.depotImages.trouverParHash(hashUrl);
    if (!existante) {
      await this.depotImages.creer(hashUrl, urlOriginale);
    }

    // Marquer comme en cours
    await this.depotImages.mettreAJour(hashUrl, { statut: 'en_cours' });

    // Télécharger l'image
    const resultatTelechargement = await this.telecharger.telecharger(urlOriginale);

    if (!resultatTelechargement.succes || !resultatTelechargement.cheminTemporaire) {
      await this.depotImages.mettreAJour(hashUrl, { statut: 'echec' });
      loggerJobs.warn(
        { hashUrl, url: urlOriginale, erreur: resultatTelechargement.erreur },
        'Échec téléchargement image',
      );
      return false;
    }

    try {
      // Traiter l'image (conversion, miniatures)
      const resultatTraitement = await this.traitement.traiter(
        resultatTelechargement.cheminTemporaire,
        hashUrl,
      );

      if (!resultatTraitement.succes) {
        await this.depotImages.mettreAJour(hashUrl, { statut: 'echec' });
        loggerJobs.warn(
          { hashUrl, erreur: resultatTraitement.erreur },
          'Échec traitement image',
        );
        return false;
      }

      // Mettre à jour la base de données
      const imageMAJ = await this.depotImages.mettreAJour(hashUrl, {
        cheminLocal: resultatTraitement.cheminLocal,
        cheminMiniatureSm: resultatTraitement.cheminMiniatureSm,
        cheminMiniatureMd: resultatTraitement.cheminMiniatureMd,
        typeMime: resultatTelechargement.typeMime,
        tailleFichier: resultatTelechargement.tailleFichier,
        largeur: resultatTraitement.largeur,
        hauteur: resultatTraitement.hauteur,
        statut: 'termine',
        dateDernierAcces: new Date(),
      });

      // Mettre en cache Redis
      if (imageMAJ) {
        const cleCache = cles.image.parHash(hashUrl);
        await this.cache.stocker(cleCache, imageMAJ, { ttl: TTL.CACHE_LONG });
      }

      loggerJobs.info(
        { hashUrl, url: urlOriginale },
        'Image cachée avec succès',
      );

      return true;
    } finally {
      // Nettoyer le fichier temporaire
      await this.telecharger.supprimerTemporaire(resultatTelechargement.cheminTemporaire);
    }
  }

  /**
   * Obtient le chemin d'un fichier image
   */
  async obtenirCheminFichier(
    hashUrl: string,
    taille: TailleMiniature = 'sm',
    format: FormatImage = 'webp',
  ): Promise<{ chemin: string; typeMime: string } | null> {
    // Vérifier en cache Redis
    const cleCache = cles.image.parHash(hashUrl);
    let image = await this.cache.obtenir<ImageCachee>(cleCache);

    if (!image) {
      // Chercher en base de données
      image = await this.depotImages.trouverParHash(hashUrl);

      if (image && image.statut === 'termine') {
        await this.cache.stocker(cleCache, image, { ttl: TTL.CACHE_LONG });
      }
    }

    if (!image || image.statut !== 'termine') {
      return null;
    }

    // Déterminer le chemin
    let cheminRelatif: string | null = null;

    switch (taille) {
      case 'sm':
        cheminRelatif = image.cheminMiniatureSm;
        break;
      case 'md':
        cheminRelatif = image.cheminMiniatureMd;
        break;
      case 'originale':
        cheminRelatif = image.cheminLocal;
        break;
    }

    if (!cheminRelatif) {
      return null;
    }

    // Vérifier le format demandé (fallback JPEG si WebP demandé mais JPEG disponible)
    if (format === 'jpeg') {
      cheminRelatif = cheminRelatif.replace('.webp', '.jpg');
    }

    // Vérifier que le fichier existe
    if (!this.gestionnaire.existe(cheminRelatif)) {
      // Essayer le fallback
      if (format === 'webp') {
        const cheminJpeg = cheminRelatif.replace('.webp', '.jpg');
        if (this.gestionnaire.existe(cheminJpeg)) {
          return {
            chemin: cheminJpeg,
            typeMime: TYPES_MIME_FORMAT.jpeg,
          };
        }
      }
      return null;
    }

    // Incrémenter l'utilisation (en arrière-plan)
    this.depotImages.incrementerUtilisation(hashUrl).catch(() => {});

    return {
      chemin: cheminRelatif,
      typeMime: TYPES_MIME_FORMAT[format],
    };
  }

  /**
   * Obtient les données d'une image
   */
  async obtenirDonnees(
    hashUrl: string,
    taille: TailleMiniature = 'sm',
    format: FormatImage = 'webp',
  ): Promise<{ donnees: Buffer; typeMime: string } | null> {
    const fichier = await this.obtenirCheminFichier(hashUrl, taille, format);
    if (!fichier) {
      return null;
    }

    const donnees = await this.gestionnaire.lire(fichier.chemin);
    if (!donnees) {
      return null;
    }

    return {
      donnees,
      typeMime: fichier.typeMime,
    };
  }

  /**
   * Nettoie les images non accédées depuis un certain temps
   */
  async nettoyerImagesAnciennes(retentionJours: number): Promise<number> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - retentionJours);

    const imagesASupprimer = await this.depotImages.listerNonAccedeesDepuis(dateLimit);

    let supprimees = 0;

    for (const image of imagesASupprimer) {
      try {
        // Supprimer les fichiers
        await this.gestionnaire.supprimerTousLesFichiers(image.hashUrl);

        // Supprimer de la base de données
        await this.depotImages.supprimer(image.hashUrl);

        // Supprimer du cache Redis
        const cleCache = cles.image.parHash(image.hashUrl);
        await this.cache.supprimer(cleCache);

        supprimees++;
      } catch (erreur) {
        loggerJobs.error(
          { hashUrl: image.hashUrl, erreur },
          'Erreur lors de la suppression d\'une image',
        );
      }
    }

    loggerJobs.info(
      { supprimees, total: imagesASupprimer.length, retentionJours },
      'Nettoyage des images anciennes terminé',
    );

    return supprimees;
  }

  /**
   * Transforme une URL d'image en URL cachée
   */
  transformerUrlPourCache(urlOriginale: string | null, taille: TailleMiniature = 'sm'): string | null {
    if (!urlOriginale) {
      return null;
    }

    const hashUrl = ServiceImagesCache.hashUrl(urlOriginale);
    return `/api/v1/images/${hashUrl}/${taille}`;
  }

  /**
   * Obtient les statistiques du cache d'images
   */
  async obtenirStatistiques(): Promise<{
    total: number;
    terminees: number;
    enAttente: number;
    echecs: number;
    espaceDisque: { originales: number; miniatures: number; total: number };
  }> {
    const [terminees, enAttente, echecs, espaceDisque] = await Promise.all([
      this.depotImages.listerParStatut('termine', 1).then(() => 0), // TODO: compter
      this.depotImages.listerParStatut('en_attente', 1).then(() => 0),
      this.depotImages.listerParStatut('echec', 1).then(() => 0),
      this.gestionnaire.calculerEspaceUtilise(),
    ]);

    return {
      total: terminees + enAttente + echecs,
      terminees,
      enAttente,
      echecs,
      espaceDisque,
    };
  }
}

/**
 * Instance singleton
 */
let serviceImagesCache: ServiceImagesCache | null = null;

/**
 * Initialise le service avec un dépôt
 */
export function initialiserServiceImagesCache(depot: DepotImagesCache): ServiceImagesCache {
  serviceImagesCache = new ServiceImagesCache(depot);
  return serviceImagesCache;
}

/**
 * Obtient l'instance du service (doit être initialisé d'abord)
 */
export function obtenirServiceImagesCache(): ServiceImagesCache {
  if (!serviceImagesCache) {
    throw new Error('ServiceImagesCache non initialisé. Appelez initialiserServiceImagesCache() d\'abord.');
  }
  return serviceImagesCache;
}
