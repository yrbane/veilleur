/**
 * Veilleur - Page Parametres
 * Gestion du profil et des préférences utilisateur
 */

import { creerElement, $, vider } from '../utils/dom';
import { auth, estAuthentifie } from '../services/api';
import { toast } from '../utils/toast';
import type { Utilisateur, Preferences, Statut2FA } from '../services/api';

let utilisateurCourant: Utilisateur | null = null;
let statut2FA: Statut2FA | null = null;

/**
 * Affiche la page des paramètres
 */
export async function afficherPageParametres(container: Element): Promise<void> {
  vider(container);

  if (!estAuthentifie()) {
    container.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">🔒</div>
        <div class="message-vide-titre">Connexion requise</div>
        <p>Connectez-vous pour accéder aux paramètres.</p>
        <a href="/connexion" class="btn btn-primaire" data-nav>Se connecter</a>
      </div>
    `;
    return;
  }

  const page = creerElement('div', {
    classes: ['page-parametres'],
  });

  // En-tête
  const entete = creerElement('div', {
    classes: ['page-parametres-entete'],
  });

  const titre = creerElement('h1', {
    classes: ['page-parametres-titre'],
    texte: 'Paramètres',
  });

  const description = creerElement('p', {
    classes: ['page-parametres-description'],
    texte: 'Gérez votre profil et vos préférences.',
  });

  entete.append(titre, description);

  // Conteneur principal
  const contenu = creerElement('div', {
    classes: ['parametres-contenu'],
    attrs: { id: 'parametres-contenu' },
  });

  page.append(entete, contenu);
  container.append(page);

  // Charger le profil
  await chargerProfil();
}

/**
 * Charge le profil utilisateur
 */
async function chargerProfil(): Promise<void> {
  const contenu = $('#parametres-contenu');
  if (!contenu) return;

  contenu.innerHTML = `
    <div class="chargement">
      <div class="spinner"></div>
      <p>Chargement du profil...</p>
    </div>
  `;

  try {
    [utilisateurCourant, statut2FA] = await Promise.all([
      auth.profil(),
      auth.statut2FA(),
    ]);
    afficherFormulaires();
  } catch {
    toast.erreur('Erreur lors du chargement du profil');
    contenu.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">❌</div>
        <div class="message-vide-titre">Erreur de chargement</div>
        <p>Impossible de charger le profil.</p>
      </div>
    `;
  }
}

/**
 * Affiche les formulaires de paramètres
 */
function afficherFormulaires(): void {
  const contenu = $('#parametres-contenu');
  if (!contenu || !utilisateurCourant) return;

  vider(contenu);

  // Section Profil
  const sectionProfil = creerSectionProfil();

  // Section Préférences
  const sectionPreferences = creerSectionPreferences();

  // Section Mot de passe
  const sectionMotDePasse = creerSectionMotDePasse();

  // Section 2FA
  const section2FA = creerSection2FA();

  contenu.append(sectionProfil, sectionPreferences, sectionMotDePasse, section2FA);
}

/**
 * Crée la section profil
 */
function creerSectionProfil(): HTMLElement {
  const section = creerElement('section', {
    classes: ['parametres-section'],
  });

  const titre = creerElement('h2', {
    classes: ['parametres-section-titre'],
    texte: 'Profil',
  });

  const info = creerElement('div', {
    classes: ['parametres-info'],
  });

  info.innerHTML = `
    <div class="parametres-info-ligne">
      <span class="parametres-info-label">Email</span>
      <span class="parametres-info-valeur">${utilisateurCourant?.email ?? '-'}</span>
    </div>
    <div class="parametres-info-ligne">
      <span class="parametres-info-label">Membre depuis</span>
      <span class="parametres-info-valeur">${
        utilisateurCourant?.dateCreation
          ? new Date(utilisateurCourant.dateCreation).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : '-'
      }</span>
    </div>
  `;

  section.append(titre, info);
  return section;
}

/**
 * Crée la section préférences
 */
