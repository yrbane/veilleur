/**
 * Veilleur - Implémentation MariaDB du dépôt tags
 */

import { eq, sql, and } from 'drizzle-orm';
import { tags, utilisateursSourcesTags, utilisateursSources } from './schema';
import { obtenirBdd } from './connexion';
import type { DepotTags } from '@/domaine/ports/DepotTags';
import type { Tag, TagAvecStats } from '@/domaine/entites/Tag';
import { genererSlug } from '@/domaine/entites/Tag';

/**
 * Implémentation MariaDB du dépôt tags
 */
export class DepotTagsMariaDB implements DepotTags {
  /**
   * Trouve un tag par son ID
   */
  async trouverParId(id: string): Promise<Tag | null> {
    const db = obtenirBdd();
    const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1);

    const row = result[0];
    if (!row) return null;

    return this.mapperTag(row);
  }

  /**
   * Trouve un tag par son slug
   */
  async trouverParSlug(slug: string): Promise<Tag | null> {
    const db = obtenirBdd();
    const result = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);

    const row = result[0];
    if (!row) return null;

    return this.mapperTag(row);
  }

  /**
   * Crée un nouveau tag
   */
  async creer(tag: Omit<Tag, 'id' | 'dateCreation'>): Promise<Tag> {
    const db = obtenirBdd();

    const results = await db
      .insert(tags)
      .values({
        nom: tag.nom,
        slug: tag.slug,
      })
      .$returningId();

    const result = results[0];
    if (!result) throw new Error('Échec de création du tag');

    const created = await this.trouverParId(result.id);
    if (!created) throw new Error('Échec de création du tag');

    return created;
  }

  /**
   * Supprime un tag
   */
  async supprimer(id: string): Promise<boolean> {
    const db = obtenirBdd();

    // Supprimer d'abord les associations
    await db.delete(utilisateursSourcesTags).where(eq(utilisateursSourcesTags.tagId, id));

    // Supprimer le tag
    const result = await db.delete(tags).where(eq(tags.id, id));

    return ((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) > 0;
  }

  /**
   * Liste les tags d'un utilisateur avec le nombre de sources
   */
  async listerTagsUtilisateur(utilisateurId: string): Promise<TagAvecStats[]> {
    const db = obtenirBdd();

    const result = await db
      .select({
        id: tags.id,
        nom: tags.nom,
        slug: tags.slug,
        dateCreation: tags.dateCreation,
        nombreSources: sql<number>`COUNT(${utilisateursSourcesTags.id})`,
      })
      .from(tags)
      .innerJoin(utilisateursSourcesTags, eq(utilisateursSourcesTags.tagId, tags.id))
      .innerJoin(
        utilisateursSources,
        eq(utilisateursSources.id, utilisateursSourcesTags.utilisateurSourceId),
      )
      .where(eq(utilisateursSources.utilisateurId, utilisateurId))
      .groupBy(tags.id, tags.nom, tags.slug, tags.dateCreation)
      .orderBy(tags.nom);

    return result.map(row => ({
      id: row.id,
      nom: row.nom,
      slug: row.slug,
      dateCreation: row.dateCreation,
      nombreSources: Number(row.nombreSources),
    }));
  }

  /**
   * Ajoute un tag à une source utilisateur
   */
  async ajouterTagSource(utilisateurSourceId: string, tagId: string): Promise<void> {
    const db = obtenirBdd();

    await db
      .insert(utilisateursSourcesTags)
      .values({
        utilisateurSourceId,
        tagId,
      })
      .onDuplicateKeyUpdate({
        set: { tagId },
      });
  }

  /**
   * Retire un tag d'une source utilisateur
   */
  async retirerTagSource(utilisateurSourceId: string, tagId: string): Promise<boolean> {
    const db = obtenirBdd();

    const result = await db
      .delete(utilisateursSourcesTags)
      .where(
        and(
          eq(utilisateursSourcesTags.utilisateurSourceId, utilisateurSourceId),
          eq(utilisateursSourcesTags.tagId, tagId),
        ),
      );

    return ((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) > 0;
  }

  /**
   * Liste les tags d'une source utilisateur
   */
  async listerTagsSource(utilisateurSourceId: string): Promise<Tag[]> {
    const db = obtenirBdd();

    const result = await db
      .select({
        id: tags.id,
        nom: tags.nom,
        slug: tags.slug,
        dateCreation: tags.dateCreation,
      })
      .from(tags)
      .innerJoin(utilisateursSourcesTags, eq(utilisateursSourcesTags.tagId, tags.id))
      .where(eq(utilisateursSourcesTags.utilisateurSourceId, utilisateurSourceId))
      .orderBy(tags.nom);

    return result.map(row => this.mapperTag(row));
  }

  /**
   * Trouve ou crée un tag par nom
   */
  async trouverOuCreer(nom: string): Promise<Tag> {
    const slug = genererSlug(nom);

    // Chercher d'abord par slug
    const existant = await this.trouverParSlug(slug);
    if (existant) return existant;

    // Créer le tag
    return this.creer({ nom, slug });
  }

  /**
   * Mappe un résultat DB vers un Tag
   */
  private mapperTag(row: {
    id: string;
    nom: string;
    slug: string;
    dateCreation: Date;
  }): Tag {
    return {
      id: row.id,
      nom: row.nom,
      slug: row.slug,
      dateCreation: row.dateCreation,
    };
  }
}

/**
 * Instance singleton
 */
let instanceDepotTags: DepotTagsMariaDB | null = null;

export function obtenirDepotTags(): DepotTagsMariaDB {
  if (!instanceDepotTags) {
    instanceDepotTags = new DepotTagsMariaDB();
  }
  return instanceDepotTags;
}
