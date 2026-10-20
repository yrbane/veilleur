/**
 * Veilleur - Service d'annotations d'articles
 * Noter (1 à 5) et classer (tags) les articles, par utilisateur
 */

import type { DepotAnnotationsArticles } from '@/domaine/ports/DepotAnnotationsArticles';
import type { DepotArticles } from '@/domaine/ports/DepotArticles';
import type { DepotTags } from '@/domaine/ports/DepotTags';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE } from '@/domaine/ports/ServiceCache';
import type { AnnotationArticle, TagArticlesUtilise } from '@/domaine/entites/Article';
import { estNoteValide, NOTE_ARTICLE_MAX, NOTE_ARTICLE_MIN } from '@/domaine/entites/Article';
import type { Tag } from '@/domaine/entites/Tag';
import { genererSlug, schemaCreationTag } from '@/domaine/entites/Tag';

/**
 * Nombre maximal de tags par article
 */
export const MAX_TAGS_PAR_ARTICLE = 10;

/**
 * Erreurs du service
 */
export class ErreurAnnotation extends Error {
  constructor(
    message: string,
    public readonly code: 'NOTE_INVALIDE' | 'ARTICLE_INTROUVABLE' | 'TROP_DE_TAGS' | 'TAG_INVALIDE',
  ) {
    super(message);
    this.name = 'ErreurAnnotation';
  }
}

export class ServiceAnnotationsArticles {
  constructor(
    private readonly depotAnnotations: DepotAnnotationsArticles,
    private readonly depotArticles: Pick<DepotArticles, 'trouverParId'>,
    private readonly depotTags: Pick<DepotTags, 'trouverOuCreer'>,
    private readonly serviceCache?: Pick<ServiceCache, 'supprimerPattern'>,
  ) {}

  /**
   * Note un article (null retire la note)
   */
  async noter(utilisateurId: string, articleId: string, note: number | null): Promise<{ note: number | null }> {
    if (note !== null && !estNoteValide(note)) {
      throw new ErreurAnnotation(
        `La note doit être un entier entre ${NOTE_ARTICLE_MIN} et ${NOTE_ARTICLE_MAX}`,
        'NOTE_INVALIDE',
      );
    }
    await this.verifierArticle(articleId);
    await this.depotAnnotations.noter(utilisateurId, articleId, note);
    await this.invaliderFil(utilisateurId);
    return { note };
  }

  /**
   * Met un article en favori ou l'en retire
   */
  async definirFavori(utilisateurId: string, articleId: string, favori: boolean): Promise<{ favori: boolean }> {
    await this.verifierArticle(articleId);
    await this.depotAnnotations.definirFavori(utilisateurId, articleId, favori);
    await this.invaliderFil(utilisateurId);
    return { favori };
  }

  /**
   * Remplace les tags d'un article par la liste de noms fournie (créés au besoin)
   */
  async definirTags(utilisateurId: string, articleId: string, noms: string[]): Promise<Tag[]> {
    const nomsUniques = new Map<string, string>();
    for (const brut of noms) {
      const nom = brut.trim();
      if (!nom) continue;
      const validation = schemaCreationTag.safeParse({ nom });
      if (!validation.success) {
        throw new ErreurAnnotation(validation.error.errors[0]?.message ?? 'Tag invalide', 'TAG_INVALIDE');
      }
      const slug = genererSlug(nom);
      if (!nomsUniques.has(slug)) nomsUniques.set(slug, nom);
    }
    if (nomsUniques.size > MAX_TAGS_PAR_ARTICLE) {
      throw new ErreurAnnotation(`Au plus ${MAX_TAGS_PAR_ARTICLE} tags par article`, 'TROP_DE_TAGS');
    }
    await this.verifierArticle(articleId);

    const tags: Tag[] = [];
    for (const nom of nomsUniques.values()) {
      tags.push(await this.depotTags.trouverOuCreer(nom));
    }
    await this.depotAnnotations.definirTags(utilisateurId, articleId, tags.map(t => t.id));
    await this.invaliderFil(utilisateurId);
    return tags;
  }

  /**
   * Annotations d'un lot d'articles
   */
  async obtenirAnnotations(utilisateurId: string, articleIds: string[]): Promise<Map<string, AnnotationArticle>> {
    if (articleIds.length === 0) {
      return new Map();
    }
    return this.depotAnnotations.obtenirAnnotations(utilisateurId, articleIds);
  }

  /**
   * Tags utilisés par l'utilisateur sur ses articles
   */
  async listerTagsUtilises(utilisateurId: string): Promise<TagArticlesUtilise[]> {
    return this.depotAnnotations.listerTagsUtilises(utilisateurId);
  }

  private async verifierArticle(articleId: string): Promise<void> {
    const article = await this.depotArticles.trouverParId(articleId);
    if (!article) {
      throw new ErreurAnnotation('Article introuvable', 'ARTICLE_INTROUVABLE');
    }
  }

  /**
   * Le fil est mis en cache par critères : une note ou un tag change les tris et filtres
   */
  private async invaliderFil(utilisateurId: string): Promise<void> {
    await this.serviceCache?.supprimerPattern(`${PREFIXES_CACHE.ARTICLES}fil:${utilisateurId}:*`);
  }
}
