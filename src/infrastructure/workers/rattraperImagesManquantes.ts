/**
 * Veilleur - Rattrapage des articles sans image : enfile une découverte d'image
 * (lecture de la page, Open Graph / Twitter) pour chaque article jamais examiné.
 *
 * Usage : node dist/rattraper-images-manquantes.js [--limite N] [--espacement MS]
 * Le worker du service traite ensuite la file ; les images trouvées partent dans le cache.
 */

import { pathToFileURL } from 'url';
import { and, isNull, or, eq, desc } from 'drizzle-orm';
import { creerConnexion, fermerConnexion, obtenirBdd } from '../persistence/connexion';
import { articles } from '../persistence/schema';
import { creerConnexionRedis, fermerConnexionRedis } from '../cache/connexionRedis';
import { ajouterJobsDecouverteImages, creerQueueImages } from './WorkerImages';
import { loggerJobs } from '../logging/logger';

export interface OptionsRattrapage {
  limite?: number;
  espacementMs?: number;
}

/**
 * Enfile les découvertes d'image et retourne le nombre d'articles concernés
 */
export async function rattraperImagesManquantes(options: OptionsRattrapage = {}): Promise<number> {
  await creerConnexion();
  await creerConnexionRedis();
  const db = obtenirBdd();
  // Les plus récents d'abord : ce sont ceux que les lecteurs voient
  let requete = db
    .select({ id: articles.id })
    .from(articles)
    .where(and(or(isNull(articles.urlImage), eq(articles.urlImage, '')), isNull(articles.dateRechercheImage)))
    .orderBy(desc(articles.datePublication))
    .$dynamic();
  if (options.limite) requete = requete.limit(options.limite);
  const lignes = await requete;

  const queue = creerQueueImages();
  try {
    // Un job terminé garde son jobId « decouvrir-<id> » : le purger autorise une nouvelle passe
    await queue.clean(0, 100000, 'completed');
    await queue.clean(0, 100000, 'failed');
    if (lignes.length > 0) {
      await ajouterJobsDecouverteImages(queue, lignes.map(l => l.id), options.espacementMs);
    }
  } finally {
    await queue.close();
  }
  loggerJobs.info({ articles: lignes.length }, 'Rattrapage des images manquantes enfilé');
  return lignes.length;
}

function lireOptions(argv: string[]): OptionsRattrapage {
  const options: OptionsRattrapage = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limite' && argv[i + 1]) options.limite = Number(argv[++i]);
    if (argv[i] === '--espacement' && argv[i + 1]) options.espacementMs = Number(argv[++i]);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rattraperImagesManquantes(lireOptions(process.argv.slice(2)))
    .then(async nombre => {
      console.error(`${nombre} article(s) sans image enfilé(s) pour découverte`);
      await fermerConnexionRedis();
      await fermerConnexion();
      process.exit(0);
    })
    .catch(erreur => {
      loggerJobs.error({ erreur }, 'Échec du rattrapage des images manquantes');
      process.exit(1);
    });
}
