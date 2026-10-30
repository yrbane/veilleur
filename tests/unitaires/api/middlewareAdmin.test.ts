/**
 * Veilleur - Tests du garde des routes d'administration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

vi.mock('@/infrastructure/persistence/DepotUtilisateursMariaDB', () => ({
  DepotUtilisateursMariaDB: vi.fn(),
  DepotRefreshTokensMariaDB: vi.fn(),
}));

const verifierAccessToken = vi.fn();
vi.mock('@/domaine/services/ServiceAuthentification', () => ({
  // Classe réelle : la configuration vitest remet les vi.fn à zéro entre les tests
  ServiceAuthentification: class {
    verifierAccessToken(token: string): Promise<unknown> {
      return verifierAccessToken(token);
    }
  },
  ErreurAuthentification: class extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  },
}));

function fausseReponse(): FastifyReply & { envoye: unknown; statut: number } {
  const reply = { sent: false, statut: 200, envoye: undefined as unknown } as unknown as FastifyReply & { envoye: unknown; statut: number };
  (reply as unknown as { status: (code: number) => unknown }).status = (code: number) => {
    reply.statut = code;
    return { send: (corps: unknown) => { reply.envoye = corps; (reply as unknown as { sent: boolean }).sent = true; return reply; } };
  };
  return reply;
}

describe('creerVerifierAdmin', () => {
  beforeEach(() => {
    verifierAccessToken.mockReset();
  });

  it('refuse sans jeton (401) sans consulter le rôle', async () => {
    const { creerVerifierAdmin } = await import('@/api/middlewares/authentification');
    const chargerRole = vi.fn();
    const garde = creerVerifierAdmin(chargerRole);
    const reply = fausseReponse();
    await garde({ headers: {} } as FastifyRequest, reply);
    expect(reply.statut).toBe(401);
    expect(chargerRole).not.toHaveBeenCalled();
  });

  it('refuse un membre authentifié (403)', async () => {
    const { creerVerifierAdmin } = await import('@/api/middlewares/authentification');
    verifierAccessToken.mockResolvedValue({ sub: 'bob', email: 'bob@exemple.org' });
    const garde = creerVerifierAdmin(async () => 'membre');
    const reply = fausseReponse();
    const request = { headers: { authorization: 'Bearer jeton' } } as unknown as FastifyRequest;
    await garde(request, reply);
    expect(reply.statut).toBe(403);
    expect(reply.envoye).toMatchObject({ erreur: 'ACCES_REFUSE' });
  });

  it('laisse passer un administrateur', async () => {
    const { creerVerifierAdmin } = await import('@/api/middlewares/authentification');
    verifierAccessToken.mockResolvedValue({ sub: 'alice', email: 'alice@exemple.org' });
    const chargerRole = vi.fn().mockResolvedValue('admin');
    const garde = creerVerifierAdmin(chargerRole);
    const reply = fausseReponse();
    const request = { headers: { authorization: 'Bearer jeton' } } as unknown as FastifyRequest;
    await garde(request, reply);
    expect(reply.statut).toBe(200);
    expect(chargerRole).toHaveBeenCalledWith('alice');
    expect(request.utilisateur?.sub).toBe('alice');
  });
});
