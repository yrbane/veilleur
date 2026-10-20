/**
 * Veilleur - Installation de l'application (PWA)
 */

interface EvenementInstallation extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let invitation: EvenementInstallation | null = null;
const abonnes = new Set<() => void>();

/** À appeler une fois au démarrage : retient l'invitation du navigateur pour plus tard */
export function ecouterInstallation(cible: Window = window): void {
  cible.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invitation = e as EvenementInstallation;
    abonnes.forEach((f) => f());
  });
  cible.addEventListener('appinstalled', () => {
    invitation = null;
    abonnes.forEach((f) => f());
  });
}

export function surChangementInstallation(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function estInstallee(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches === true || (navigator as { standalone?: boolean }).standalone === true;
}

export function installationPossible(): boolean {
  return invitation !== null;
}

/** Ouvre l'invitation ; renvoie true si l'utilisateur accepte */
export async function proposerInstallation(): Promise<boolean> {
  if (!invitation) return false;
  await invitation.prompt();
  const { outcome } = await invitation.userChoice;
  if (outcome === 'accepted') invitation = null;
  return outcome === 'accepted';
}

/** Réinitialisation pour les tests */
export function oublierInvitation(): void {
  invitation = null;
}
