/**
 * Veilleur - Worker de synchronisation BullMQ
 * Exécute les tâches de synchronisation des sources en arrière-plan
 */

import { Worker, Queue, Job } from 'bullmq';
import { obtenirRedis } from '../cache/connexionRedis';
import { obtenirServiceScraping } from '../scraping/ServiceScraping';
import { DepotSourcesMariaDB } from '../persistence/DepotSourcesMariaDB';
import { DepotArticlesMariaDB } from '../persistence/DepotArticlesMariaDB';
import { loggerJobs as loggerWorker } from '../logging/logger';

/**
 * Nom de la queue de synchronisation
 */
export const NOM_QUEUE_SYNCHRO = 'veilleur:synchro';

/**
 * Types de jobs
 */
export interface JobSynchroSource {
  type: 'synchro-source';
  sourceId: string;
}

export interface JobSynchroToutesLes {
  type: 'synchro-toutes';
  utilisateurId?: string;
}

export type DonneesJob = JobSynchroSource | JobSynchroToutesLes;

/**
 * Résultat d'une synchronisation
 */
export interface ResultatSynchro {
  sourceId: string;
  nouveauxArticles: number;
  erreur?: string;
}

/**
 * Crée la queue de synchronisation
 */
export function creerQueueSynchro(): Queue<DonneesJob> {
  const connexion = obtenirRedis();

  const queue = new Queue<DonneesJob>(NOM_QUEUE_SYNCHRO, {
    connection: connexion,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        count: 1000, // Garder les 1000 derniers jobs complétés
      },
      removeOnFail: {
        count: 500, // Garder les 500 derniers échecs
      },
    },
  });

  loggerWorker.info('Queue de synchronisation créée');

  return queue;
}

/**
 * Crée le worker de synchronisation
 */
export function creerWorkerSynchro(): Worker<DonneesJob, ResultatSynchro | ResultatSynchro[]> {
  const connexion = obtenirRedis();
  const serviceScraping = obtenirServiceScraping();
  const depotSources = new DepotSourcesMariaDB();
  const depotArticles = new DepotArticlesMariaDB();

  const worker = new Worker<DonneesJob, ResultatSynchro | ResultatSynchro[]>(
    NOM_QUEUE_SYNCHRO,
    async (job: Job<DonneesJob>) => {
      loggerWorker.info({ jobId: job.id, type: job.data.type }, 'Traitement du job');

      if (job.data.type === 'synchro-source') {
        return traiterSynchroSource(job.data, serviceScraping, depotSources, depotArticles);
      }

      if (job.data.type === 'synchro-toutes') {
        return traiterSynchroToutes(job.data, serviceScraping, depotSources, depotArticles);
      }

      throw new Error(`Type de job inconnu: ${(job.data as DonneesJob).type}`);
    },
    {
      connection: connexion,
      concurrency: 5, // 5 jobs en parallèle max
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs par minute max (pour éviter le rate limiting)
      },
    },
  );

  // Événements du worker
  worker.on('completed', (job, result) => {
    loggerWorker.info({ jobId: job.id, result }, 'Job terminé avec succès');
  });

  worker.on('failed', (job, err) => {
    loggerWorker.error({ jobId: job?.id, erreur: err.message }, 'Job échoué');
  });

  worker.on('error', err => {
    loggerWorker.error({ erreur: err.message }, 'Erreur worker');
  });

  loggerWorker.info('Worker de synchronisation démarré');

  return worker;
}

/**
 * Traite la synchronisation d'une source spécifique
 */
