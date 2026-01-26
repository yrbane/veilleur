/**
 * Veilleur - Implémentation du service de cache avec Redis
 */

import type { ServiceCache, OptionsCache } from '@/domaine/ports/ServiceCache';
import { obtenirRedis } from './connexionRedis';
import { loggerCache } from '../logging/logger';

const TTL_DEFAUT = 3600; // 1 heure par défaut

/**
 * Implémentation du service de cache utilisant Redis
 */
export class ServiceCacheRedis implements ServiceCache {
  private prefixe: string;

  constructor(prefixe = 'veilleur:') {
    this.prefixe = prefixe;
  }

  private cleComplete(cle: string): string {
    return `${this.prefixe}${cle}`;
  }

  async obtenir<T>(cle: string): Promise<T | null> {
    const redis = obtenirRedis();
    const cleComplete = this.cleComplete(cle);

    try {
      const valeur = await redis.get(cleComplete);
      if (valeur === null) {
        return null;
      }
      return JSON.parse(valeur) as T;
    } catch (erreur) {
      loggerCache.error({ erreur, cle: cleComplete }, 'Erreur lors de la lecture du cache');
      return null;
    }
  }

  async stocker<T>(cle: string, valeur: T, options?: OptionsCache): Promise<void> {
    const redis = obtenirRedis();
    const cleComplete = this.cleComplete(cle);
    const ttl = options?.ttl ?? TTL_DEFAUT;

    try {
      const json = JSON.stringify(valeur);
      if (ttl > 0) {
        await redis.setex(cleComplete, ttl, json);
      } else {
        await redis.set(cleComplete, json);
      }
    } catch (erreur) {
      loggerCache.error({ erreur, cle: cleComplete }, 'Erreur lors de l\'écriture dans le cache');
      throw erreur;
    }
  }

  async supprimer(cle: string): Promise<boolean> {
    const redis = obtenirRedis();
    const cleComplete = this.cleComplete(cle);

    try {
      const resultat = await redis.del(cleComplete);
      return resultat > 0;
    } catch (erreur) {
      loggerCache.error({ erreur, cle: cleComplete }, 'Erreur lors de la suppression du cache');
      return false;
    }
  }

  async supprimerPattern(pattern: string): Promise<number> {
    const redis = obtenirRedis();
    const patternComplet = this.cleComplete(pattern);

    try {
      const cles = await redis.keys(patternComplet);
      if (cles.length === 0) {
        return 0;
      }
      return await redis.del(...cles);
    } catch (erreur) {
      loggerCache.error({ erreur, pattern: patternComplet }, 'Erreur lors de la suppression par pattern');
      return 0;
    }
  }

  async existe(cle: string): Promise<boolean> {
    const redis = obtenirRedis();
    const cleComplete = this.cleComplete(cle);

    try {
      const resultat = await redis.exists(cleComplete);
      return resultat > 0;
    } catch (erreur) {
      loggerCache.error({ erreur, cle: cleComplete }, 'Erreur lors de la vérification d\'existence');
      return false;
    }
  }

  async ttl(cle: string): Promise<number> {
    const redis = obtenirRedis();
    const cleComplete = this.cleComplete(cle);

    try {
      return await redis.ttl(cleComplete);
    } catch (erreur) {
      loggerCache.error({ erreur, cle: cleComplete }, 'Erreur lors de la récupération du TTL');
      return -2;
    }
  }

  async incrementer(cle: string, valeur = 1): Promise<number> {
    const redis = obtenirRedis();
    const cleComplete = this.cleComplete(cle);

    try {
      if (valeur === 1) {
        return await redis.incr(cleComplete);
      }
      return await redis.incrby(cleComplete, valeur);
    } catch (erreur) {
      loggerCache.error({ erreur, cle: cleComplete }, 'Erreur lors de l\'incrémentation');
      throw erreur;
    }
  }

  async decrementer(cle: string, valeur = 1): Promise<number> {
    const redis = obtenirRedis();
    const cleComplete = this.cleComplete(cle);

    try {
      if (valeur === 1) {
        return await redis.decr(cleComplete);
      }
      return await redis.decrby(cleComplete, valeur);
    } catch (erreur) {
      loggerCache.error({ erreur, cle: cleComplete }, 'Erreur lors de la décrémentation');
      throw erreur;
    }
  }

  async obtenirOuStocker<T>(
    cle: string,
    fabrique: () => Promise<T>,
    options?: OptionsCache,
  ): Promise<T> {
    const valeurCache = await this.obtenir<T>(cle);
    if (valeurCache !== null) {
      return valeurCache;
    }

    const valeur = await fabrique();
    await this.stocker(cle, valeur, options);
    return valeur;
  }

  async ping(): Promise<boolean> {
    try {
      const redis = obtenirRedis();
      const resultat = await redis.ping();
      return resultat === 'PONG';
    } catch {
      return false;
    }
  }

  async fermer(): Promise<void> {
    // La fermeture est gérée par connexionRedis.ts
    loggerCache.info('Fermeture du service cache demandée');
  }
}

/**
 * Instance singleton du service de cache
 */
let instanceCache: ServiceCacheRedis | null = null;

/**
 * Récupère l'instance du service de cache
 */
export function obtenirServiceCache(): ServiceCacheRedis {
  if (!instanceCache) {
    instanceCache = new ServiceCacheRedis();
  }
  return instanceCache;
}
