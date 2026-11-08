// @vitest-environment jsdom
/**
 * Veilleur - Pages d'authentification : mot de passe oublié et autocomplétion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const naviguerVers = vi.fn();
vi.mock('@/client/main', () => ({ naviguerVers: (...args: unknown[]) => naviguerVers(...args) }));
vi.mock('@/client/utils/toast', () => ({ toast: { succes: vi.fn(), erreur: vi.fn() } }));

vi.mock('@/client/services/api', () => ({
  auth: { motDePasseOublie: vi.fn(), reinitialiserMotDePasse: vi.fn(), connexion: vi.fn(), inscription: vi.fn() },
  ErreurAPI: class ErreurAPI extends Error { constructor(message: string, public code: string, public status: number) { super(message); } },
}));

import { auth } from '@/client/services/api';
const api = auth as unknown as Record<'motDePasseOublie' | 'reinitialiserMotDePasse' | 'connexion' | 'inscription', ReturnType<typeof vi.fn>>;

import {
  afficherPageConnexion,
  afficherPageInscription,
  afficherPageMotDePasseOublie,
  afficherPageReinitialisation,
  extraireTokenReinitialisation,
} from '@/client/pages/PageAuth';

function conteneur(): HTMLElement {
  document.body.innerHTML = '<div id="app-contenu"></div>';
  return document.getElementById('app-contenu')!;
}

async function soumettre(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  await new Promise(r => setTimeout(r, 0));
}

beforeEach(() => vi.clearAllMocks());

describe('connexion et inscription', () => {
  it('laissent le gestionnaire de mots de passe reconnaître identifiant et mot de passe', () => {
    afficherPageConnexion(conteneur());
    expect(document.querySelector<HTMLInputElement>('#email')!.autocomplete).toBe('username');
    expect(document.querySelector<HTMLInputElement>('#motDePasse')!.autocomplete).toBe('current-password');
    afficherPageInscription(conteneur());
    expect(document.querySelector<HTMLInputElement>('#email')!.autocomplete).toBe('username');
    expect(document.querySelector<HTMLInputElement>('#motDePasse')!.autocomplete).toBe('new-password');
  });

  it('propose un lien « Mot de passe oublié ? » sur la connexion', () => {
    afficherPageConnexion(conteneur());
    const lien = document.querySelector<HTMLAnchorElement>('a[href="/mot-de-passe-oublie"]');
    expect(lien?.textContent).toMatch(/oublié/i);
  });
});

describe('page mot de passe oublié', () => {
  it('envoie la demande puis affiche la confirmation, sans révéler si le compte existe', async () => {
    api.motDePasseOublie.mockResolvedValue(undefined);
    afficherPageMotDePasseOublie(conteneur());
    const form = document.querySelector<HTMLFormElement>('#form-oubli')!;
    (form.elements.namedItem('email') as HTMLInputElement).value = 'marie@example.org';
    await soumettre(form);
    expect(api.motDePasseOublie).toHaveBeenCalledWith('marie@example.org');
    expect(document.querySelector('#form-oubli')).toBeNull();
    expect(document.body.textContent).toMatch(/Si un compte existe/);
    expect(document.body.textContent).toMatch(/indésirables/);
  });
});

describe('page de réinitialisation', () => {
  it('lit le jeton dans la requête', () => {
    expect(extraireTokenReinitialisation('?token=abc_-123')).toBe('abc_-123');
    expect(extraireTokenReinitialisation('')).toBeNull();
    expect(extraireTokenReinitialisation('?token=')).toBeNull();
  });

  it('sans jeton, renvoie vers une nouvelle demande', () => {
    afficherPageReinitialisation(conteneur(), '');
    expect(document.querySelector('#form-reinitialisation')).toBeNull();
    expect(document.querySelector('a[href="/mot-de-passe-oublie"]')).not.toBeNull();
  });

  it('refuse des mots de passe différents sans appeler le serveur', async () => {
    afficherPageReinitialisation(conteneur(), '?token=***SECRET-RETIRE***');
    const form = document.querySelector<HTMLFormElement>('#form-reinitialisation')!;
    expect(document.querySelector<HTMLInputElement>('#motDePasse')!.autocomplete).toBe('new-password');
    (form.elements.namedItem('motDePasse') as HTMLInputElement).value = 'Nouveau!Secret2026';
    (form.elements.namedItem('confirmation') as HTMLInputElement).value = 'Autre!Secret2026';
    await soumettre(form);
    expect(api.reinitialiserMotDePasse).not.toHaveBeenCalled();
    expect(document.querySelector('#erreur-reinitialisation')!.textContent).toMatch(/correspondent pas/);
  });

  it('envoie le jeton et le nouveau mot de passe puis entre dans l\'application', async () => {
    api.reinitialiserMotDePasse.mockResolvedValue({ accessToken: 'a' });
    afficherPageReinitialisation(conteneur(), '?token=***SECRET-RETIRE***');
    const form = document.querySelector<HTMLFormElement>('#form-reinitialisation')!;
    (form.elements.namedItem('motDePasse') as HTMLInputElement).value = 'Nouveau!Secret2026';
    (form.elements.namedItem('confirmation') as HTMLInputElement).value = 'Nouveau!Secret2026';
    await soumettre(form);
    expect(api.reinitialiserMotDePasse).toHaveBeenCalledWith('***SECRET-RETIRE***', 'Nouveau!Secret2026');
    expect(naviguerVers).toHaveBeenCalledWith('/');
  });

  it('affiche l\'erreur du serveur (lien périmé) avec un lien pour recommencer', async () => {
    const { ErreurAPI } = await import('@/client/services/api');
    api.reinitialiserMotDePasse.mockRejectedValue(new ErreurAPI('Ce lien est invalide ou a expiré. Refaites une demande.', 'LIEN_INVALIDE', 400));
    afficherPageReinitialisation(conteneur(), '?token=***SECRET-RETIRE***');
    const form = document.querySelector<HTMLFormElement>('#form-reinitialisation')!;
    (form.elements.namedItem('motDePasse') as HTMLInputElement).value = 'Nouveau!Secret2026';
    (form.elements.namedItem('confirmation') as HTMLInputElement).value = 'Nouveau!Secret2026';
    await soumettre(form);
    expect(document.querySelector('#erreur-reinitialisation')!.textContent).toMatch(/expiré/);
    expect(naviguerVers).not.toHaveBeenCalled();
  });
});
