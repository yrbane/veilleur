/**
 * Veilleur - Rattrapage du cache d'images
 * Ré-enfile un job de cache pour chaque image d'article qui n'est pas « terminée »
 * dans images_cachees. Utile après la correction 0.2.4 : les images traitées avant
 * n'avaient aucune ligne en base et restaient introuvables (404).
 *
 * Usage : node dist/rattraper-images.js (le worker du service traite ensuite la file)
 */

import { pathToFileURL } from 'url';
import { eq, isNotNull } from 'drizzle-orm';
import { creerConnexion, fermerConnexion, obtenirBdd } from '../persistence/connexion';
import { articles, imagesCachees } from '../persistence/schema';
import { creerConnexionRedis, fermerConnexionRedis } from '../cache/connexionRedis';
import { ServiceImagesCache } from '../images/ServiceImagesCache';
import { ajouterJobsImages, creerQueueImages } from './WorkerImages';
import { loggerJobs } from '../logging/logger';

/**
 * Enfile les images manquantes et retourne leur nombre
 */
export async function rattraperImages(): Promise<number> {
  await creerConnexion();
  await creerConnexionRedis();
  const db = obtenirBdd();

  const lignes = await db
    .select({ id: articles.id, urlImage: articles.urlImage })
    .from(articles)
    .where(isNotNull(articles.urlImage));

  const terminees = new Set(
    (await db.select({ hash: imagesCachees.hashUrl }).from(imagesCachees).where(eq(imagesCachees.statut, 'termine')))
      .map(ligne => ligne.hash),
  );

  // Une image par hash, en ignorant celles déjà en cache
  const aEnfiler = new Map<string, { url: string; articleId: string }>();
  for (const ligne of lignes) {
    if (!ligne.urlImage) continue;
    const hash = ServiceImagesCache.hashUrl(ligne.urlImage);
    if (!terminees.has(hash) && !aEnfiler.has(hash)) {
      aEnfiler.set(hash, { url: ligne.urlImage, articleId: ligne.id });
    }
  }

  const queue = creerQueueImages();
  try {
    // Les jobs terminés conservent leur jobId « img-<hash> » : les purger autorise le ré-enfilement
    await queue.clean(0, 100000, 'completed');
    await queue.clean(0, 100000, 'failed');
    if (aEnfiler.size > 0) {
      await ajouterJobsImages(queue, [...aEnfiler.values()]);
    }
  } finally {
    await queue.close();
  }

  loggerJobs.info({ images: aEnfiler.size, articlesAvecImage: lignes.length }, 'Rattrapage du cache d\'images enfilé');
  return aEnfiler.size;
}

// Point d'entrée si exécuté directement (node dist/rattraper-images.js)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rattraperImages()
    .then(async () => {
      await fermerConnexionRedis();
      await fermerConnexion();
      process.exit(0);
    })
    .catch(erreur => {
      loggerJobs.error({ erreur }, 'Échec du rattrapage du cache d\'images');
      process.exit(1);
    });
}
