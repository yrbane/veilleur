/**
 * Veilleur - Service de découverte communautaire
 * Gère les sources populaires et le filtrage par tags
 */

import type { DepotSources } from '@/domaine/ports/DepotSources';
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
  constructor(private readonly depotSources: DepotSources) {}

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
