/**
 * Veilleur - Worker de traitement d'images BullMQ
 * Téléchargement et génération de miniatures en arrière-plan
 */

import { Worker, Queue, Job } from 'bullmq';
import { obtenirRedisBullMQ } from '../cache/connexionRedis';
import { loggerJobs } from '../logging/logger';
import { env } from '@/config/environnement';
import { DepotImagesCacheMariaDB } from '../persistence/DepotImagesCacheMariaDB';
import {
  ServiceImagesCache,
  initialiserServiceImagesCache,
  obtenirGestionnaireStockage,
} from '../images';
import type { DonneesJobImage, ResultatJobImage, ResultatDecouverteImage, JobImage, JobNettoyageImages } from '../images';
import { DepotArticlesMariaDB } from '../persistence/DepotArticlesMariaDB';
import { obtenirServiceScraping } from '../scraping/ServiceScraping';
import { traiterDecouverteImage } from './decouverteImage';

/**
 * Nom de la queue d'images
 */
export const NOM_QUEUE_IMAGES = 'veilleur-images';

/**
 * Crée la queue d'images
 */
export function creerQueueImages(): Queue<DonneesJobImage> {
  const connexion = obtenirRedisBullMQ();

  const queue = new Queue<DonneesJobImage>(NOM_QUEUE_IMAGES, {
    connection: connexion,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000, // 10 secondes
      },
      removeOnComplete: {
        count: 5000, // Garder les 5000 derniers jobs complétés
      },
      removeOnFail: {
        count: 1000, // Garder les 1000 derniers échecs
      },
    },
  });

  loggerJobs.info('Queue d\'images créée');

  return queue;
}

/**
 * Crée le worker d'images
 */
export function creerWorkerImages(): Worker<DonneesJobImage, ResultatJobImage | ResultatDecouverteImage | number> {
  const connexion = obtenirRedisBullMQ();

  // Initialiser le dépôt et le service
  const depotImages = new DepotImagesCacheMariaDB();
  const serviceImages = initialiserServiceImagesCache(depotImages);

  // La découverte d'image lit la page de l'article puis ré-enfile le téléchargement dans cette même file
  const depotArticles = new DepotArticlesMariaDB();
  const queueDecouverte = creerQueueImages();
  const dependancesDecouverte = {
    depotArticles,
    enrichir: (url: string) => obtenirServiceScraping().enrichirArticle(url),
    enfilerImage: (urlImage: string, articleId: string) => ajouterJobImage(queueDecouverte, urlImage, articleId),
  };

  // Initialiser les dossiers de stockage
  obtenirGestionnaireStockage().initialiser().catch(err => {
    loggerJobs.error({ erreur: err }, 'Erreur initialisation dossiers images');
  });

  const worker = new Worker<DonneesJobImage, ResultatJobImage | ResultatDecouverteImage | number>(
    NOM_QUEUE_IMAGES,
    async (job: Job<DonneesJobImage>) => {
      loggerJobs.debug({ jobId: job.id, type: job.data.type }, 'Traitement job image');

      if (job.data.type === 'telecharger-image') {
        return traiterTelechargementImage(job.data, serviceImages);
      }

      if (job.data.type === 'decouvrir-image') {

        return traiterDecouverteImage(job.data, dependancesDecouverte);

      }

      if (job.data.type === 'nettoyage-images') {
        return traiterNettoyageImages(job.data, serviceImages);
      }

      throw new Error(`Type de job image inconnu: ${(job.data as DonneesJobImage).type}`);
    },
    {
      connection: connexion,
      concurrency: 3, // 3 téléchargements en parallèle
      limiter: {
        max: 20,
        duration: 60000, // 20 images par minute max
      },
    },
  );

  // Événements du worker
  worker.on('completed', (job, result) => {
    if (job.data.type === 'telecharger-image') {
      const res = result as ResultatJobImage;
      loggerJobs.debug(
        { jobId: job.id, hashUrl: res.hashUrl, succes: res.succes },
        'Job image terminé',
      );
    } else if (job.data.type === 'decouvrir-image') {
      loggerJobs.debug({ jobId: job.id, ...(result as ResultatDecouverteImage) }, 'Découverte d\'image terminée');
    } else {
      loggerJobs.info({ jobId: job.id, supprimees: result }, 'Nettoyage images terminé');
    }
  });

  worker.on('failed', (job, err) => {
    loggerJobs.warn({ jobId: job?.id, erreur: err.message }, 'Job image échoué');
  });

  worker.on('error', err => {
    loggerJobs.error({ erreur: err.message }, 'Erreur worker images');
  });

  loggerJobs.info('Worker d\'images démarré');

  return worker;
}

