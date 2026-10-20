/**
 * Veilleur - Gestionnaire de stockage des images
 * Opérations sur le système de fichiers
 */

import { mkdir, readFile, writeFile, unlink, stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { env } from '@/config/environnement';
import { loggerJobs } from '@/infrastructure/logging/logger';
import type { TailleMiniature, FormatImage } from './types';
import { EXTENSIONS_FORMAT } from './types';

/**
 * Structure des dossiers de stockage
 */
const DOSSIERS = {
  ORIGINALES: 'originales',
  MINIATURES: 'miniatures',
};

/**
 * Suffixes pour les tailles de miniatures
 */
const SUFFIXES_TAILLE: Record<Exclude<TailleMiniature, 'originale'>, string> = {
  sm: '-sm',
  md: '-md',
};

/**
 * Gestionnaire de stockage des images sur le système de fichiers
 */
export class GestionnaireStockage {
  private readonly cheminBase: string;

  constructor(cheminBase?: string) {
    this.cheminBase = cheminBase ?? env.IMAGES_CHEMIN_STOCKAGE;
  }

  /**
   * Initialise les dossiers de stockage
   */
  async initialiser(): Promise<void> {
    const dossiers = [
      this.cheminBase,
      join(this.cheminBase, DOSSIERS.ORIGINALES),
      join(this.cheminBase, DOSSIERS.MINIATURES),
    ];

    for (const dossier of dossiers) {
      if (!existsSync(dossier)) {
        await mkdir(dossier, { recursive: true });
        loggerJobs.info({ dossier }, 'Dossier de stockage créé');
      }
    }
  }

  /**
   * Génère le chemin d'un fichier image
   */
  genererChemin(
    hashUrl: string,
    taille: TailleMiniature,
    format: FormatImage,
  ): string {
    const extension = EXTENSIONS_FORMAT[format];

    if (taille === 'originale') {
      return join(this.cheminBase, DOSSIERS.ORIGINALES, `${hashUrl}${extension}`);
    }

    const suffixe = SUFFIXES_TAILLE[taille];
    return join(this.cheminBase, DOSSIERS.MINIATURES, `${hashUrl}${suffixe}${extension}`);
  }

  /**
   * Génère le chemin relatif pour stocker en BDD
   */
  genererCheminRelatif(
    hashUrl: string,
    taille: TailleMiniature,
    format: FormatImage,
  ): string {
    const extension = EXTENSIONS_FORMAT[format];

    if (taille === 'originale') {
      return join(DOSSIERS.ORIGINALES, `${hashUrl}${extension}`);
    }

    const suffixe = SUFFIXES_TAILLE[taille];
    return join(DOSSIERS.MINIATURES, `${hashUrl}${suffixe}${extension}`);
  }

  /**
   * Sauvegarde un fichier image
   */
  async sauvegarder(chemin: string, donnees: Buffer): Promise<void> {
    const dossier = dirname(chemin);

    if (!existsSync(dossier)) {
      await mkdir(dossier, { recursive: true });
    }

    await writeFile(chemin, donnees);
  }

  /**
   * Lit un fichier image
   */
  async lire(chemin: string): Promise<Buffer | null> {
    const cheminComplet = chemin.startsWith(this.cheminBase)
      ? chemin
      : join(this.cheminBase, chemin);

    try {
      return await readFile(cheminComplet);
    } catch {
      return null;
    }
  }

  /**
   * Vérifie si un fichier existe
   */
  existe(chemin: string): boolean {
    const cheminComplet = chemin.startsWith(this.cheminBase)
      ? chemin
      : join(this.cheminBase, chemin);

    return existsSync(cheminComplet);
  }

  /**
   * Supprime un fichier
   */
  async supprimer(chemin: string): Promise<boolean> {
    const cheminComplet = chemin.startsWith(this.cheminBase)
      ? chemin
      : join(this.cheminBase, chemin);

    try {
      await unlink(cheminComplet);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Supprime tous les fichiers associés à un hash
   */
  async supprimerTousLesFichiers(hashUrl: string): Promise<number> {
    let supprimees = 0;

    const fichiersPossibles = [
      // Originales
      this.genererChemin(hashUrl, 'originale', 'webp'),
      this.genererChemin(hashUrl, 'originale', 'jpeg'),
      // Miniatures SM
      this.genererChemin(hashUrl, 'sm', 'webp'),
      this.genererChemin(hashUrl, 'sm', 'jpeg'),
      // Miniatures MD
      this.genererChemin(hashUrl, 'md', 'webp'),
      this.genererChemin(hashUrl, 'md', 'jpeg'),
    ];

    for (const fichier of fichiersPossibles) {
      if (await this.supprimer(fichier)) {
        supprimees++;
      }
    }

    return supprimees;
  }

  /**
   * Obtient les informations d'un fichier
   */
  async obtenirInfos(chemin: string): Promise<{ taille: number; dateModification: Date } | null> {
    const cheminComplet = chemin.startsWith(this.cheminBase)
      ? chemin
      : join(this.cheminBase, chemin);

    try {
      const infos = await stat(cheminComplet);
      return {
        taille: infos.size,
        dateModification: infos.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Liste tous les fichiers d'un dossier
   */
  async listerFichiers(sousDossier: string): Promise<string[]> {
    const chemin = join(this.cheminBase, sousDossier);

    try {
      return await readdir(chemin);
    } catch {
      return [];
    }
  }

  /**
   * Calcule l'espace disque utilisé
   */
  async calculerEspaceUtilise(): Promise<{ originales: number; miniatures: number; total: number }> {
    let originales = 0;
    let miniatures = 0;

    // Fichiers originaux
    const fichiersOriginales = await this.listerFichiers(DOSSIERS.ORIGINALES);
    for (const fichier of fichiersOriginales) {
      const chemin = join(this.cheminBase, DOSSIERS.ORIGINALES, fichier);
      const infos = await this.obtenirInfos(chemin);
      if (infos) {
        originales += infos.taille;
      }
    }

    // Miniatures
    const fichiersMiniatures = await this.listerFichiers(DOSSIERS.MINIATURES);
    for (const fichier of fichiersMiniatures) {
      const chemin = join(this.cheminBase, DOSSIERS.MINIATURES, fichier);
      const infos = await this.obtenirInfos(chemin);
      if (infos) {
        miniatures += infos.taille;
      }
    }

    return {
      originales,
      miniatures,
      total: originales + miniatures,
    };
  }

  /**
   * Retourne le chemin de base du stockage
   */
  obtenirCheminBase(): string {
    return this.cheminBase;
  }
}

/**
 * Instance singleton
 */
let gestionnaireStockage: GestionnaireStockage | null = null;

/**
 * Obtient l'instance du gestionnaire de stockage
 */
export function obtenirGestionnaireStockage(): GestionnaireStockage {
  if (!gestionnaireStockage) {
    gestionnaireStockage = new GestionnaireStockage();
  }
  return gestionnaireStockage;
}
