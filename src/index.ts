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

async function demarrer(): Promise<void> {
  // Démarrer le serveur API
  await demarrerServeur();

  // Initialiser la queue et le worker de synchronisation
  const queue = creerQueueSynchro();
  const worker = creerWorkerSynchro();

  // Planifier la synchronisation récurrente
  await planifierSynchroRecurrente(queue);

  logger.info('Worker de synchronisation démarré');

  // Gestion propre de l'arrêt
  const arreter = async () => {
    logger.info('Arrêt du worker...');
    await worker.close();
    await queue.close();
  };

  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
}

demarrer().catch(erreur => {
  logger.fatal({ erreur }, "Impossible de démarrer l'application");
  process.exit(1);
});
