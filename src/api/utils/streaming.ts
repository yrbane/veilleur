/**
 * Veilleur - Utilitaires de streaming pour réponses volumineuses
 * Permet d'envoyer des données progressivement au client
 *
 * Utilisation:
 * - Listes d'articles volumineuses
 * - Exports de données
 * - Synchronisations longues
 */

import { logger } from '@/infrastructure/logging/logger';

/**
 * Interface simplifiée de Response Express pour le streaming
 */
interface StreamingResponse {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): boolean;
  end(): void;
  writableEnded: boolean;
}

const loggerStreaming = logger.child({ module: 'streaming' });

/**
 * Options de streaming
 */
interface OptionsStreaming {
  // Intervalle entre les chunks (ms)
  intervalleChunk?: number;
  // Taille maximale d'un chunk
  tailleChunk?: number;
  // Callback de progression
  onProgression?: (traites: number, total: number) => void;
  // Timeout global (ms)
  timeout?: number;
}

/**
 * Configuration par défaut
 */
const OPTIONS_DEFAUT: Required<OptionsStreaming> = {
  intervalleChunk: 10,
  tailleChunk: 50,
  onProgression: () => {},
  timeout: 30000,
};

/**
 * Streamer NDJSON (Newline Delimited JSON)
 * Chaque ligne est un objet JSON indépendant
 */
export class StreamerNDJSON<T> {
  private estFerme = false;

  constructor(
    private res: StreamingResponse,
    _options?: OptionsStreaming,
  ) {
    this.initialiser();
  }

  /**
   * Initialise les headers de streaming
   */
  private initialiser(): void {
    this.res.setHeader('Content-Type', 'application/x-ndjson');
    this.res.setHeader('Transfer-Encoding', 'chunked');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering nginx
  }

  /**
   * Envoie un élément
   */
  envoyer(element: T): void {
    if (this.estFerme) return;

    try {
      this.res.write(JSON.stringify(element) + '\n');
    } catch (erreur) {
      loggerStreaming.error({ erreur }, 'Erreur écriture streaming');
      this.fermer();
    }
  }

  /**
   * Envoie un message de métadonnées
   */
  envoyerMeta(meta: Record<string, unknown>): void {
    if (this.estFerme) return;

    try {
      this.res.write(JSON.stringify({ _meta: meta }) + '\n');
    } catch (erreur) {
      loggerStreaming.error({ erreur }, 'Erreur écriture meta streaming');
    }
  }

  /**
   * Envoie une erreur
   */
  envoyerErreur(message: string, code?: string): void {
    if (this.estFerme) return;

    try {
      this.res.write(JSON.stringify({ _error: { message, code } }) + '\n');
    } catch (erreur) {
      loggerStreaming.error({ erreur }, 'Erreur écriture erreur streaming');
    }
  }

  /**
   * Ferme le stream
   */
  fermer(): void {
    if (this.estFerme) return;

    this.estFerme = true;
    try {
      this.res.end();
    } catch {
      // Ignorer erreurs de fermeture
    }
  }

  /**
   * Vérifie si le stream est encore ouvert
   */
  estOuvert(): boolean {
    return !this.estFerme && !this.res.writableEnded;
  }
}

/**
 * Streamer Server-Sent Events (SSE)
 * Pour les mises à jour temps réel
 */
export class StreamerSSE {
  private estFerme = false;
  private compteurId = 0;

  constructor(private res: StreamingResponse) {
    this.initialiser();
  }

  /**
   * Initialise les headers SSE
   */
  private initialiser(): void {
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no');
    this.res.flushHeaders();
  }

