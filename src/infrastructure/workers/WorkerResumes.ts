/**
 * Veilleur - Worker des résumés courriel (quotidien à 7 h, hebdomadaire le lundi à 7 h)
 */

import { Worker, Queue, Job } from 'bullmq';
import { obtenirRedisBullMQ } from '../cache/connexionRedis';
import { loggerJobs } from '../logging/logger';
import { obtenirServiceNotifications } from '../notifications/fabrique';
import type { FrequenceResume } from '@/domaine/ports/DepotNotifications';

export const NOM_QUEUE_RESUMES = 'resumes';

export interface DonneesJobResume {
  frequence: FrequenceResume;
}

export function creerQueueResumes(): Queue<DonneesJobResume> {
  return new Queue<DonneesJobResume>(NOM_QUEUE_RESUMES, {
    connection: obtenirRedisBullMQ(),
    defaultJobOptions: { attempts: 2, removeOnComplete: 20, removeOnFail: 20 },
  });
}

export function creerWorkerResumes(): Worker<DonneesJobResume> {
  const worker = new Worker<DonneesJobResume>(
    NOM_QUEUE_RESUMES,
    async (job: Job<DonneesJobResume>) => {
      const bilan = await obtenirServiceNotifications().envoyerResumes(job.data.frequence);
      loggerJobs.info({ frequence: job.data.frequence, ...bilan }, 'Résumés courriel envoyés');
      return bilan;
    },
    { connection: obtenirRedisBullMQ(), concurrency: 1 },
  );
  worker.on('failed', (job, erreur) => {
    loggerJobs.error({ jobId: job?.id, erreur: erreur.message }, 'Job de résumés échoué');
  });
  return worker;
}

export async function planifierResumesRecurrents(queue: Queue<DonneesJobResume>): Promise<void> {
  for (const job of await queue.getRepeatableJobs()) {
    await queue.removeRepeatableByKey(job.key);
  }
  await queue.add('resume-quotidien', { frequence: 'quotidien' }, { repeat: { pattern: '0 7 * * *' } });
  await queue.add('resume-hebdomadaire', { frequence: 'hebdomadaire' }, { repeat: { pattern: '0 7 * * 1' } });
  loggerJobs.info('Résumés courriel planifiés (quotidien 7 h, hebdomadaire lundi 7 h)');
}
