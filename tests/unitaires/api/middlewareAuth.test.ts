/**
 * Veilleur - Tests unitaires pour le middleware d'authentification
 * Tests de vérification des tokens JWT et des routes protégées
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('Middleware Authentification', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let statusSpy: ReturnType<typeof vi.fn>;
  let sendSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    sendSpy = vi.fn().mockReturnThis();
    statusSpy = vi.fn().mockReturnValue({ send: sendSpy });

    mockRequest = {
      headers: {},
    };

    mockReply = {
      status: statusSpy,
      send: sendSpy,
    };
  });

  describe('verifierAuthentification', () => {
    it('devrait rejeter si pas de header Authorization', async () => {
      // Import frais pour chaque test
      vi.resetModules();

      // Mock minimal
      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: vi.fn(),
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      const { verifierAuthentification } = await import(
        '@/api/middlewares/authentification'
      );

      await verifierAuthentification(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(sendSpy).toHaveBeenCalledWith({
        erreur: 'Non authentifié',
        message: "Token d'accès requis",
      });
    });

    it('devrait rejeter si header Authorization mal formaté', async () => {
      vi.resetModules();

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: vi.fn(),
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'InvalidFormat' };

      const { verifierAuthentification } = await import(
        '@/api/middlewares/authentification'
      );

      await verifierAuthentification(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
    });

    it("devrait rejeter si type n'est pas Bearer", async () => {
      vi.resetModules();

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: vi.fn(),
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'Basic token123' };

      const { verifierAuthentification } = await import(
        '@/api/middlewares/authentification'
      );

      await verifierAuthentification(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
    });

    it('devrait rejeter si token vide', async () => {
      vi.resetModules();

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: vi.fn(),
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'Bearer ' };

      const { verifierAuthentification } = await import(
        '@/api/middlewares/authentification'
      );

      await verifierAuthentification(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
    });

    it('devrait accepter et décoder un token valide', async () => {
      vi.resetModules();

      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockVerifierAccessToken = vi.fn().mockResolvedValue(mockPayload);

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: mockVerifierAccessToken,
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'Bearer valid-token' };

      const { verifierAuthentification } = await import(
        '@/api/middlewares/authentification'
      );

      await verifierAuthentification(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockVerifierAccessToken).toHaveBeenCalledWith('valid-token');
      expect((mockRequest as FastifyRequest).utilisateur).toEqual(mockPayload);
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('devrait rejeter si token expiré (ErreurAuthentification)', async () => {
      vi.resetModules();

      class MockErreurAuthentification extends Error {
        code: string;
        constructor(msg: string, code: string) {
          super(msg);
          this.name = 'ErreurAuthentification';
          this.code = code;
        }
      }

      const mockVerifierAccessToken = vi.fn().mockRejectedValue(
        new MockErreurAuthentification('Token expiré', 'TOKEN_EXPIRE'),
      );

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: mockVerifierAccessToken,
        })),
        ErreurAuthentification: MockErreurAuthentification,
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'Bearer expired-token' };

      const { verifierAuthentification } = await import(
        '@/api/middlewares/authentification'
      );

      await verifierAuthentification(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(sendSpy).toHaveBeenCalledWith({
        erreur: 'TOKEN_EXPIRE',
        message: 'Token expiré',
      });
    });

    it('devrait rejeter si token invalide (erreur générique)', async () => {
      vi.resetModules();

      const mockVerifierAccessToken = vi.fn().mockRejectedValue(
        new Error('Invalid signature'),
      );

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: mockVerifierAccessToken,
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      const { verifierAuthentification } = await import(
        '@/api/middlewares/authentification'
      );

      await verifierAuthentification(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(sendSpy).toHaveBeenCalledWith({
        erreur: 'TOKEN_INVALIDE',
        message: 'Token invalide',
      });
    });
  });

  describe('chargerUtilisateurOptional', () => {
    it('devrait ne rien faire si pas de token', async () => {
      vi.resetModules();

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: vi.fn(),
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = {};

      const { chargerUtilisateurOptional } = await import(
        '@/api/middlewares/authentification'
      );

      await chargerUtilisateurOptional(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect((mockRequest as FastifyRequest).utilisateur).toBeUndefined();
    });

    it("devrait charger l'utilisateur si token valide", async () => {
      vi.resetModules();

      const mockPayload = {
        sub: 'user-456',
        email: 'optional@example.com',
      };

      const mockVerifierAccessToken = vi.fn().mockResolvedValue(mockPayload);

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: mockVerifierAccessToken,
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'Bearer valid-token' };

      const { chargerUtilisateurOptional } = await import(
        '@/api/middlewares/authentification'
      );

      await chargerUtilisateurOptional(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect((mockRequest as FastifyRequest).utilisateur).toEqual(mockPayload);
    });

    it('devrait ignorer les erreurs silencieusement', async () => {
      vi.resetModules();

      const mockVerifierAccessToken = vi.fn().mockRejectedValue(
        new Error('Invalid token'),
      );

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: mockVerifierAccessToken,
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      const { chargerUtilisateurOptional } = await import(
        '@/api/middlewares/authentification'
      );

      // Ne devrait pas lever d'erreur
      await expect(
        chargerUtilisateurOptional(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply,
        ),
      ).resolves.toBeUndefined();

      // Utilisateur reste undefined
      expect((mockRequest as FastifyRequest).utilisateur).toBeUndefined();
      // reply.status ne devrait pas être appelé
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('obtenirServiceAuth', () => {
    it('devrait créer et retourner une instance singleton', async () => {
      vi.resetModules();

      vi.doMock('@/domaine/services/ServiceAuthentification', () => ({
        ServiceAuthentification: vi.fn().mockImplementation(() => ({
          verifierAccessToken: vi.fn(),
        })),
        ErreurAuthentification: class extends Error {
          code: string;
          constructor(msg: string, code: string) {
            super(msg);
            this.code = code;
          }
        },
      }));

      vi.doMock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
        DepotUtilisateursMariaDB: vi.fn(),
        DepotRefreshTokensMariaDB: vi.fn(),
      }));

      const { obtenirServiceAuth } = await import(
        '@/api/middlewares/authentification'
      );

      const service1 = obtenirServiceAuth();
      const service2 = obtenirServiceAuth();

      expect(service1).toBe(service2);
    });
  });
});
