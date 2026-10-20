/**
 * Veilleur - Mots-clés tendance
 * Un mot « monte » quand il apparaît bien plus dans les dernières 24 h que sa moyenne
 * quotidienne des sept jours précédents. Portée : le fil d'un utilisateur, ou tous les articles.
 */

import type { DepotArticles } from '@/domaine/ports/DepotArticles';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE } from '@/domaine/ports/ServiceCache';

export interface Tendance {
  mot: string;
  /** Articles des dernières 24 h portant le mot */
  nombreRecents: number;
  /** Articles des 7 jours précédents portant le mot */
  nombreReference: number;
  /** Rapport entre les 24 h et la moyenne quotidienne de référence (≥ 1 = en hausse) */
  score: number;
}

export interface OptionsTendances {
  utilisateurId?: string;
  limite?: number;
  maintenant?: Date;
}

const HEURES_RECENTES = 24;
const JOURS_REFERENCE = 7;
const CANDIDATS = 60;
const RECENTS_MIN = 2;
const LIMITE_DEFAUT = 10;
const CACHE_S = 600;
const MOT_VIDE = '—';

export class ServiceTendances {
  constructor(
    private readonly depotArticles: Pick<DepotArticles, 'compterMotsCles'>,
    private readonly serviceCache?: Pick<ServiceCache, 'obtenir' | 'stocker'>,
  ) {}

  async lister(options: OptionsTendances = {}): Promise<Tendance[]> {
    const limite = options.limite ?? LIMITE_DEFAUT;
    const cle = `${PREFIXES_CACHE.ARTICLES}tendances:${options.utilisateurId ?? 'global'}:${limite}`;
    const enCache = await this.serviceCache?.obtenir<Tendance[]>(cle);
    if (enCache) return enCache;

    const maintenant = options.maintenant ?? new Date();
    const debutRecents = new Date(maintenant.getTime() - HEURES_RECENTES * 3600 * 1000);
    const debutReference = new Date(debutRecents.getTime() - JOURS_REFERENCE * 24 * 3600 * 1000);

    const recents = (await this.depotArticles.compterMotsCles({
      utilisateurId: options.utilisateurId,
      depuis: debutRecents,
      jusqua: maintenant,
      limite: CANDIDATS,
    })).filter(m => m.mot !== MOT_VIDE && m.nombreArticles >= RECENTS_MIN);
    if (recents.length === 0) return [];

    const reference = await this.depotArticles.compterMotsCles({
      utilisateurId: options.utilisateurId,
      depuis: debutReference,
      jusqua: debutRecents,
      mots: recents.map(m => m.mot),
    });
    const referenceParMot = new Map(reference.map(m => [m.mot, m.nombreArticles]));

    const tendances = recents
      .map(({ mot, nombreArticles }) => {
        const nombreReference = referenceParMot.get(mot) ?? 0;
        const moyenneQuotidienne = nombreReference / JOURS_REFERENCE;
        return {
          mot,
          nombreRecents: nombreArticles,
          nombreReference,
          score: Math.round((nombreArticles / (moyenneQuotidienne + 1)) * 100) / 100,
        };
      })
      .sort((a, b) => b.score - a.score || b.nombreRecents - a.nombreRecents || a.mot.localeCompare(b.mot, 'fr'))
      .slice(0, limite);

    await this.serviceCache?.stocker(cle, tendances, { ttl: CACHE_S });
    return tendances;
  }
}