function creerSectionPreferences(): HTMLElement {
  const section = creerElement('section', {
    classes: ['parametres-section'],
  });

  const titre = creerElement('h2', {
    classes: ['parametres-section-titre'],
    texte: 'Préférences',
  });

  const form = creerElement('form', {
    classes: ['parametres-form'],
    attrs: { id: 'form-preferences' },
  }) as HTMLFormElement;

  const preferences = utilisateurCourant?.preferences ?? {};

  form.innerHTML = `
    <div class="form-groupe">
      <label for="pref-theme">Thème</label>
      <select id="pref-theme" name="theme" class="form-select">
        <option value="auto" ${preferences.theme === 'auto' ? 'selected' : ''}>Automatique (système)</option>
        <option value="clair" ${preferences.theme === 'clair' ? 'selected' : ''}>Clair</option>
        <option value="sombre" ${preferences.theme === 'sombre' ? 'selected' : ''}>Sombre</option>
      </select>
      <small class="form-aide">Le thème automatique suit les préférences de votre système.</small>
    </div>

    <div class="form-groupe">
      <label for="pref-langue">Langue</label>
      <select id="pref-langue" name="langue" class="form-select">
        <option value="fr" ${preferences.langue === 'fr' || !preferences.langue ? 'selected' : ''}>Français</option>
        <option value="en" ${preferences.langue === 'en' ? 'selected' : ''}>English</option>
      </select>
    </div>

    <div class="form-groupe">
      <label for="pref-frequence">Fréquence de rafraîchissement</label>
      <select id="pref-frequence" name="frequenceRafraichissement" class="form-select">
        <option value="5" ${preferences.frequenceRafraichissement === 5 ? 'selected' : ''}>5 minutes</option>
        <option value="15" ${preferences.frequenceRafraichissement === 15 ? 'selected' : ''}>15 minutes</option>
        <option value="30" ${preferences.frequenceRafraichissement === 30 || !preferences.frequenceRafraichissement ? 'selected' : ''}>30 minutes</option>
        <option value="60" ${preferences.frequenceRafraichissement === 60 ? 'selected' : ''}>1 heure</option>
        <option value="120" ${preferences.frequenceRafraichissement === 120 ? 'selected' : ''}>2 heures</option>
      </select>
      <small class="form-aide">Intervalle entre les synchronisations automatiques des sources.</small>
    </div>

    <button type="submit" class="btn btn-primaire">Enregistrer les préférences</button>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sauvegarderPreferences(form);
  });

  section.append(titre, form);
  return section;
}

/**
 * Sauvegarde les préférences
 */
async function sauvegarderPreferences(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);
  const bouton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  const preferences: Partial<Preferences> = {
    theme: formData.get('theme') as Preferences['theme'],
    langue: formData.get('langue') as Preferences['langue'],
    frequenceRafraichissement: parseInt(formData.get('frequenceRafraichissement') as string, 10),
  };

  bouton.disabled = true;
  bouton.textContent = 'Enregistrement...';

  try {
    utilisateurCourant = await auth.mettreAJourProfil(preferences);
    toast.succes('Préférences enregistrées');

    // Appliquer le thème immédiatement
    if (preferences.theme) {
      appliquerTheme(preferences.theme);
    }
  } catch {
    toast.erreur('Erreur lors de la sauvegarde');
  } finally {
    bouton.disabled = false;
    bouton.textContent = 'Enregistrer les préférences';
  }
}

/**
 * Applique le thème choisi
 */
function appliquerTheme(theme: 'clair' | 'sombre' | 'auto'): void {
  const html = document.documentElement;

  if (theme === 'auto') {
    html.removeAttribute('data-theme');
    const prefereSombre = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefereSombre ? 'sombre' : 'clair');
  } else {
    html.setAttribute('data-theme', theme);
  }

  localStorage.setItem('theme', theme);
}

/**
 * Crée la section changement de mot de passe
 */
function creerSectionMotDePasse(): HTMLElement {
  const section = creerElement('section', {
    classes: ['parametres-section'],
  });

  const titre = creerElement('h2', {
    classes: ['parametres-section-titre'],
    texte: 'Sécurité',
  });

  const form = creerElement('form', {
    classes: ['parametres-form'],
    attrs: { id: 'form-mot-de-passe' },
  }) as HTMLFormElement;

  form.innerHTML = `
    <div class="form-groupe">
      <label for="mdp-actuel">Mot de passe actuel</label>
      <input type="password" id="mdp-actuel" name="motDePasseActuel" class="form-input" required autocomplete="current-password">
    </div>

    <div class="form-groupe">
      <label for="mdp-nouveau">Nouveau mot de passe</label>
      <input type="password" id="mdp-nouveau" name="nouveauMotDePasse" class="form-input" required minlength="10" autocomplete="new-password">
      <small class="form-aide">Minimum 10 caractères, avec au moins une majuscule et un chiffre.</small>
    </div>

    <div class="form-groupe">
      <label for="mdp-confirmation">Confirmer le mot de passe</label>
      <input type="password" id="mdp-confirmation" name="confirmation" class="form-input" required autocomplete="new-password">
    </div>

    <button type="submit" class="btn btn-secondaire">Changer le mot de passe</button>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await changerMotDePasse(form);
  });

  section.append(titre, form);
  return section;
}

/**
 * Change le mot de passe
 */
