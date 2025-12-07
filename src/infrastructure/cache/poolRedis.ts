/**
 * Veilleur - Pool de connexions Redis
 * Gestion d'un pool de connexions pour les opérations parallèles
 *
 * Permet de gérer plusieurs connexions Redis simultanées pour améliorer
 * les performances lors de nombreuses opérations concurrentes.
 */

import Redis from 'ioredis';
import { obtenirUrlRedis } from '@/config/environnement';
import { loggerCache } from '../logging/logger';

/**
 * Configuration du pool de connexions
 */
interface ConfigPoolRedis {
  // Nombre minimum de connexions dans le pool
  taille_min: number;
  // Nombre maximum de connexions dans le pool
  taille_max: number;
  // Durée d'inactivité avant fermeture d'une connexion excédentaire (ms)
  duree_inactivite: number;
  // Timeout pour acquérir une connexion (ms)
  timeout_acquisition: number;
}

/**
 * État d'une connexion dans le pool
 */
interface ConnexionPool {
  client: Redis;
  id: number;
  enUtilisation: boolean;
  derniereUtilisation: number;
  nbUtilisations: number;
}

/**
 * Configuration par défaut du pool
 */
const CONFIG_DEFAUT: ConfigPoolRedis = {
  taille_min: 2,
  taille_max: 10,
  duree_inactivite: 60000, // 1 minute
  timeout_acquisition: 5000, // 5 secondes
};

/**
 * Pool de connexions Redis
 */
export class PoolRedis {
  private config: ConfigPoolRedis;
  private connexions: ConnexionPool[] = [];
  private fileAttente: Array<{
    resolve: (client: Redis) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private compteurId = 0;
  private intervalNettoyage: NodeJS.Timeout | null = null;
  private fermeture = false;

  constructor(config: Partial<ConfigPoolRedis> = {}) {
    this.config = { ...CONFIG_DEFAUT, ...config };
  }

  /**
   * Initialise le pool avec le nombre minimum de connexions
   */
  async initialiser(): Promise<void> {
    loggerCache.info(
      { tailleMin: this.config.taille_min, tailleMax: this.config.taille_max },
      'Initialisation du pool Redis',
    );

    // Créer les connexions minimum
    const promesses = [];
    for (let i = 0; i < this.config.taille_min; i++) {
      promesses.push(this.creerConnexion());
    }
    await Promise.all(promesses);

    // Démarrer le nettoyage périodique
    this.demarrerNettoyage();

    loggerCache.info(
      { nbConnexions: this.connexions.length },
      'Pool Redis initialisé',
    );
  }

  /**
   * Crée une nouvelle connexion Redis
   */
  private async creerConnexion(): Promise<ConnexionPool> {
    const id = ++this.compteurId;

    const client = new Redis(obtenirUrlRedis(), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times: number): number | null => {
        if (times > 5) {
          loggerCache.error({ connexionId: id }, 'Échec connexion pool Redis après 5 tentatives');
          return null;
        }
        return Math.min(times * 100, 2000);
      },
    });

    // Connecter
    await client.connect();

    const connexion: ConnexionPool = {
      client,
      id,
      enUtilisation: false,
      derniereUtilisation: Date.now(),
      nbUtilisations: 0,
    };

    client.on('error', (err: Error) => {
      loggerCache.error(
        { erreur: err.message, connexionId: id },
        'Erreur connexion pool Redis',
      );
    });

    client.on('close', () => {
      if (!this.fermeture) {
        loggerCache.warn({ connexionId: id }, 'Connexion pool Redis fermée');
        this.retirerConnexion(id);
      }
    });

    this.connexions.push(connexion);
    loggerCache.debug({ connexionId: id }, 'Nouvelle connexion pool Redis créée');