  /**
   * Envoie un événement
   */
  envoyer(event: string, data: unknown, id?: string): void {
    if (this.estFerme || this.res.writableEnded) return;

    const eventId = id ?? String(++this.compteurId);

    try {
      this.res.write(`id: ${eventId}\n`);
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (erreur) {
      loggerStreaming.error({ erreur }, 'Erreur écriture SSE');
      this.fermer();
    }
  }

  /**
   * Envoie un commentaire (keep-alive)
   */
  envoyerCommentaire(message: string): void {
    if (this.estFerme || this.res.writableEnded) return;

    try {
      this.res.write(`: ${message}\n\n`);
    } catch {
      this.fermer();
    }
  }

  /**
   * Configure le retry côté client
   */
  configurerRetry(ms: number): void {
    if (this.estFerme) return;
    this.res.write(`retry: ${ms}\n\n`);
  }

  /**
   * Ferme le stream
   */
  fermer(): void {
    if (this.estFerme) return;

    this.estFerme = true;
    try {
      this.res.end();
    } catch {
      // Ignorer
    }
  }

  /**
   * Vérifie si le stream est encore ouvert
   */
  estOuvert(): boolean {
    return !this.estFerme && !this.res.writableEnded;
  }
}

/**
 * Streamer de tableau paginé (JSON array progressif)
 */
export class StreamerTableau<T> {
  private estFerme = false;
  private compteur = 0;

  constructor(
    private res: StreamingResponse,
    _options?: OptionsStreaming,
  ) {
    this.initialiser();
  }

  /**
   * Initialise avec l'ouverture du tableau JSON
   */
  private initialiser(): void {
    this.res.setHeader('Content-Type', 'application/json');
    this.res.setHeader('Transfer-Encoding', 'chunked');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.write('{"donnees":[');
  }

  /**
   * Envoie un élément du tableau
   */
  envoyer(element: T): void {
    if (this.estFerme) return;

    try {
      const prefix = this.compteur > 0 ? ',' : '';
      this.res.write(prefix + JSON.stringify(element));
      this.compteur++;
    } catch (erreur) {
      loggerStreaming.error({ erreur }, 'Erreur écriture tableau streaming');
    }
  }

  /**
   * Ferme le tableau avec métadonnées de pagination
   */
  fermer(pagination?: {
    page: number;
    limite: number;
    total: number;
    totalPages: number;
  }): void {
    if (this.estFerme) return;

    this.estFerme = true;
    try {
      if (pagination) {
        this.res.write(`],"pagination":${JSON.stringify(pagination)}}`);
      } else {
        this.res.write(']}');
      }
      this.res.end();
    } catch {
      // Ignorer
    }
  }

  /**
   * Obtient le nombre d'éléments envoyés
   */
  nombreEnvoyes(): number {
    return this.compteur;
  }
}

/**
 * Fonction utilitaire pour streamer un itérable
 */
export async function streamerIterable<T>(
  res: StreamingResponse,
  iterable: AsyncIterable<T> | Iterable<T>,
  options?: OptionsStreaming & {
    total?: number;
    format?: 'ndjson' | 'sse' | 'array';
  },
): Promise<void> {
  const format = options?.format ?? 'ndjson';
  const opts = { ...OPTIONS_DEFAUT, ...options };

  if (format === 'ndjson') {
    const streamer = new StreamerNDJSON<T>(res, opts);

    if (options?.total) {
      streamer.envoyerMeta({ total: options.total });
    }

    let traites = 0;
    for await (const element of iterable) {
      if (!streamer.estOuvert()) break;

      streamer.envoyer(element);
      traites++;

      if (options?.total) {
        opts.onProgression(traites, options.total);
      }

      // Petit délai pour éviter de bloquer l'event loop
      if (traites % opts.tailleChunk === 0) {
        await new Promise(resolve => setTimeout(resolve, opts.intervalleChunk));
      }
    }

    streamer.envoyerMeta({ complete: true, total: traites });
    streamer.fermer();
  } else if (format === 'array') {
    const streamer = new StreamerTableau<T>(res, opts);

    for await (const element of iterable) {
      streamer.envoyer(element);

      if (streamer.nombreEnvoyes() % opts.tailleChunk === 0) {
        await new Promise(resolve => setTimeout(resolve, opts.intervalleChunk));
      }
    }

    streamer.fermer({
      page: 1,
      limite: streamer.nombreEnvoyes(),
      total: streamer.nombreEnvoyes(),
      totalPages: 1,
    });
  }
}

/**
 * Fonction utilitaire pour streamer un générateur de base de données
 */
export async function* creerGenerateurPagine<T>(
  fetcher: (offset: number, limite: number) => Promise<T[]>,
  limite: number = 100,
): AsyncGenerator<T, void, unknown> {
  let offset = 0;
  let elements: T[];

  do {
    elements = await fetcher(offset, limite);
    for (const element of elements) {
      yield element;
    }
    offset += limite;
  } while (elements.length === limite);
}