async function traiterSynchroSource(
  donnees: JobSynchroSource,
  serviceScraping: ReturnType<typeof obtenirServiceScraping>,
  depotSources: DepotSourcesMariaDB,
  depotArticles: DepotArticlesMariaDB,
): Promise<ResultatSynchro> {
  const { sourceId } = donnees;

  try {
    // Récupérer la source
    const source = await depotSources.trouverParId(sourceId);
    if (!source) {
      return { sourceId, nouveauxArticles: 0, erreur: 'Source introuvable' };
    }

    // Extraire les articles
    const resultat = await serviceScraping.extraireArticles(source.url, source.typeSource);

    // Sauvegarder les nouveaux articles
    let nouveauxArticles = 0;
    for (const articleBrut of resultat.articles) {
      const existe = await depotArticles.existeParLien(articleBrut.lien);
      if (!existe) {
        await depotArticles.creer({
          sourceId,
          titre: articleBrut.titre,
          lien: articleBrut.lien,
          datePublication: articleBrut.datePublication ?? new Date(),
          resume: articleBrut.resume,
          urlImage: articleBrut.urlImage,
          auteur: articleBrut.auteur,
          metaOpenGraph: {},
          metaTwitter: {},
          hashContenu: null,
        });
        nouveauxArticles++;
      }
    }

    // Mettre à jour la date de dernière synchro
    await depotSources.mettreAJour(sourceId, {
      dateDerniereSynchro: new Date(),
      nombreEchecs: 0,
    });

    loggerWorker.info({ sourceId, nom: source.nom, nouveauxArticles }, 'Source synchronisée');

    return { sourceId, nouveauxArticles };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'Erreur inconnue';

    // Incrémenter le compteur d'échecs
    const source = await depotSources.trouverParId(sourceId);
    if (source) {
      await depotSources.mettreAJour(sourceId, {
        nombreEchecs: (source.nombreEchecs ?? 0) + 1,
      });
    }

    loggerWorker.error({ sourceId, erreur: message }, 'Échec synchronisation source');

    return { sourceId, nouveauxArticles: 0, erreur: message };
  }
}

/**
 * Traite la synchronisation de toutes les sources actives
 */
async function traiterSynchroToutes(
  _donnees: JobSynchroToutesLes,
  serviceScraping: ReturnType<typeof obtenirServiceScraping>,
  depotSources: DepotSourcesMariaDB,
  depotArticles: DepotArticlesMariaDB,
): Promise<ResultatSynchro[]> {
  // Récupérer les sources actives à synchroniser
  const sources = await depotSources.listerSourcesARafraichir();

  loggerWorker.info({ nombreSources: sources.length }, 'Début synchronisation globale');

  const resultats: ResultatSynchro[] = [];

  // Traiter chaque source
  for (const source of sources) {
    const resultat = await traiterSynchroSource(
      { type: 'synchro-source', sourceId: source.id },
      serviceScraping,
      depotSources,
      depotArticles,
    );
    resultats.push(resultat);

    // Petite pause entre les sources pour éviter de surcharger
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const totalNouveaux = resultats.reduce((acc, r) => acc + r.nouveauxArticles, 0);
  loggerWorker.info({ nombreSources: sources.length, totalNouveaux }, 'Synchronisation globale terminée');

  return resultats;
}

/**
 * Planifie les jobs de synchronisation récurrents
 */
export async function planifierSynchroRecurrente(queue: Queue<DonneesJob>): Promise<void> {
  // Supprimer les anciens jobs récurrents
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Planifier la synchronisation toutes les 15 minutes
  await queue.add(
    'synchro-toutes',
    { type: 'synchro-toutes' },
    {
      repeat: {
        pattern: '*/15 * * * *', // Toutes les 15 minutes
      },
    },
  );

  loggerWorker.info('Synchronisation récurrente planifiée (toutes les 15 minutes)');
}

/**
 * Ajoute un job de synchronisation pour une source
 */
export async function ajouterJobSynchroSource(
  queue: Queue<DonneesJob>,
  sourceId: string,
): Promise<string | undefined> {
  const job = await queue.add(
    `synchro-${sourceId}`,
    { type: 'synchro-source', sourceId },
    {
      priority: 1, // Priorité haute pour les synchros manuelles
    },
  );

  loggerWorker.info({ jobId: job.id, sourceId }, 'Job de synchronisation ajouté');

  return job.id;
}