    return connexion;
  }

  /**
   * Retire une connexion du pool
   */
  private retirerConnexion(id: number): void {
    const index = this.connexions.findIndex(c => c.id === id);
    if (index !== -1) {
      this.connexions.splice(index, 1);
    }
  }

  /**
   * Acquiert une connexion du pool
   * Si aucune connexion disponible et pool non plein, en crée une nouvelle
   * Sinon, attend qu'une connexion se libère
   */
  async acquerir(): Promise<Redis> {
    if (this.fermeture) {
      throw new Error('Le pool Redis est en cours de fermeture');
    }

    // Chercher une connexion disponible
    const connexionLibre = this.connexions.find(c => !c.enUtilisation);
    if (connexionLibre) {
      connexionLibre.enUtilisation = true;
      connexionLibre.nbUtilisations++;
      return connexionLibre.client;
    }

    // Si le pool n'est pas plein, créer une nouvelle connexion
    if (this.connexions.length < this.config.taille_max) {
      const nouvelle = await this.creerConnexion();
      nouvelle.enUtilisation = true;
      nouvelle.nbUtilisations++;
      return nouvelle.client;
    }

    // Attendre qu'une connexion se libère
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.fileAttente.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.fileAttente.splice(index, 1);
        }
        reject(new Error('Timeout: impossible d\'acquérir une connexion Redis'));
      }, this.config.timeout_acquisition);

      this.fileAttente.push({ resolve, reject, timeout });
    });
  }

  /**
   * Libère une connexion pour qu'elle puisse être réutilisée
   */
  liberer(client: Redis): void {
    const connexion = this.connexions.find(c => c.client === client);
    if (!connexion) {
      loggerCache.warn('Tentative de libération d\'une connexion inconnue');
      return;
    }

    connexion.enUtilisation = false;
    connexion.derniereUtilisation = Date.now();

    // Si quelqu'un attend une connexion, lui donner celle-ci
    if (this.fileAttente.length > 0) {
      const premier = this.fileAttente.shift()!;
      clearTimeout(premier.timeout);
      connexion.enUtilisation = true;
      connexion.nbUtilisations++;
      premier.resolve(client);
    }
  }

  /**
   * Exécute une opération avec une connexion du pool
   * Gère automatiquement l'acquisition et la libération
   */
  async executer<T>(operation: (client: Redis) => Promise<T>): Promise<T> {
    const client = await this.acquerir();
    try {
      return await operation(client);
    } finally {
      this.liberer(client);
    }
  }

  /**
   * Démarre le nettoyage périodique des connexions inactives
   */
  private demarrerNettoyage(): void {
    this.intervalNettoyage = setInterval(() => {
      this.nettoyerConnexionsInactives();
    }, this.config.duree_inactivite / 2);
  }

  /**
   * Nettoie les connexions inactives au-delà du minimum
   */
  private nettoyerConnexionsInactives(): void {
    const maintenant = Date.now();
    const connexionsAFermer: ConnexionPool[] = [];

    for (const connexion of this.connexions) {
      // Ne pas fermer si en utilisation
      if (connexion.enUtilisation) continue;

      // Ne pas descendre en dessous du minimum
      if (this.connexions.length - connexionsAFermer.length <= this.config.taille_min) {
        break;
      }

      // Fermer si inactive trop longtemps
      if (maintenant - connexion.derniereUtilisation > this.config.duree_inactivite) {
        connexionsAFermer.push(connexion);
      }
    }

    for (const connexion of connexionsAFermer) {
      loggerCache.debug(
        { connexionId: connexion.id, nbUtilisations: connexion.nbUtilisations },
        'Fermeture connexion pool inactive',
      );
      connexion.client.disconnect();
      this.retirerConnexion(connexion.id);
    }

    if (connexionsAFermer.length > 0) {
      loggerCache.info(
        { fermees: connexionsAFermer.length, restantes: this.connexions.length },
        'Nettoyage connexions pool Redis',
      );
    }
  }

  /**
   * Retourne les statistiques du pool
   */
  obtenirStatistiques(): {
    taillePool: number;
    tailleMin: number;
    tailleMax: number;
    connexionsActives: number;
    connexionsDisponibles: number;
    fileAttente: number;
    totalUtilisations: number;
  } {
    const connexionsActives = this.connexions.filter(c => c.enUtilisation).length;
    const totalUtilisations = this.connexions.reduce((acc, c) => acc + c.nbUtilisations, 0);

    return {
      taillePool: this.connexions.length,
      tailleMin: this.config.taille_min,
      tailleMax: this.config.taille_max,
      connexionsActives,
      connexionsDisponibles: this.connexions.length - connexionsActives,
      fileAttente: this.fileAttente.length,
      totalUtilisations,
    };
  }

  /**
   * Vérifie la santé du pool
   */
  async verifierSante(): Promise<boolean> {
    if (this.connexions.length === 0) return false;

    try {
      const connexion = this.connexions.find(c => !c.enUtilisation);
      if (!connexion) return true; // Toutes occupées = pool actif

      const resultat = await connexion.client.ping();
      return resultat === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Ferme toutes les connexions du pool
   */
  async fermer(): Promise<void> {
    this.fermeture = true;

    // Arrêter le nettoyage
    if (this.intervalNettoyage) {
      clearInterval(this.intervalNettoyage);
      this.intervalNettoyage = null;
    }

    // Rejeter tous les waiters
    for (const waiter of this.fileAttente) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Le pool Redis est fermé'));
    }
    this.fileAttente = [];

    // Fermer toutes les connexions
    const promesses = this.connexions.map(async (connexion) => {
      try {
        await connexion.client.quit();
      } catch {
        connexion.client.disconnect();
      }
    });

    await Promise.all(promesses);
    this.connexions = [];

    loggerCache.info('Pool Redis fermé');
  }
}

/**
 * Instance singleton du pool Redis
 */
let poolInstance: PoolRedis | null = null;

/**
 * Initialise et retourne le pool Redis global
 */
export async function initialiserPoolRedis(
  config?: Partial<ConfigPoolRedis>,
): Promise<PoolRedis> {
  if (poolInstance) {
    return poolInstance;
  }

  poolInstance = new PoolRedis(config);
  await poolInstance.initialiser();
  return poolInstance;
}

/**
 * Récupère le pool Redis (doit être initialisé avant)
 */
export function obtenirPoolRedis(): PoolRedis {
  if (!poolInstance) {
    throw new Error('Le pool Redis n\'est pas initialisé. Appelez initialiserPoolRedis() d\'abord.');
  }
  return poolInstance;
}

/**
 * Ferme le pool Redis global
 */
export async function fermerPoolRedis(): Promise<void> {
  if (poolInstance) {
    await poolInstance.fermer();
    poolInstance = null;
  }
}
