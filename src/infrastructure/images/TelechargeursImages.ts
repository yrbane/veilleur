/**
 * Veilleur - Téléchargeur d'images
 * Téléchargement HTTP avec protection SSRF
 */

import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { env } from '@/config/environnement';
import { loggerJobs } from '@/infrastructure/logging/logger';
import { validerUrlScraping } from '@/infrastructure/scraping/validationUrl';
import type { ResultatTelechargement, OptionsTelechargement } from './types';

/**
 * Types MIME d'images acceptés
 */
const TYPES_MIME_ACCEPTES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

/**
 * Options par défaut
 */
const OPTIONS_DEFAUT: Required<OptionsTelechargement> = {
  timeout: 30000, // 30 secondes
  maxTailleMo: env.IMAGES_MAX_TAILLE_MO,
  userAgent: env.SCRAPING_USER_AGENT,
};

/**
 * Téléchargeur d'images avec protection SSRF
 */
export class TelechargeursImages {
  private readonly options: Required<OptionsTelechargement>;

  constructor(options?: OptionsTelechargement) {
    this.options = { ...OPTIONS_DEFAUT, ...options };
  }

  /**
   * Télécharge une image depuis une URL
   */
  async telecharger(url: string): Promise<ResultatTelechargement> {
    // Validation SSRF
    const validation = validerUrlScraping(url);
    if (!validation.valide || !validation.urlNormalisee) {
      loggerJobs.warn({ url, erreur: validation.erreur }, 'URL image rejetée (SSRF)');
      return {
        succes: false,
        erreur: validation.erreur ?? 'URL invalide',
      };
    }

    const urlNormalisee = validation.urlNormalisee;

    try {
      // Téléchargement avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(urlNormalisee, {
        method: 'GET',
        headers: {
          'User-Agent': this.options.userAgent,
          'Accept': 'image/*',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      // Vérifier le statut HTTP
      if (!response.ok) {
        return {
          succes: false,
          erreur: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Vérifier le type MIME
      const contentTypeHeader = response.headers.get('content-type');
      const contentType = contentTypeHeader?.toLowerCase().split(';')[0]?.trim();
      if (!contentType || !TYPES_MIME_ACCEPTES.includes(contentType)) {
        return {
          succes: false,
          erreur: `Type MIME non supporté: ${contentType}`,
        };
      }

      // Vérifier la taille (Content-Length)
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const taille = parseInt(contentLength, 10);
        const maxTaille = this.options.maxTailleMo * 1024 * 1024;
        if (taille > maxTaille) {
          return {
            succes: false,
            erreur: `Image trop volumineuse: ${(taille / 1024 / 1024).toFixed(2)} Mo > ${this.options.maxTailleMo} Mo`,
          };
        }
      }

      // Télécharger le contenu
      const buffer = await response.arrayBuffer();
      const tailleFichier = buffer.byteLength;

      // Vérifier la taille après téléchargement
      const maxTaille = this.options.maxTailleMo * 1024 * 1024;
      if (tailleFichier > maxTaille) {
        return {
          succes: false,
          erreur: `Image trop volumineuse: ${(tailleFichier / 1024 / 1024).toFixed(2)} Mo > ${this.options.maxTailleMo} Mo`,
        };
      }

      // Vérifier les magic bytes pour confirmer que c'est une image
      const donnees = Buffer.from(buffer);
      if (!this.verifierMagicBytes(donnees)) {
        return {
          succes: false,
          erreur: 'Le contenu ne semble pas être une image valide',
        };
      }

      // Sauvegarder dans un fichier temporaire
      const hashFichier = createHash('md5').update(donnees).digest('hex');
      const extension = this.obtenirExtension(contentType);
      const cheminTemporaire = join(tmpdir(), `veilleur-img-${hashFichier}${extension}`);

      await writeFile(cheminTemporaire, donnees);

      loggerJobs.debug(
        { url: urlNormalisee, taille: tailleFichier, typeMime: contentType },
        'Image téléchargée',
      );

      return {
        succes: true,
        cheminTemporaire,
        typeMime: contentType,
        tailleFichier,
      };
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : 'Erreur inconnue';

      if (message.includes('abort')) {
        return {
          succes: false,
          erreur: 'Timeout dépassé',
        };
      }

      loggerJobs.error({ url: urlNormalisee, erreur: message }, 'Erreur téléchargement image');

      return {
        succes: false,
        erreur: message,
      };
    }
  }

  /**
   * Supprime un fichier temporaire
   */
  async supprimerTemporaire(chemin: string): Promise<void> {
    try {
      await unlink(chemin);
    } catch {
      // Ignorer les erreurs de suppression
    }
  }

  /**
   * Vérifie les magic bytes du fichier pour confirmer le type
   */
  private verifierMagicBytes(donnees: Buffer): boolean {
    if (donnees.length < 4) return false;

    // JPEG: FF D8 FF
    if (donnees[0] === 0xFF && donnees[1] === 0xD8 && donnees[2] === 0xFF) {
      return true;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (donnees[0] === 0x89 && donnees[1] === 0x50 && donnees[2] === 0x4E && donnees[3] === 0x47) {
      return true;
    }

    // GIF: 47 49 46 38
    if (donnees[0] === 0x47 && donnees[1] === 0x49 && donnees[2] === 0x46 && donnees[3] === 0x38) {
      return true;
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (donnees[0] === 0x52 && donnees[1] === 0x49 && donnees[2] === 0x46 && donnees[3] === 0x46) {
      if (donnees.length >= 12 && donnees[8] === 0x57 && donnees[9] === 0x45 && donnees[10] === 0x42 && donnees[11] === 0x50) {
        return true;
      }
    }

    // AVIF: commence par ftyp
    if (donnees.length >= 12) {
      const ftyp = donnees.subarray(4, 8).toString('ascii');
      if (ftyp === 'ftyp') {
        const brand = donnees.subarray(8, 12).toString('ascii');
        if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Obtient l'extension de fichier depuis le type MIME
   */
  private obtenirExtension(typeMime: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
    };

    return extensions[typeMime] ?? '.bin';
  }
}

/**
 * Instance singleton
 */
let telechargeursImages: TelechargeursImages | null = null;

/**
 * Obtient l'instance du téléchargeur d'images
 */
export function obtenirTelechargeursImages(): TelechargeursImages {
  if (!telechargeursImages) {
    telechargeursImages = new TelechargeursImages();
  }
  return telechargeursImages;
}
