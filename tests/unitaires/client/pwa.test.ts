// @vitest-environment jsdom
/**
 * Veilleur - Invitation à installer l'application
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ecouterInstallation, installationPossible, proposerInstallation, surChangementInstallation, oublierInvitation, estInstallee } from '@/client/utils/pwa';

function simulerInvitation(outcome: 'accepted' | 'dismissed') {
  const e = Object.assign(new Event('beforeinstallprompt'), { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome }) });
  window.dispatchEvent(e);
  return e;
}

describe('installation PWA', () => {
  beforeEach(() => oublierInvitation());

  it('retient l\'invitation du navigateur et prévient les abonnés', () => {
    ecouterInstallation();
    const abonne = vi.fn();
    surChangementInstallation(abonne);
    expect(installationPossible()).toBe(false);
    simulerInvitation('accepted');
    expect(installationPossible()).toBe(true);
    expect(abonne).toHaveBeenCalledTimes(1);
  });

  it('propose l\'installation et oublie l\'invitation une fois acceptée', async () => {
    const e = simulerInvitation('accepted');
    expect(await proposerInstallation()).toBe(true);
    expect(e.prompt).toHaveBeenCalled();
    expect(installationPossible()).toBe(false);
    expect(await proposerInstallation()).toBe(false);
  });

  it('garde l\'invitation si l\'utilisateur refuse', async () => {
    simulerInvitation('dismissed');
    expect(await proposerInstallation()).toBe(false);
    expect(installationPossible()).toBe(true);
  });

  it('détecte le mode autonome', () => {
    expect(estInstallee()).toBe(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    expect(estInstallee()).toBe(true);
    vi.restoreAllMocks();
  });
});
