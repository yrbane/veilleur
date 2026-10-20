/**
 * Veilleur - Service de découverte communautaire
 * Gère les sources populaires et le filtrage par tags
 */

import type { DepotSources } from '@/domaine/ports/DepotSources';
import type { DepotArticles } from '@/domaine/ports/DepotArticles';
import type { ArticleApprecie } from '@/domaine/entites/Article';
import type {
  SourcePopulaire,
  TagPopulaire,
  CriteresCommunaute,
  ResultatPagine,
} from '@/domaine/ports/DepotSources';

// Ré-exporter les types pour utilisation externe
export type { SourcePopulaire, TagPopulaire, CriteresCommunaute, ResultatPagine };

/**
 * Service de découverte communautaire
 */
export class ServiceCommunaute {
  constructor(
    private readonly depotSources: DepotSources,
    private readonly depotArticles?: Pick<DepotArticles, 'listerArticlesApprecies'>,
  ) {}

  /**
   * Sources que suivent les utilisateurs aux goûts proches, pas encore suivies
   */
  async listerSuggestions(utilisateurId: string, limite = 6): Promise<SourcePopulaire[]> {
    return this.depotSources.listerSourcesSuggerees(utilisateurId, limite);
  }

  /**
   * Articles plébiscités (favoris, notes) sur les derniers jours
   */
  async listerArticlesApprecies(jours = 7, limite = 10, maintenant: Date = new Date()): Promise<ArticleApprecie[]> {
    if (!this.depotArticles) return [];
    const depuis = new Date(maintenant.getTime() - jours * 24 * 3600 * 1000);
    return this.depotArticles.listerArticlesApprecies(depuis, limite);
  }

  /**
   * Liste les sources populaires
   */
  async listerSourcesPopulaires(
    criteres: CriteresCommunaute = {},
  ): Promise<ResultatPagine<SourcePopulaire>> {
    const page = criteres.page ?? 1;
    const limite = criteres.limite ?? 20;
    const tri = criteres.tri ?? 'populaire';

    // Récupérer les sources populaires depuis le dépôt
    const resultat = await this.depotSources.listerSourcesPopulaires({
      page,
      limite,
      tag: criteres.tag,
      tri,
      recherche: criteres.recherche,
    });

    return resultat;
  }

  /**
   * Liste les tags populaires
   */
  async listerTagsPopulaires(limite = 20): Promise<TagPopulaire[]> {
    return this.depotSources.listerTagsPopulaires(limite);
  }

  /**
   * Recherche des sources
   */
  async rechercherSources(
    terme: string,
    criteres: CriteresCommunaute = {},
  ): Promise<ResultatPagine<SourcePopulaire>> {
    return this.listerSourcesPopulaires({
      ...criteres,
      recherche: terme,
    });
  }
}
