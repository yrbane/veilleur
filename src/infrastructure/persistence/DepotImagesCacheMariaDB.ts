/**
 * Veilleur - Implémentation du dépôt images cachées avec MariaDB
 */

import { eq, lt, sql } from 'drizzle-orm';
import { obtenirBdd } from './connexion';
import { imagesCachees } from './schema';
import { loggerBdd } from '../logging/logger';
import { createId } from '@paralleldrive/cuid2';
import type { DepotImagesCache } from '@/infrastructure/images/ServiceImagesCache';
import type { ImageCachee, StatutImageCache } from '@/infrastructure/images/types';

/**
 * Implémentation du dépôt images cachées avec Drizzle ORM
 */
export class DepotImagesCacheMariaDB implements DepotImagesCache {
  /**
   * Trouve une image par son hash d'URL
   */
  async trouverParHash(hashUrl: string): Promise<ImageCachee | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(imagesCachees)
        .where(eq(imagesCachees.hashUrl, hashUrl))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versImageCachee(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, hashUrl }, 'Erreur lors de la recherche image par hash');
      throw erreur;
    }
  }

  /**
   * Crée une nouvelle entrée d'image cachée
   */
  async creer(hashUrl: string, urlOriginale: string): Promise<ImageCachee> {
    const db = obtenirBdd();
    const id = createId();
    const dateCreation = new Date();

    try {
      await db.insert(imagesCachees).values({
        id,
        hashUrl,
        urlOriginale,
        statut: 'en_attente',
        nombreUtilisations: 1,
        dateCreation,
      });

      loggerBdd.debug({ hashUrl }, 'Image cachée créée');

      return {
        id,
        hashUrl,
        urlOriginale,
        cheminLocal: null,
        cheminMiniatureSm: null,
        cheminMiniatureMd: null,
        typeMime: null,
        tailleFichier: null,
        largeur: null,
        hauteur: null,
        statut: 'en_attente',
        nombreUtilisations: 1,
        dateCreation,
        dateDernierAcces: null,
      };
    } catch (erreur) {
      // Si l'erreur est une duplication de clé, récupérer l'image existante
      const erreurMsg = erreur instanceof Error ? erreur.message : '';
      if (erreurMsg.includes('Duplicate') || erreurMsg.includes('duplicate')) {
        const existante = await this.trouverParHash(hashUrl);
        if (existante) {
          return existante;
        }
      }

      loggerBdd.error({ erreur, hashUrl }, 'Erreur lors de la création image cachée');
      throw erreur;
    }
  }

  /**
   * Met à jour une image cachée
   */
  async mettreAJour(hashUrl: string, donnees: Partial<ImageCachee>): Promise<ImageCachee | null> {
    const db = obtenirBdd();

    try {
      const updateData: Record<string, unknown> = {};

      if (donnees.cheminLocal !== undefined) updateData.cheminLocal = donnees.cheminLocal;
      if (donnees.cheminMiniatureSm !== undefined) updateData.cheminMiniatureSm = donnees.cheminMiniatureSm;
      if (donnees.cheminMiniatureMd !== undefined) updateData.cheminMiniatureMd = donnees.cheminMiniatureMd;
      if (donnees.typeMime !== undefined) updateData.typeMime = donnees.typeMime;
      if (donnees.tailleFichier !== undefined) updateData.tailleFichier = donnees.tailleFichier;
      if (donnees.largeur !== undefined) updateData.largeur = donnees.largeur;
      if (donnees.hauteur !== undefined) updateData.hauteur = donnees.hauteur;
      if (donnees.statut !== undefined) updateData.statut = donnees.statut;
      if (donnees.nombreUtilisations !== undefined) updateData.nombreUtilisations = donnees.nombreUtilisations;
      if (donnees.dateDernierAcces !== undefined) updateData.dateDernierAcces = donnees.dateDernierAcces;

      if (Object.keys(updateData).length === 0) {
        return this.trouverParHash(hashUrl);
      }

      await db
        .update(imagesCachees)
        .set(updateData)
        .where(eq(imagesCachees.hashUrl, hashUrl));

      return this.trouverParHash(hashUrl);
    } catch (erreur) {
      loggerBdd.error({ erreur, hashUrl }, 'Erreur lors de la mise à jour image cachée');
      throw erreur;
    }
  }

  /**
   * Incrémente le compteur d'utilisation et met à jour la date de dernier accès
   */
  async incrementerUtilisation(hashUrl: string): Promise<void> {
    const db = obtenirBdd();

    try {
      await db
        .update(imagesCachees)
        .set({
          nombreUtilisations: sql`${imagesCachees.nombreUtilisations} + 1`,
          dateDernierAcces: new Date(),
        })
        .where(eq(imagesCachees.hashUrl, hashUrl));
    } catch (erreur) {
      // Ne pas faire échouer pour une simple incrémentation
      loggerBdd.warn({ erreur, hashUrl }, 'Erreur lors de l\'incrémentation utilisation');
    }
  }

  /**
   * Liste les images par statut
   */
  async listerParStatut(statut: StatutImageCache, limite: number = 100): Promise<ImageCachee[]> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(imagesCachees)
        .where(eq(imagesCachees.statut, statut))
        .limit(limite);

      return resultats.map(r => this.versImageCachee(r));
    } catch (erreur) {
      loggerBdd.error({ erreur, statut }, 'Erreur lors du listing images par statut');
      throw erreur;
    }
  }

  /**
   * Liste les images non accédées depuis une date
   */
  async listerNonAccedeesDepuis(dateLimit: Date): Promise<ImageCachee[]> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(imagesCachees)
        .where(lt(imagesCachees.dateDernierAcces, dateLimit));

      return resultats.map(r => this.versImageCachee(r));
    } catch (erreur) {
      loggerBdd.error({ erreur, dateLimit }, 'Erreur lors du listing images anciennes');
      throw erreur;
    }
  }

  /**
   * Supprime une image cachée
   */
  async supprimer(hashUrl: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const result = await db
        .delete(imagesCachees)
        .where(eq(imagesCachees.hashUrl, hashUrl));

      return (result[0] as { affectedRows?: number })?.affectedRows !== undefined
        ? (result[0] as { affectedRows: number }).affectedRows > 0
        : true;
    } catch (erreur) {
      loggerBdd.error({ erreur, hashUrl }, 'Erreur lors de la suppression image cachée');
      throw erreur;
    }
  }

  /**
   * Compte les images par statut
   */
  async compterParStatut(statut: StatutImageCache): Promise<number> {
    const db = obtenirBdd();

    try {
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(imagesCachees)
        .where(eq(imagesCachees.statut, statut));

      return result[0]?.count ?? 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, statut }, 'Erreur lors du comptage images');
      throw erreur;
    }
  }

  /**
   * Convertit un résultat de requête en objet ImageCachee
   */
  private versImageCachee(row: typeof imagesCachees.$inferSelect): ImageCachee {
    return {
      id: row.id,
      hashUrl: row.hashUrl,
      urlOriginale: row.urlOriginale,
      cheminLocal: row.cheminLocal,
      cheminMiniatureSm: row.cheminMiniatureSm,
      cheminMiniatureMd: row.cheminMiniatureMd,
      typeMime: row.typeMime,
      tailleFichier: row.tailleFichier,
      largeur: row.largeur,
      hauteur: row.hauteur,
      statut: row.statut as StatutImageCache,
      nombreUtilisations: row.nombreUtilisations ?? 1,
      dateCreation: row.dateCreation,
      dateDernierAcces: row.dateDernierAcces,
    };
  }
}
