/**
 * Veilleur - Service d'annotations d'articles
 * Noter (1 à 5) et mettre en favori les articles, par utilisateur
 */

import type { DepotAnnotationsArticles } from '@/domaine/ports/DepotAnnotationsArticles';
import type { CompteNonLus, DepotArticles } from '@/domaine/ports/DepotArticles';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE } from '@/domaine/ports/ServiceCache';
import type { AnnotationArticle, AnnotationExportee } from '@/domaine/entites/Article';
import { formaterCsv } from '@/shared/utils/csv';
import { estNoteValide, NOTE_ARTICLE_MAX, NOTE_ARTICLE_MIN } from '@/domaine/entites/Article';

/**
 * Erreurs du service
 */
export class ErreurAnnotation extends Error {
  constructor(
    message: string,
    public readonly code: 'NOTE_INVALIDE' | 'ARTICLE_INTROUVABLE',
  ) {
    super(message);
    this.name = 'ErreurAnnotation';
  }
}

export type FormatExport = 'json' | 'csv';

export interface ExportAnnotations {
  contenu: string;
  typeMime: string;
  nomFichier: string;
}

const COLONNES_EXPORT: (keyof AnnotationExportee & string)[] = [
  'titre', 'lien', 'source', 'datePublication', 'note', 'favori', 'aLire', 'lu', 'dateMiseAJour',
];

export class ServiceAnnotationsArticles {
  constructor(
    private readonly depotAnnotations: DepotAnnotationsArticles,
    private readonly depotArticles: Pick<DepotArticles, 'trouverParId' | 'marquerTousLus' | 'compterNonLus'>,
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
   * Annotations d'un lot d'articles
   */
  async marquerLu(utilisateurId: string, articleId: string, lu: boolean): Promise<{ lu: boolean }> {
    await this.verifierArticle(articleId);
    await this.depotAnnotations.marquerLu(utilisateurId, articleId, lu);
    await this.invaliderFil(utilisateurId);
    return { lu };
  }

  /**
   * « Tout marquer comme lu » : borné à l'instant du clic pour ne pas avaler les articles arrivés ensuite
   */
  async definirALire(utilisateurId: string, articleId: string, aLire: boolean): Promise<{ aLire: boolean }> {
    await this.verifierArticle(articleId);
    await this.depotAnnotations.definirALire(utilisateurId, articleId, aLire);
    await this.invaliderFil(utilisateurId);
    return { aLire };
  }

  /**
   * Export de toutes les annotations (notes, favoris, liste de lecture, lus) en JSON ou CSV
   */
  async exporterAnnotations(utilisateurId: string, format: FormatExport, date: Date = new Date()): Promise<ExportAnnotations> {
    const annotations = await this.depotAnnotations.listerAnnotations(utilisateurId);
    const jour = date.toISOString().slice(0, 10);
    if (format === 'csv') {
      return {
        contenu: formaterCsv(annotations as unknown as Record<string, unknown>[], COLONNES_EXPORT),
        typeMime: 'text/csv; charset=utf-8',
        nomFichier: `veilleur-annotations-${jour}.csv`,
      };
    }
    return {
      contenu: JSON.stringify({ exporteLe: date.toISOString(), nombre: annotations.length, annotations }, null, 2),
      typeMime: 'application/json; charset=utf-8',
      nomFichier: `veilleur-annotations-${jour}.json`,
    };
  }

  async marquerTousLus(utilisateurId: string, options: { sourceId?: string; avant?: Date }): Promise<{ marques: number }> {
    const marques = await this.depotArticles.marquerTousLus(utilisateurId, {
      sourceId: options.sourceId,
      avant: options.avant ?? new Date(),
    });
    await this.invaliderFil(utilisateurId);
    return { marques };
  }

  async compterNonLus(utilisateurId: string): Promise<CompteNonLus> {
    return this.depotArticles.compterNonLus(utilisateurId);
  }

  async obtenirAnnotations(utilisateurId: string, articleIds: string[]): Promise<Map<string, AnnotationArticle>> {
    if (articleIds.length === 0) {
      return new Map();
    }
    return this.depotAnnotations.obtenirAnnotations(utilisateurId, articleIds);
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
