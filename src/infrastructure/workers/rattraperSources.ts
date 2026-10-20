/**
 * Veilleur - Rattrapage des sources
 * Complète le favicon et les tags suggérés des sources créées avant la 0.6.0,
 * puis pose ces tags sur les abonnements qui n'en ont encore aucun.
 *
 * Usage : node dist/rattraper-sources.js
 */

import { pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';
import { creerConnexion, fermerConnexion, obtenirBdd } from '../persistence/connexion';
import { sources, utilisateursSources } from '../persistence/schema';
import { DepotSourcesMariaDB, DepotParametresSourcesMariaDB } from '../persistence/DepotSourcesMariaDB';
import { obtenirDepotTags } from '../persistence/DepotTagsMariaDB';
import { obtenirServiceScraping } from '../scraping/ServiceScraping';
import { ServiceSources } from '@/domaine/services/ServiceSources';
import { loggerJobs } from '../logging/logger';

export interface BilanRattrapageSources {
  sources: number;
  favicons: number;
  abonnementsTagues: number;
}

export async function rattraperSources(): Promise<BilanRattrapageSources> {
  const db = obtenirBdd();
  const depotSources = new DepotSourcesMariaDB();
  const depotTags = obtenirDepotTags();
  const scraping = obtenirServiceScraping();
  const serviceSources = new ServiceSources(depotSources, new DepotParametresSourcesMariaDB(), undefined, undefined, depotTags);
  const bilan: BilanRattrapageSources = { sources: 0, favicons: 0, abonnementsTagues: 0 };

  const lignes = await db.select().from(sources);
  for (const source of lignes) {
    bilan.sources++;
    let tagsSuggeres = source.tagsSuggeres ?? null;
    if (!source.urlFavicon || tagsSuggeres === null) {
      try {
        const detection = await scraping.detecterSource(source.url);
        const miseAJour: { urlFavicon?: string | null; tagsSuggeres?: string[] } = {};
        if (!source.urlFavicon && detection.favicon) {
          miseAJour.urlFavicon = detection.favicon;
          bilan.favicons++;
        }
        if (tagsSuggeres === null) {
          tagsSuggeres = detection.tags ?? [];
          miseAJour.tagsSuggeres = tagsSuggeres;
        }
        await depotSources.mettreAJour(source.id, miseAJour);
        loggerJobs.info({ source: source.nom, ...miseAJour }, 'Source complétée');
      } catch (erreur) {
        loggerJobs.warn({ erreur, source: source.nom }, 'Détection impossible, source ignorée');
        continue;
      }
    }

    if (!tagsSuggeres || tagsSuggeres.length === 0) continue;
    const abonnements = await db
      .select({ id: utilisateursSources.id })
      .from(utilisateursSources)
      .where(eq(utilisateursSources.sourceId, source.id));
    for (const abonnement of abonnements) {
      const existants = await depotTags.listerTagsSource(abonnement.id);
      if (existants.length > 0) continue;
      await serviceSources.appliquerTagsSuggeres(abonnement.id, tagsSuggeres);
      bilan.abonnementsTagues++;
    }
  }
  return bilan;
}

// Point d'entrée si exécuté directement
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  creerConnexion()
    .then(() => rattraperSources())
    .then(async bilan => {
      loggerJobs.info(bilan, 'Rattrapage des sources terminé');
      await fermerConnexion();
      process.exit(0);
    })
    .catch(erreur => {
      loggerJobs.error({ erreur }, 'Échec du rattrapage des sources');
      process.exit(1);
    });
}