async function changerMotDePasse(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);
  const bouton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  const motDePasseActuel = formData.get('motDePasseActuel') as string;
  const nouveauMotDePasse = formData.get('nouveauMotDePasse') as string;
  const confirmation = formData.get('confirmation') as string;

  // Validation
  if (nouveauMotDePasse !== confirmation) {
    toast.erreur('Les mots de passe ne correspondent pas');
    return;
  }

  if (nouveauMotDePasse.length < 10) {
    toast.erreur('Le mot de passe doit contenir au moins 10 caractères');
    return;
  }

  if (!/[A-Z]/.test(nouveauMotDePasse)) {
    toast.erreur('Le mot de passe doit contenir au moins une majuscule');
    return;
  }

  if (!/[0-9]/.test(nouveauMotDePasse)) {
    toast.erreur('Le mot de passe doit contenir au moins un chiffre');
    return;
  }

  bouton.disabled = true;
  bouton.textContent = 'Changement...';

  try {
    await auth.changerMotDePasse(motDePasseActuel, nouveauMotDePasse);
    toast.succes('Mot de passe modifié avec succès');
    form.reset();
  } catch {
    toast.erreur('Erreur lors du changement de mot de passe');
  } finally {
    bouton.disabled = false;
    bouton.textContent = 'Changer le mot de passe';
  }
}

/**
 * Crée la section authentification à deux facteurs
 */
function creerSection2FA(): HTMLElement {
  const section = creerElement('section', {
    classes: ['parametres-section'],
    attrs: { id: 'section-2fa' },
  });

  const titre = creerElement('h2', {
    classes: ['parametres-section-titre'],
    texte: 'Authentification à deux facteurs (2FA)',
  });

  const contenu = creerElement('div', {
    classes: ['section-2fa-contenu'],
    attrs: { id: 'contenu-2fa' },
  });

  section.append(titre, contenu);

  // Afficher le contenu approprié selon le statut
  afficherContenu2FA();

  return section;
}

/**
 * Affiche le contenu 2FA selon le statut
 */
function afficherContenu2FA(): void {
  const contenu = $('#contenu-2fa');
  if (!contenu) return;

  vider(contenu);

  if (statut2FA?.actif) {
    afficher2FAActive(contenu);
  } else {
    afficher2FAInactive(contenu);
  }
}

/**
 * Affiche l'interface quand 2FA est désactivé
 */
function afficher2FAInactive(contenu: Element): void {
  const wrapper = creerElement('div', {
    classes: ['deux-fa-inactive'],
  });

  wrapper.innerHTML = `
    <div class="deux-fa-description">
      <div class="deux-fa-icone">🔓</div>
      <div>
        <p class="deux-fa-titre">Renforcez la sécurité de votre compte</p>
        <p class="deux-fa-texte">L'authentification à deux facteurs ajoute une couche de protection supplémentaire.
        À chaque connexion, vous devrez entrer un code généré par votre application d'authentification.</p>
      </div>
    </div>
    <button type="button" class="btn btn-primaire" id="btn-activer-2fa">Activer la 2FA</button>
  `;

  contenu.append(wrapper);

  const btnActiver = $('#btn-activer-2fa');
  if (btnActiver) {
    btnActiver.addEventListener('click', () => demarrerActivation2FA());
  }
}

/**
 * Affiche l'interface quand 2FA est activé
 */
function afficher2FAActive(contenu: Element): void {
  const wrapper = creerElement('div', {
    classes: ['deux-fa-active'],
  });

  wrapper.innerHTML = `
    <div class="deux-fa-description">
      <div class="deux-fa-icone deux-fa-icone-actif">🔒</div>
      <div>
        <p class="deux-fa-titre deux-fa-titre-actif">Authentification à deux facteurs activée</p>
        <p class="deux-fa-texte">Votre compte est protégé par l'authentification à deux facteurs.</p>
      </div>
    </div>
    <div class="deux-fa-desactiver">
      <p class="deux-fa-avertissement">Pour désactiver la 2FA, entrez un code de votre application d'authentification.</p>
      <form id="form-desactiver-2fa" class="deux-fa-form-desactiver">
        <div class="form-groupe">
          <label for="code-desactiver-2fa">Code d'authentification</label>
          <input type="text" id="code-desactiver-2fa" name="code" class="form-input code-input"
                 placeholder="000000" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required>
        </div>
        <button type="submit" class="btn btn-danger">Désactiver la 2FA</button>
      </form>
    </div>
  `;

  contenu.append(wrapper);

  const formDesactiver = $('#form-desactiver-2fa') as HTMLFormElement | null;
  if (formDesactiver) {
    formDesactiver.addEventListener('submit', async (e) => {
      e.preventDefault();
      await desactiver2FA(formDesactiver);
    });
  }
}

