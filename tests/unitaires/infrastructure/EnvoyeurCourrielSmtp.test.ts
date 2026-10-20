/**
 * Veilleur - Options de transport SMTP
 */

import { describe, it, expect } from 'vitest';
import { creerOptionsTransport, EnvoyeurCourrielSmtp } from '@/infrastructure/courriel/EnvoyeurCourrielSmtp';

describe('creerOptionsTransport', () => {
  it('parle en clair à un relais local (certificat auto-signé en STARTTLS)', () => {
    expect(creerOptionsTransport({ hote: '127.0.0.1', port: 25, secure: false, expediteur: 'a@b' })).toEqual({ host: '127.0.0.1', port: 25, secure: false, ignoreTLS: true });
    expect(creerOptionsTransport({ hote: 'localhost', port: 25, secure: false, expediteur: 'a@b' }).ignoreTLS).toBe(true);
  });

  it('garde TLS et l\'authentification pour un serveur distant', () => {
    expect(creerOptionsTransport({ hote: 'smtp.ex.fr', port: 587, secure: false, utilisateur: 'u', motDePasse: 'p', expediteur: 'a@b' })).toEqual({
      host: 'smtp.ex.fr', port: 587, secure: false, ignoreTLS: false, auth: { user: 'u', pass: 'p' },
    });
    expect(creerOptionsTransport({ hote: '127.0.0.1', port: 465, secure: true, expediteur: 'a@b' }).ignoreTLS).toBe(false);
  });

  it('n\'est configuré qu\'avec un hôte', async () => {
    expect(new EnvoyeurCourrielSmtp({ port: 25, secure: false, expediteur: 'a@b' }).estConfigure()).toBe(false);
    await expect(new EnvoyeurCourrielSmtp({ port: 25, secure: false, expediteur: 'a@b' }).envoyer({ a: 'x@y', sujet: 's', html: '', texte: '' })).rejects.toThrow('SMTP non configuré');
  });
});
