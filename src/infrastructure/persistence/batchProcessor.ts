/**
 * Veilleur - Batch Processor pour insertions massives
 * Traitement optimisé des insertions en lot avec chunking et parallélisme
 *
 * Permet d'insérer de grandes quantités de données efficacement
 * tout en gérant les erreurs partielles et les limites de base de données.
 */

import { loggerBdd } from '../logging/logger';

/**
 * Options de configuration du batch processor
 */
export interface OptionsBatchProcessor {
  // Taille d'un chunk (nombre d'éléments par insertion)
  tailleChunk?: number;
  // Nombre de chunks traités en parallèle
  parallelisme?: number;
  // Délai entre chaque chunk (ms) pour éviter la surcharge
  delaiEntreChunks?: number;
  // Continuer en cas d'erreur sur un chunk
  continuerSurErreur?: boolean;
  // Nombre de tentatives en cas d'erreur
  nbTentatives?: number;
  // Délai entre les tentatives (ms)
  delaiEntreTentatives?: number;
  // Callback de progression
  onProgression?: (progression: ProgressionBatch) => void;
}

/**
 * Progression du traitement batch
 */
export interface ProgressionBatch {
  traites: number;
  total: number;
  chunks: {
    termines: number;
    total: number;
  };
  erreurs: number;
  tempsEcoule: number;
  vitesse: number; // éléments par seconde
}

/**
 * Résultat d'un traitement batch
 */
export interface ResultatBatch<T> {
  succes: boolean;
  elementsTraites: number;
  elementsIgnores: number;
  erreurs: Array<{
    index: number;
    element: T;
    erreur: string;
  }>;
  tempsTotal: number;
  chunksTraites: number;
}

/**
 * Configuration par défaut
 */
const CONFIG_DEFAUT: Required<OptionsBatchProcessor> = {
  tailleChunk: 100,
  parallelisme: 3,
  delaiEntreChunks: 10,
  continuerSurErreur: true,
  nbTentatives: 3,
  delaiEntreTentatives: 1000,
  onProgression: () => {},
};

/**
 * Découpe un tableau en chunks
 */
function decouper<T>(tableau: T[], taille: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < tableau.length; i += taille) {
    chunks.push(tableau.slice(i, i + taille));
  }
  return chunks;
}

/**
 * Attend un certain temps
 */