/**
 * Démarre le processus d'activation de la 2FA
 */
async function demarrerActivation2FA(): Promise<void> {
  const contenu = $('#contenu-2fa');
  if (!contenu) return;

  const btnActiver = $('#btn-activer-2fa') as HTMLButtonElement | null;
  if (btnActiver) {
    btnActiver.disabled = true;
    btnActiver.textContent = 'Chargement...';
  }

  try {
    const resultat = await auth.activer2FA();
    afficherConfiguration2FA(contenu, resultat.qrCode, resultat.secret);
  } catch {
    toast.erreur('Erreur lors de l\'activation de la 2FA');
    if (btnActiver) {
      btnActiver.disabled = false;
      btnActiver.textContent = 'Activer la 2FA';
    }
  }
}

/**
 * Affiche l'écran de configuration 2FA avec QR code
 */
function afficherConfiguration2FA(contenu: Element, qrCode: string, secret: string): void {
  vider(contenu);

  const wrapper = creerElement('div', {
    classes: ['deux-fa-configuration'],
  });

  wrapper.innerHTML = `
    <div class="deux-fa-etapes">
      <div class="deux-fa-etape">
        <span class="etape-numero">1</span>
        <div class="etape-contenu">
          <p class="etape-titre">Scannez ce QR code</p>
          <p class="etape-texte">Utilisez une application d'authentification comme Google Authenticator, Authy ou 1Password.</p>
          <div class="qr-code-container">
            <img src="${qrCode}" alt="QR Code 2FA" class="qr-code-image">
          </div>
          <details class="secret-manuel">
            <summary>Impossible de scanner ? Entrez le code manuellement</summary>
            <div class="secret-code">
              <code>${secret}</code>
              <button type="button" class="btn btn-petit" id="btn-copier-secret">Copier</button>
            </div>
          </details>
        </div>
      </div>
      <div class="deux-fa-etape">
        <span class="etape-numero">2</span>
        <div class="etape-contenu">
          <p class="etape-titre">Confirmez l'activation</p>
          <p class="etape-texte">Entrez le code à 6 chiffres affiché dans votre application.</p>
          <form id="form-confirmer-2fa" class="form-confirmer-2fa">
            <div class="form-groupe">
              <input type="text" id="code-confirmer-2fa" name="code" class="form-input code-input code-input-grand"
                     placeholder="000000" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondaire" id="btn-annuler-2fa">Annuler</button>
              <button type="submit" class="btn btn-primaire">Confirmer et activer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  contenu.append(wrapper);

  // Copier le secret
  const btnCopier = $('#btn-copier-secret');
  if (btnCopier) {
    btnCopier.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(secret);
        toast.succes('Code copié dans le presse-papier');
      } catch {
        toast.erreur('Impossible de copier le code');
      }
    });
  }

  // Annuler
  const btnAnnuler = $('#btn-annuler-2fa');
  if (btnAnnuler) {
    btnAnnuler.addEventListener('click', () => {
      afficherContenu2FA();
    });
  }

  // Confirmer
  const formConfirmer = $('#form-confirmer-2fa') as HTMLFormElement | null;
  if (formConfirmer) {
    formConfirmer.addEventListener('submit', async (e) => {
      e.preventDefault();
      await confirmer2FA(formConfirmer);
    });
  }
}

/**
 * Confirme l'activation de la 2FA
 */
async function confirmer2FA(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);
  const code = formData.get('code') as string;
  const bouton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  if (!/^\d{6}$/.test(code)) {
    toast.erreur('Le code doit contenir 6 chiffres');
    return;
  }

  bouton.disabled = true;
  bouton.textContent = 'Vérification...';

  try {
    await auth.confirmer2FA(code);
    statut2FA = { actif: true, configure: true };
    toast.succes('Authentification à deux facteurs activée');
    afficherContenu2FA();
  } catch {
    toast.erreur('Code invalide. Veuillez réessayer.');
    bouton.disabled = false;
    bouton.textContent = 'Confirmer et activer';
  }
}

/**
 * Désactive la 2FA
 */
async function desactiver2FA(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);
  const code = formData.get('code') as string;
  const bouton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  if (!/^\d{6}$/.test(code)) {
    toast.erreur('Le code doit contenir 6 chiffres');
    return;
  }

  bouton.disabled = true;
  bouton.textContent = 'Désactivation...';

  try {
    await auth.desactiver2FA(code);
    statut2FA = { actif: false, configure: false };
    toast.succes('Authentification à deux facteurs désactivée');
    afficherContenu2FA();
  } catch {
    toast.erreur('Code invalide. Veuillez réessayer.');
    bouton.disabled = false;
    bouton.textContent = 'Désactiver la 2FA';
  }
}
