/**
 * Veilleur - Rattrapage des mots-clés
 * Extrait les mots-clés des articles créés avant la 0.5.0 (titre + résumé stocké).
 *
 * Usage : node dist/rattraper-mots-cles.js
 */

import { pathToFileURL } from 'url';
import { creerConnexion, fermerConnexion } from '../persistence/connexion';
import { DepotArticlesMariaDB } from '../persistence/DepotArticlesMariaDB';
import { extraireMotsCles } from '@/domaine/services/ExtractionMotsCles';
import { loggerJobs } from '../logging/logger';

const TAILLE_LOT = 500;

/**
 * Traite tous les articles sans mots-clés, par lots ; retourne le nombre traité
 */
export async function rattraperMotsCles(depot = new DepotArticlesMariaDB()): Promise<number> {
  let traites = 0;
  for (;;) {
    const lot = await depot.listerSansMotsCles(TAILLE_LOT);
    if (lot.length === 0) break;
    for (const article of lot) {
      const mots = extraireMotsCles({ titre: article.titre, resume: article.resume });
      // Un article sans mot exploitable reçoit un marqueur vide pour ne pas être repris à chaque passage
      await depot.definirMotsCles(article.id, mots.length > 0 ? mots : ['—']);
      traites++;
    }
    loggerJobs.info({ traites }, 'Rattrapage des mots-clés en cours');
    if (lot.length < TAILLE_LOT) break;
  }
  return traites;
}

// Point d'entrée si exécuté directement
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  creerConnexion()
    .then(() => rattraperMotsCles())
    .then(async traites => {
      loggerJobs.info({ traites }, 'Rattrapage des mots-clés terminé');
      await fermerConnexion();
      process.exit(0);
    })
    .catch(erreur => {
      loggerJobs.error({ erreur }, 'Échec du rattrapage des mots-clés');
      process.exit(1);
    });
}