/**
 * Traite le téléchargement d'une image
 */
async function traiterTelechargementImage(
  donnees: JobImage,
  serviceImages: ServiceImagesCache,
): Promise<ResultatJobImage> {
  const { hashUrl, urlOriginale } = donnees;

  try {
    const succes = await serviceImages.traiterImage(hashUrl, urlOriginale);

    return {
      hashUrl,
      succes,
      erreur: succes ? undefined : 'Échec du traitement',
    };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'Erreur inconnue';

    loggerJobs.error(
      { hashUrl, url: urlOriginale, erreur: message },
      'Erreur traitement image',
    );

    return {
      hashUrl,
      succes: false,
      erreur: message,
    };
  }
}

/**
 * Traite le nettoyage des images anciennes
 */
async function traiterNettoyageImages(
  donnees: JobNettoyageImages,
  serviceImages: ServiceImagesCache,
): Promise<number> {
  const { retentionJours } = donnees;

  try {
    return await serviceImages.nettoyerImagesAnciennes(retentionJours);
  } catch (erreur) {
    loggerJobs.error({ erreur }, 'Erreur nettoyage images');
    throw erreur;
  }
}

/**
 * Planifie les jobs récurrents pour les images
 */
export async function planifierJobsImagesRecurrents(queue: Queue<DonneesJobImage>): Promise<void> {
  // Supprimer les anciens jobs récurrents
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Planifier le nettoyage quotidien à 3h du matin
  await queue.add(
    'nettoyage-images',
    {
      type: 'nettoyage-images',
      retentionJours: env.IMAGES_RETENTION_JOURS,
    },
    {
      repeat: {
        pattern: '0 3 * * *', // Tous les jours à 3h
      },
    },
  );

  loggerJobs.info(
    { retentionJours: env.IMAGES_RETENTION_JOURS },
    'Nettoyage d\'images planifié (tous les jours à 3h)',
  );
}

/**
 * Ajoute un job de téléchargement d'image
 */
export async function ajouterJobImage(
  queue: Queue<DonneesJobImage>,
  urlImage: string,
  articleId?: string,
): Promise<string | undefined> {
  const hashUrl = ServiceImagesCache.hashUrl(urlImage);

  const job = await queue.add(
    `image-${hashUrl}`,
    {
      type: 'telecharger-image',
      hashUrl,
      urlOriginale: urlImage,
      articleId,
    },
    {
      // Dédupliquer les jobs pour la même image
      jobId: `img-${hashUrl}`,
    },
  );

  loggerJobs.debug({ jobId: job.id, hashUrl }, 'Job image ajouté');

  return job.id;
}

/**
 * Ajoute plusieurs jobs d'images en lot
 */
export async function ajouterJobsImages(
  queue: Queue<DonneesJobImage>,
  images: Array<{ url: string; articleId?: string }>,
): Promise<void> {
  const jobs = images.map(img => {
    const hashUrl = ServiceImagesCache.hashUrl(img.url);
    return {
      name: `image-${hashUrl}`,
      data: {
        type: 'telecharger-image' as const,
        hashUrl,
        urlOriginale: img.url,
        articleId: img.articleId,
      },
      opts: {
        jobId: `img-${hashUrl}`,
      },
    };
  });

  await queue.addBulk(jobs);

  loggerJobs.debug({ count: images.length }, 'Jobs images ajoutés en lot');
}

/**
 * Enfile la découverte d'image d'un article sans illustration (une seule tentative, dédupliquée par article)
 */
export async function ajouterJobDecouverteImage(
  queue: Queue<DonneesJobImage>,
  articleId: string,
  delaiMs = 0,
): Promise<string | undefined> {
  const job = await queue.add(
    `decouverte-${articleId}`,
    { type: 'decouvrir-image', articleId },
    { jobId: `decouvrir-${articleId}`, attempts: 1, delay: delaiMs },
  );
  return job.id;
}

/**
 * Enfile en lot des découvertes d'image, espacées pour ménager les sites visités
 */
export async function ajouterJobsDecouverteImages(
  queue: Queue<DonneesJobImage>,
  articleIds: string[],
  espacementMs = 1500,
): Promise<void> {
  await queue.addBulk(articleIds.map((articleId, i) => ({
    name: `decouverte-${articleId}`,
    data: { type: 'decouvrir-image' as const, articleId },
    opts: { jobId: `decouvrir-${articleId}`, attempts: 1, delay: i * espacementMs },
  })));
  loggerJobs.info({ articles: articleIds.length, espacementMs }, 'Découvertes d\'image enfilées en lot');
}
