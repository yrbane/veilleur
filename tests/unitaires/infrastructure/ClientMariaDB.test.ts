/**
 * Veilleur - Tests unitaires pour ClientMariaDB
 * Tests de la connexion et des opérations de base avec MariaDB via Drizzle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Créer des mocks avant l'import
const mockConnection = {
  ping: vi.fn().mockResolvedValue(undefined),
  release: vi.fn(),
  beginTransaction: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  rollback: vi.fn().mockResolvedValue(undefined),
};

const mockPool = {
  getConnection: vi.fn().mockResolvedValue(mockConnection),
  end: vi.fn().mockResolvedValue(undefined),
};

const mockCreatePool = vi.fn().mockReturnValue(mockPool);

// Mock du module mysql2/promise
vi.mock('mysql2/promise', () => ({
  default: {
    createPool: mockCreatePool,
  },
}));

// Mock du logger
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerBdd: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock de la config
vi.mock('@/config/environnement', () => ({
  env: {
    DB_HOST: 'localhost',
    DB_PORT: 3306,
    DB_USER: 'test',
    DB_PASSWORD: 'test',
    DB_NAME: 'veilleur_test',
  },
}));

describe('ClientMariaDB', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset les mocks
    mockConnection.ping.mockResolvedValue(undefined);
    mockPool.getConnection.mockResolvedValue(mockConnection);
    mockCreatePool.mockReturnValue(mockPool);
    // Reset le module pour réinitialiser l'état
    vi.resetModules();
  });

  describe('creerConnexion', () => {
    it('devrait créer une connexion avec les bonnes options', async () => {
      const { creerConnexion } = await import('@/infrastructure/persistence/connexion');

      await creerConnexion();

      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 3306,
          user: 'test',
          password: 'test',
          database: 'veilleur_test',
          waitForConnections: true,
          connectionLimit: 10,
        }),
      );
    });

    it('devrait tester la connexion avec ping', async () => {
      const { creerConnexion } = await import('@/infrastructure/persistence/connexion');

      await creerConnexion();

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('devrait réutiliser la connexion existante', async () => {
      const { creerConnexion } = await import('@/infrastructure/persistence/connexion');

      const db1 = await creerConnexion();
      const db2 = await creerConnexion();

      expect(db1).toBe(db2);
      expect(mockCreatePool).toHaveBeenCalledTimes(1);
    });

    it('devrait lever une erreur si la connexion échoue', async () => {
      mockConnection.ping.mockRejectedValue(new Error('Connection refused'));

      const { creerConnexion } = await import('@/infrastructure/persistence/connexion');

      await expect(creerConnexion()).rejects.toThrow('Connection refused');
    });
  });

  describe('obtenirBdd', () => {
    it('devrait lever une erreur si non initialisé', async () => {
      const { obtenirBdd } = await import('@/infrastructure/persistence/connexion');

      expect(() => obtenirBdd()).toThrow("La base de données n'est pas initialisée");
    });

    it('devrait retourner la connexion après initialisation', async () => {
      const { creerConnexion, obtenirBdd } = await import(
        '@/infrastructure/persistence/connexion'
      );

      await creerConnexion();
      const db = obtenirBdd();

      expect(db).toBeDefined();
    });
  });

  describe('fermerConnexion', () => {
    it('devrait fermer la connexion proprement', async () => {
      const { creerConnexion, fermerConnexion } = await import(
        '@/infrastructure/persistence/connexion'
      );

      await creerConnexion();
      await fermerConnexion();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('ne devrait rien faire si non connecté', async () => {
      const { fermerConnexion } = await import('@/infrastructure/persistence/connexion');

      await expect(fermerConnexion()).resolves.toBeUndefined();
    });
  });

  describe('verifierConnexion', () => {
    it('devrait retourner true si connexion active', async () => {
      const { creerConnexion, verifierConnexion } = await import(
        '@/infrastructure/persistence/connexion'
      );

      await creerConnexion();
      const estConnecte = await verifierConnexion();

      expect(estConnecte).toBe(true);
    });

    it('devrait retourner false si non connecté', async () => {
      const { verifierConnexion } = await import('@/infrastructure/persistence/connexion');

      const estConnecte = await verifierConnexion();

      expect(estConnecte).toBe(false);
    });

    it('devrait retourner false si ping échoue', async () => {
      const { creerConnexion, verifierConnexion } = await import(
        '@/infrastructure/persistence/connexion'
      );

      await creerConnexion();

      // Modifier le mock pour le prochain appel
      mockConnection.ping.mockRejectedValueOnce(new Error('Connection lost'));

      const estConnecte = await verifierConnexion();

      expect(estConnecte).toBe(false);
    });
  });

  describe('dansTransaction', () => {
    it('devrait exécuter une fonction dans une transaction', async () => {
      const { creerConnexion, dansTransaction } = await import(
        '@/infrastructure/persistence/connexion'
      );

      await creerConnexion();

      const resultat = await dansTransaction(async () => {
        return 'resultat';
      });

      expect(resultat).toBe('resultat');
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('devrait faire rollback en cas d\'erreur', async () => {
      const { creerConnexion, dansTransaction } = await import(
        '@/infrastructure/persistence/connexion'
      );

      await creerConnexion();

      await expect(
        dansTransaction(async () => {
          throw new Error('Erreur dans transaction');
        }),
      ).rejects.toThrow('Erreur dans transaction');

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('devrait lever une erreur si non connecté', async () => {
      const { dansTransaction } = await import('@/infrastructure/persistence/connexion');

      await expect(
        dansTransaction(async () => 'test'),
      ).rejects.toThrow('Connexion non initialisée');
    });
  });
});
