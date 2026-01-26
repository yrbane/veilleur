/**
 * Veilleur - Port DepotTags
 * Interface pour l'accès aux données des tags
 */

import type { Tag, TagAvecStats } from '../entites/Tag';

/**
 * Interface du dépôt tags
 */
export interface DepotTags {
  /**
   * Trouve un tag par son ID
   */
  trouverParId(id: string): Promise<Tag | null>;

  /**
   * Trouve un tag par son slug
   */
  trouverParSlug(slug: string): Promise<Tag | null>;

  /**
   * Crée un nouveau tag
   */
  creer(tag: Omit<Tag, 'id' | 'dateCreation'>): Promise<Tag>;

  /**
   * Supprime un tag
   */
  supprimer(id: string): Promise<boolean>;

  /**
   * Liste les tags d'un utilisateur avec le nombre de sources
   */
  listerTagsUtilisateur(utilisateurId: string): Promise<TagAvecStats[]>;

  /**
   * Ajoute un tag à une source utilisateur
   */
  ajouterTagSource(utilisateurSourceId: string, tagId: string): Promise<void>;

  /**
   * Retire un tag d'une source utilisateur
   */
  retirerTagSource(utilisateurSourceId: string, tagId: string): Promise<boolean>;

  /**
   * Liste les tags d'une source utilisateur
   */
  listerTagsSource(utilisateurSourceId: string): Promise<Tag[]>;

  /**
   * Trouve ou crée un tag par nom
   */
  trouverOuCreer(nom: string): Promise<Tag>;
}
