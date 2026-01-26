/**
 * Veilleur - Tests unitaires pour ClientRedis
 * Tests de la connexion et des opérations de base avec Redis via ioredis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Créer des mocks avant l'import
const mockRedisInstance = {
  ping: vi.fn().mockResolvedValue('PONG'),
  quit: vi.fn().mockResolvedValue(undefined),
  info: vi.fn().mockImplementation((section: string) => {
    if (section === 'memory') {
      return Promise.resolve('used_memory_human:1.5M');
    }
    if (section === 'clients') {
      return Promise.resolve('connected_clients:5');
    }
    if (section === 'keyspace') {
      return Promise.resolve('db0:keys=100,expires=50');
    }
    return Promise.resolve('');
  }),
  on: vi.fn(),
};

const MockRedis = vi.fn().mockImplementation(() => mockRedisInstance);

vi.mock('ioredis', () => ({
  default: MockRedis,
}));

// Mock du logger
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerCache: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock de la config
vi.mock('@/config/environnement', () => ({
  obtenirUrlRedis: vi.fn().mockReturnValue('redis://localhost:6379'),
}));

describe('ClientRedis', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset les mocks
    mockRedisInstance.ping.mockResolvedValue('PONG');
    mockRedisInstance.quit.mockResolvedValue(undefined);
    mockRedisInstance.on.mockReturnValue(mockRedisInstance);
    mockRedisInstance.info.mockImplementation((section: string) => {
      if (section === 'memory') {
        return Promise.resolve('used_memory_human:1.5M');
      }
      if (section === 'clients') {
        return Promise.resolve('connected_clients:5');
      }
      if (section === 'keyspace') {
        return Promise.resolve('db0:keys=100,expires=50');
      }
      return Promise.resolve('');
    });
    MockRedis.mockImplementation(() => mockRedisInstance);
    // Reset le module pour réinitialiser l'état
    vi.resetModules();
  });

  describe('creerConnexionRedis', () => {
    it('devrait créer une connexion avec les bonnes options', async () => {
      const { creerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();

      expect(MockRedis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          maxRetriesPerRequest: 3,
        }),
      );
    });

    it('devrait tester la connexion avec ping', async () => {
      const { creerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();

      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('devrait réutiliser la connexion existante', async () => {
      const { creerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      const client1 = await creerConnexionRedis();
      const client2 = await creerConnexionRedis();

      expect(client1).toBe(client2);
      expect(MockRedis).toHaveBeenCalledTimes(1);
    });

    it('devrait enregistrer les handlers d\'événements', async () => {
      const { creerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('devrait lever une erreur si le ping échoue', async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error('Connection refused'));

      const { creerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await expect(creerConnexionRedis()).rejects.toThrow('Connection refused');
    });
  });

  describe('obtenirRedis', () => {
    it('devrait lever une erreur si non initialisé', async () => {
      const { obtenirRedis } = await import('@/infrastructure/cache/connexionRedis');

      expect(() => obtenirRedis()).toThrow("Redis n'est pas initialisé");
    });

    it('devrait retourner le client après initialisation', async () => {
      const { creerConnexionRedis, obtenirRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      const client = obtenirRedis();

      expect(client).toBeDefined();
    });
  });

  describe('obtenirRedisBullMQ', () => {
    it('devrait créer un client avec maxRetriesPerRequest null', async () => {
      const { obtenirRedisBullMQ } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      obtenirRedisBullMQ();

      // Vérifier que le second argument contient les options BullMQ
      const calls = MockRedis.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(
        expect.objectContaining({
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        }),
      );
    });

    it('devrait réutiliser le client BullMQ existant', async () => {
      const { obtenirRedisBullMQ } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      const client1 = obtenirRedisBullMQ();
      const client2 = obtenirRedisBullMQ();

      expect(client1).toBe(client2);
      expect(MockRedis).toHaveBeenCalledTimes(1);
    });
  });

  describe('fermerConnexionRedis', () => {
    it('devrait fermer la connexion proprement', async () => {
      const { creerConnexionRedis, fermerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      await fermerConnexionRedis();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('devrait fermer les deux connexions si BullMQ est créé', async () => {
      const { creerConnexionRedis, obtenirRedisBullMQ, fermerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      obtenirRedisBullMQ();
      await fermerConnexionRedis();

      // quit called for both clients
      expect(mockRedisInstance.quit).toHaveBeenCalledTimes(2);
    });

    it('ne devrait rien faire si non connecté', async () => {
      const { fermerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await expect(fermerConnexionRedis()).resolves.toBeUndefined();
      expect(mockRedisInstance.quit).not.toHaveBeenCalled();
    });
  });

  describe('verifierConnexionRedis', () => {
    it('devrait retourner true si connexion active', async () => {
      const { creerConnexionRedis, verifierConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      const estConnecte = await verifierConnexionRedis();

      expect(estConnecte).toBe(true);
    });

    it('devrait retourner false si non connecté', async () => {
      const { verifierConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      const estConnecte = await verifierConnexionRedis();

      expect(estConnecte).toBe(false);
    });

    it('devrait retourner false si ping ne retourne pas PONG', async () => {
      const { creerConnexionRedis, verifierConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      mockRedisInstance.ping.mockResolvedValueOnce('ERROR');

      const estConnecte = await verifierConnexionRedis();

      expect(estConnecte).toBe(false);
    });

    it('devrait retourner false si ping échoue', async () => {
      const { creerConnexionRedis, verifierConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Connection lost'));

      const estConnecte = await verifierConnexionRedis();

      expect(estConnecte).toBe(false);
    });
  });

  describe('obtenirStatsRedis', () => {
    it('devrait retourner les statistiques correctes', async () => {
      const { creerConnexionRedis, obtenirStatsRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      const stats = await obtenirStatsRedis();

      expect(stats).toEqual({
        connecte: true,
        memoire: '1.5M',
        clients: 5,
        cles: 100,
      });
    });

    it('devrait retourner des valeurs par défaut si non connecté', async () => {
      const { obtenirStatsRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      const stats = await obtenirStatsRedis();

      expect(stats).toEqual({
        connecte: false,
        memoire: '0',
        clients: 0,
        cles: 0,
      });
    });

    it('devrait gérer les erreurs gracieusement', async () => {
      const { creerConnexionRedis, obtenirStatsRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      mockRedisInstance.info.mockRejectedValueOnce(new Error('Info failed'));

      const stats = await obtenirStatsRedis();

      expect(stats).toEqual({
        connecte: false,
        memoire: '0',
        clients: 0,
        cles: 0,
      });
    });

    it('devrait gérer l\'absence de clés (db0)', async () => {
      const { creerConnexionRedis, obtenirStatsRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();
      mockRedisInstance.info.mockImplementation((section: string) => {
        if (section === 'memory') {
          return Promise.resolve('used_memory_human:500K');
        }
        if (section === 'clients') {
          return Promise.resolve('connected_clients:1');
        }
        if (section === 'keyspace') {
          // No db0 entry (empty database)
          return Promise.resolve('');
        }
        return Promise.resolve('');
      });

      const stats = await obtenirStatsRedis();

      expect(stats.cles).toBe(0);
    });
  });

  describe('retryStrategy', () => {
    it('devrait implémenter un backoff exponentiel', async () => {
      const { creerConnexionRedis } = await import(
        '@/infrastructure/cache/connexionRedis'
      );

      await creerConnexionRedis();

      // Get the retryStrategy from the Redis constructor call
      const callArgs = MockRedis.mock.calls[0];
      const options = callArgs[1] as { retryStrategy: (times: number) => number | null };
      const retryStrategy = options.retryStrategy;

      // Vérifier que retryStrategy existe et est une fonction
      expect(typeof retryStrategy).toBe('function');

      // Test increasing delays
      const delay1 = retryStrategy(1);
      const delay2 = retryStrategy(2);
      const delay3 = retryStrategy(3);

      expect(delay1).toBe(100);
      expect(delay2).toBe(200);
      expect(delay3).toBe(300);

      // Test max delay cap (at times=10, should be capped to 1000 = min(10*100, 3000))
      const delay10 = retryStrategy(10);
      expect(delay10).toBe(1000);

      // Test max retries - should return null after 10 attempts
      const delayNull = retryStrategy(11);
      expect(delayNull).toBeNull();
    });
  });
});
