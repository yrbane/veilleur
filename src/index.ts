/**
 * Veilleur - Point d'entrée principal
 * Agrégateur d'actualités libre
 */

import { demarrerServeur } from './api/serveur';
import { logger } from './infrastructure/logging/logger';
import {
  creerQueueSynchro,
  creerWorkerSynchro,
  planifierSynchroRecurrente,
} from './infrastructure/workers/WorkerSynchro';
import {
  creerQueueImages,
  creerWorkerImages,
} from './infrastructure/workers/WorkerImages';

async function demarrer(): Promise<void> {
  // Démarrer le serveur API
  await demarrerServeur();

  // Initialiser les queues et les workers
  const queueSynchro = creerQueueSynchro();
  const workerSynchro = creerWorkerSynchro();
  const queueImages = creerQueueImages();
  const workerImages = creerWorkerImages();

  // Planifier la synchronisation récurrente
  await planifierSynchroRecurrente(queueSynchro);

  logger.info('Workers démarrés');

  // Gestion propre de l'arrêt
  const arreter = async () => {
    logger.info('Arrêt des workers...');
    await workerImages.close();
    await queueImages.close();
    await workerSynchro.close();
    await queueSynchro.close();
  };

  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
}

demarrer().catch((erreur) => {
  logger.error({ erreur }, 'Erreur fatale au démarrage');
  process.exit(1);
});