function attendre(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exécute une fonction avec retry
 */
async function avecRetry<T>(
  fn: () => Promise<T>,
  nbTentatives: number,
  delaiEntreTentatives: number,
): Promise<T> {
  let derniereErreur: Error | undefined;

  for (let tentative = 1; tentative <= nbTentatives; tentative++) {
    try {
      return await fn();
    } catch (erreur) {
      derniereErreur = erreur instanceof Error ? erreur : new Error(String(erreur));

      if (tentative < nbTentatives) {
        await attendre(delaiEntreTentatives * tentative);
      }
    }
  }

  throw derniereErreur;
}

/**
 * Classe BatchProcessor pour traitement optimisé des insertions
 */
export class BatchProcessor<T, R = void> {
  private options: Required<OptionsBatchProcessor>;

  constructor(
    private traiterChunk: (elements: T[]) => Promise<R[]>,
    options?: OptionsBatchProcessor,
  ) {
    this.options = { ...CONFIG_DEFAUT, ...options };
  }

  /**
   * Traite un tableau d'éléments en batch
   */
  async traiter(elements: T[]): Promise<ResultatBatch<T>> {
    const debut = Date.now();
    const chunks = decouper(elements, this.options.tailleChunk);

    const resultats: ResultatBatch<T> = {
      succes: true,
      elementsTraites: 0,
      elementsIgnores: 0,
      erreurs: [],
      tempsTotal: 0,
      chunksTraites: 0,
    };

    if (chunks.length === 0) {
      return resultats;
    }

    loggerBdd.info(
      {
        total: elements.length,
        chunks: chunks.length,
        tailleChunk: this.options.tailleChunk,
        parallelisme: this.options.parallelisme,
      },
      'Démarrage traitement batch',
    );

    // Traiter les chunks par lot de parallelisme
    const lotsChunks = decouper(chunks, this.options.parallelisme);

    for (let i = 0; i < lotsChunks.length; i++) {
      const lot = lotsChunks[i]!;

      const promesses = lot.map(async (chunk, indexDansLot) => {
        const indexChunk = i * this.options.parallelisme + indexDansLot;
        const indexDebutElement = indexChunk * this.options.tailleChunk;

        try {
          await avecRetry(
            () => this.traiterChunk(chunk),
            this.options.nbTentatives,
            this.options.delaiEntreTentatives,
          );

          resultats.elementsTraites += chunk.length;
          resultats.chunksTraites++;
        } catch (erreur) {
          const messageErreur = erreur instanceof Error ? erreur.message : String(erreur);

          if (this.options.continuerSurErreur) {
            // Enregistrer l'erreur pour chaque élément du chunk
            chunk.forEach((element, indexElement) => {
              resultats.erreurs.push({
                index: indexDebutElement + indexElement,
                element,
                erreur: messageErreur,
              });
            });
            resultats.elementsIgnores += chunk.length;
            resultats.succes = false;
          } else {
            throw erreur;
          }
        }
      });

      await Promise.all(promesses);

      // Calculer et envoyer la progression
      const maintenant = Date.now();
      const tempsEcoule = maintenant - debut;
      const progression: ProgressionBatch = {
        traites: resultats.elementsTraites,
        total: elements.length,
        chunks: {
          termines: resultats.chunksTraites,
          total: chunks.length,
        },
        erreurs: resultats.erreurs.length,
        tempsEcoule,
        vitesse: tempsEcoule > 0 ? (resultats.elementsTraites / tempsEcoule) * 1000 : 0,
      };

      this.options.onProgression(progression);

      // Attendre entre les lots
      if (i < lotsChunks.length - 1 && this.options.delaiEntreChunks > 0) {
        await attendre(this.options.delaiEntreChunks);
      }
    }

    resultats.tempsTotal = Date.now() - debut;

    loggerBdd.info(
      {
        traites: resultats.elementsTraites,
        ignores: resultats.elementsIgnores,
        erreurs: resultats.erreurs.length,
        tempsMs: resultats.tempsTotal,
        vitesse: Math.round((resultats.elementsTraites / resultats.tempsTotal) * 1000),
      },
      'Traitement batch terminé',
    );

    return resultats;
  }

  /**
   * Traite un flux d'éléments (itérable asynchrone)
   */
  async traiterFlux(
    flux: AsyncIterable<T>,
  ): Promise<ResultatBatch<T>> {
    const debut = Date.now();
    const buffer: T[] = [];

    const resultats: ResultatBatch<T> = {
      succes: true,
      elementsTraites: 0,
      elementsIgnores: 0,
      erreurs: [],
      tempsTotal: 0,
      chunksTraites: 0,
    };

    let indexElement = 0;

    for await (const element of flux) {
      buffer.push(element);

      if (buffer.length >= this.options.tailleChunk) {
        const chunk = buffer.splice(0, this.options.tailleChunk);

        try {
          await avecRetry(
            () => this.traiterChunk(chunk),
            this.options.nbTentatives,
            this.options.delaiEntreTentatives,
          );

          resultats.elementsTraites += chunk.length;
          resultats.chunksTraites++;
        } catch (erreur) {
          const messageErreur = erreur instanceof Error ? erreur.message : String(erreur);

          if (this.options.continuerSurErreur) {
            chunk.forEach((el, idx) => {
              resultats.erreurs.push({
                index: indexElement - chunk.length + idx,
                element: el,
                erreur: messageErreur,
              });
            });
            resultats.elementsIgnores += chunk.length;
            resultats.succes = false;
          } else {
            throw erreur;
          }
        }

        await attendre(this.options.delaiEntreChunks);
      }

      indexElement++;
    }

    // Traiter le reste du buffer
    if (buffer.length > 0) {
      try {
        await avecRetry(
          () => this.traiterChunk(buffer),
          this.options.nbTentatives,
          this.options.delaiEntreTentatives,
        );

        resultats.elementsTraites += buffer.length;
        resultats.chunksTraites++;
      } catch (erreur) {
        const messageErreur = erreur instanceof Error ? erreur.message : String(erreur);

        if (this.options.continuerSurErreur) {
          buffer.forEach((el, idx) => {
            resultats.erreurs.push({
              index: indexElement - buffer.length + idx,
              element: el,
              erreur: messageErreur,
            });
          });
          resultats.elementsIgnores += buffer.length;
          resultats.succes = false;
        } else {
          throw erreur;
        }
      }
    }

    resultats.tempsTotal = Date.now() - debut;

    return resultats;
  }
}

/**
 * Factory pour créer des processeurs batch courants
 */
export const batchFactory = {
  /**
   * Crée un processeur pour insertions en base
   */
  pourInsertions<T>(
    inserer: (elements: T[]) => Promise<void>,
    options?: OptionsBatchProcessor,
  ): BatchProcessor<T, void> {
    return new BatchProcessor<T, void>(
      async (elements: T[]) => {
        await inserer(elements);
        return [];
      },
      options,
    );
  },

  /**
   * Crée un processeur avec transformation
   */
  avecTransformation<T, R>(
    transformer: (element: T) => Promise<R>,
    options?: OptionsBatchProcessor,
  ): BatchProcessor<T, R> {
    return new BatchProcessor<T, R>(
      async (elements: T[]) => {
        return Promise.all(elements.map(transformer));
      },
      options,
    );
  },

  /**
   * Crée un processeur pour mises à jour
   */
  pourMisesAJour<T>(
    mettreAJour: (elements: T[]) => Promise<number>,
    options?: OptionsBatchProcessor,
  ): BatchProcessor<T, number> {
    return new BatchProcessor<T, number>(
      async (elements: T[]) => {
        const count = await mettreAJour(elements);
        return elements.map(() => count / elements.length);
      },
      options,
    );
  },
};

/**
 * Fonction utilitaire pour traiter un batch simple
 */
export async function traiterEnBatch<T>(
  elements: T[],
  traiterChunk: (elements: T[]) => Promise<void>,
  options?: OptionsBatchProcessor,
): Promise<ResultatBatch<T>> {
  const processor = batchFactory.pourInsertions(traiterChunk, options);
  return processor.traiter(elements);
}
