/**
 * Veilleur - Page Paramètres : compte, sécurité, notifications, application et données,
 * et, pour les administrateurs, les panneaux d'administration. Navigation latérale, pleine largeur.
 */

import { appliquerTheme, themeEnregistre, type Theme } from '../utils/theme';
import { iconeHtml } from '../utils/icones';
import { ajouterBasculeMotDePasse } from '../utils/formulaires';
import { creerElement, $, vider } from '../utils/dom';
import { auth, articles, notifications, estAuthentifie } from '../services/api';
import { pushSupporte, abonnementCourant, abonnerPush, desabonnerPush } from '../utils/notificationsPush';
import { estInstallee, installationPossible, proposerInstallation, surChangementInstallation } from '../utils/pwa';
import { telechargerFichier, suffixeDate } from '../utils/telechargement';
import { toast } from '../utils/toast';
import { sectionsPour, sectionDepuisHash, type SectionParametres } from '../utils/sectionsParametres';
import { afficherApercu, afficherComptes, afficherSources, afficherSysteme, detruireGraphiques, definirAdministrateurCourant, creerChargement } from './PageAdmin';
import type { Utilisateur, Preferences, Statut2FA } from '../services/api';

let utilisateurCourant: Utilisateur | null = null;
let statut2FA: Statut2FA | null = null;
let gestionnaireHash: (() => void) | null = null;
let gestionnaireTheme: ((e: Event) => void) | null = null;

const RENDUS: Record<string, (panneau: HTMLElement) => void | Promise<void>> = {
  compte: afficherCompte,
  securite: afficherSecurite,
  notifications: afficherNotifications,
  application: afficherApplication,
  apercu: afficherApercu,
  comptes: afficherComptes,
  sources: afficherSources,
  systeme: afficherSysteme,
};

/**
 * Affiche la page des paramètres
 */
export async function afficherPageParametres(container: Element): Promise<void> {
  vider(container);
  detruireGraphiques();
  if (gestionnaireHash) window.removeEventListener('hashchange', gestionnaireHash);

  if (!estAuthentifie()) {
    container.innerHTML = `
      <div class="la-empty">
        <div class="la-empty-icon">${iconeHtml('lock')}</div>
        <div class="la-empty-title">Connexion requise</div>
        <p>Connectez-vous pour accéder aux paramètres.</p>
        <a href="/connexion" class="la-btn primary" data-nav>Se connecter</a>
      </div>
    `;
    return;
  }

  const page = creerElement('div', { classes: ['page-parametres'] });
  page.append(creerChargement());
  container.append(page);

  try {
    [utilisateurCourant, statut2FA] = await Promise.all([auth.profil(), auth.statut2FA()]);
  } catch {
    toast.erreur('Erreur lors du chargement du profil');
    page.innerHTML = `
      <div class="la-empty">
        <div class="la-empty-icon">${iconeHtml('error')}</div>
        <div class="la-empty-title">Erreur de chargement</div>
        <p>Impossible de charger le profil.</p>
      </div>
    `;
    return;
  }
  definirAdministrateurCourant(utilisateurCourant);
  vider(page);

  const sections = sectionsPour(utilisateurCourant.role);
  const estAdmin = utilisateurCourant.role === 'admin';

  const entete = creerElement('header', { classes: ['page-entete', 'parametres-entete'] });
  entete.append(
    creerElement('h1', { classes: ['page-titre'], icone: 'settings', texte: 'Paramètres' }),
    creerElement('p', { classes: ['page-description'], texte: estAdmin ? 'Votre compte, et l\'instance que vous administrez.' : 'Votre compte, votre sécurité, vos notifications et votre application.' }),
  );

  const panneau = creerElement('section', { classes: ['parametres-panneau'], attrs: { id: 'parametres-panneau' } });
  const nav = creerNavigation(sections, section => choisir(section));

  const choisir = (section: SectionParametres, pousser = true): void => {
    nav.querySelectorAll<HTMLAnchorElement>('.parametres-nav-lien').forEach(lien => {
      const actif = lien.dataset.section === section.id;
      lien.classList.toggle('actif', actif);
      if (actif) lien.setAttribute('aria-current', 'page');
      else lien.removeAttribute('aria-current');
    });
    if (pousser && window.location.hash !== `#${section.id}`) {
      history.replaceState(null, '', `${window.location.pathname}#${section.id}`);
    }
    detruireGraphiques();
    vider(panneau);
    const enteteSection = creerElement('header', { classes: ['parametres-panneau-entete'] });
    enteteSection.append(
      creerElement('h2', { classes: ['parametres-panneau-titre'], icone: section.icone, texte: section.libelle }),
      creerElement('p', { classes: ['parametres-panneau-description'], texte: section.description }),
    );
    const contenu = creerElement('div', { classes: ['parametres-panneau-contenu', `section-${section.id}`] });
    contenu.append(creerChargement());
    panneau.append(enteteSection, contenu);
    void RENDUS[section.id]?.(contenu);
  };

  gestionnaireHash = () => choisir(sectionDepuisHash(window.location.hash, sections), false);
  window.addEventListener('hashchange', gestionnaireHash);

  page.append(entete, nav, panneau);
  choisir(sectionDepuisHash(window.location.hash, sections));
}

function creerNavigation(sections: SectionParametres[], onChoix: (section: SectionParametres) => void): HTMLElement {
  const nav = creerElement('nav', { classes: ['parametres-nav'], attrs: { 'aria-label': 'Sections des paramètres' } });
  const groupes: Array<{ cle: SectionParametres['groupe']; titre: string }> = [
    { cle: 'compte', titre: 'Mon compte' },
    { cle: 'admin', titre: 'Administration' },
  ];
  for (const groupe of groupes) {
    const membres = sections.filter(s => s.groupe === groupe.cle);
    if (membres.length === 0) continue;
    const bloc = creerElement('div', { classes: ['parametres-nav-groupe', groupe.cle] });
    bloc.append(creerElement('p', { classes: ['parametres-nav-titre'], texte: groupe.titre }));
    for (const section of membres) {
      const lien = creerElement('a', {
        classes: ['parametres-nav-lien'],
        attrs: { href: `#${section.id}`, 'data-section': section.id },
        icone: section.icone,
        onClick: e => {
          e.preventDefault();
          onChoix(section);
        },
      });
      lien.append(creerElement('span', { classes: ['parametres-nav-libelle'], texte: section.libelle }));
      bloc.append(lien);
    }
    nav.append(bloc);
  }
  return nav;
}

interface OptionsCarte {
  id?: string;
  icone: string;
  titre: string;
  description?: string;
  large?: boolean;
}

/** Carte de réglages : en-tête (icône, titre, description) puis corps */
function creerCarte(options: OptionsCarte): { carte: HTMLElement; corps: HTMLElement } {
  const carte = creerElement('section', { classes: ['parametres-carte', 'la-card', options.large ? 'large' : ''], attrs: options.id ? { id: options.id } : {} });
  const entete = creerElement('header', { classes: ['parametres-carte-entete'] });
  const textes = creerElement('div');
  textes.append(creerElement('h3', { classes: ['parametres-carte-titre'], texte: options.titre }));
  if (options.description) textes.append(creerElement('p', { classes: ['parametres-carte-description'], texte: options.description }));
  entete.append(creerElement('span', { classes: ['parametres-carte-icone'], html: iconeHtml(options.icone) }), textes);
  const corps = creerElement('div', { classes: ['parametres-carte-corps'] });
  carte.append(entete, corps);
  return { carte, corps };
}

function creerGrille(...cartes: HTMLElement[]): HTMLElement {
  return creerElement('div', { classes: ['parametres-grille'], enfants: cartes });
}

// ============================================
// Compte : identité et préférences
// ============================================

function afficherCompte(panneau: HTMLElement): void {
  vider(panneau);
  panneau.append(creerIdentite(), creerGrille(creerCartePreferences()));
}

function creerIdentite(): HTMLElement {
  const u = utilisateurCourant!;
  const identite = creerElement('div', { classes: ['compte-identite', 'la-card'] });
  const initiale = (u.email[0] ?? '?').toUpperCase();
  identite.append(creerElement('div', { classes: ['compte-avatar'], attrs: { 'aria-hidden': 'true' }, texte: initiale }));
  const infos = creerElement('div', { classes: ['compte-infos'] });
  infos.append(creerElement('p', { classes: ['compte-email'], texte: u.email }));
  const depuis = u.dateCreation ? new Date(u.dateCreation).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  if (depuis) infos.append(creerElement('p', { classes: ['compte-depuis'], texte: `Membre depuis le ${depuis}` }));
  const badges = creerElement('div', { classes: ['compte-badges'] });
  badges.append(creerElement('span', { classes: ['la-badge', 'sm', u.role === 'admin' ? 'primary' : 'secondary'], texte: u.role === 'admin' ? 'Administrateur' : 'Membre' }));
  badges.append(creerElement('a', {
    classes: ['la-badge', 'sm', statut2FA?.actif ? 'success' : 'warning', 'compte-badge-lien'],
    attrs: { href: '#securite', title: statut2FA?.actif ? 'Authentification à deux facteurs active' : 'Activer la double authentification' },
    texte: statut2FA?.actif ? '2FA activée' : '2FA désactivée',
  }));
  infos.append(badges);
  identite.append(infos);
  return identite;
}

function creerCartePreferences(): HTMLElement {
  const { carte, corps } = creerCarte({ id: 'section-preferences', icone: 'tune', titre: 'Préférences', description: 'Le thème s\'applique à cet appareil ; la langue et la fréquence suivent votre compte.', large: true });
  const form = creerElement('form', { classes: ['parametres-form'], attrs: { id: 'form-preferences' } });

  // Le thème affiché est celui réellement appliqué sur cet appareil (bouton de l'en-tête compris)
  const preferences = { ...(utilisateurCourant?.preferences ?? {}), theme: themeEnregistre() };

  // Le bouton de thème de l'en-tête et ce sélecteur restent d'accord
  if (gestionnaireTheme) document.removeEventListener('veilleur:theme', gestionnaireTheme);
  gestionnaireTheme = (e: Event) => {
    const select = form.querySelector<HTMLSelectElement>('#pref-theme');
    if (select) select.value = (e as CustomEvent<Theme>).detail;
  };
  document.addEventListener('veilleur:theme', gestionnaireTheme);

  form.innerHTML = `
    <div class="parametres-champs">
      <div class="la-form-group">
        <label for="pref-theme">Thème</label>
        <select id="pref-theme" name="theme" class="la-select">
          <option value="auto" ${preferences.theme === 'auto' ? 'selected' : ''}>Automatique (système)</option>
          <option value="clair" ${preferences.theme === 'clair' ? 'selected' : ''}>Clair</option>
          <option value="sombre" ${preferences.theme === 'sombre' ? 'selected' : ''}>Sombre</option>
        </select>
        <small class="la-help">Le thème automatique suit les préférences de votre système.</small>
      </div>

      <div class="la-form-group">
        <label for="pref-langue">Langue</label>
        <select id="pref-langue" name="langue" class="la-select">
          <option value="fr" ${preferences.langue === 'fr' || !preferences.langue ? 'selected' : ''}>Français</option>
          <option value="en" ${preferences.langue === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>

      <div class="la-form-group">
        <label for="pref-frequence">Fréquence de rafraîchissement</label>
        <select id="pref-frequence" name="frequenceRafraichissement" class="la-select">
          <option value="5" ${preferences.frequenceRafraichissement === 5 ? 'selected' : ''}>5 minutes</option>
          <option value="15" ${preferences.frequenceRafraichissement === 15 ? 'selected' : ''}>15 minutes</option>
          <option value="30" ${preferences.frequenceRafraichissement === 30 || !preferences.frequenceRafraichissement ? 'selected' : ''}>30 minutes</option>
          <option value="60" ${preferences.frequenceRafraichissement === 60 ? 'selected' : ''}>1 heure</option>
          <option value="120" ${preferences.frequenceRafraichissement === 120 ? 'selected' : ''}>2 heures</option>
        </select>
        <small class="la-help">Intervalle entre les synchronisations automatiques de vos sources.</small>
      </div>
    </div>

    <div class="parametres-actions">
      <button type="submit" class="la-btn primary">Enregistrer les préférences</button>
    </div>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sauvegarderPreferences(form);
  });

  corps.append(form);
  return carte;
}

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
    if (preferences.theme) appliquerTheme(preferences.theme);
  } catch {
    toast.erreur('Erreur lors de la sauvegarde');
  } finally {
    bouton.disabled = false;
    bouton.textContent = 'Enregistrer les préférences';
  }
}

// ============================================
// Sécurité : mot de passe et 2FA
// ============================================

function afficherSecurite(panneau: HTMLElement): void {
  vider(panneau);
  panneau.append(creerGrille(creerCarteMotDePasse(), creerCarte2FA()));
}

function creerCarteMotDePasse(): HTMLElement {
  const { carte, corps } = creerCarte({ id: 'section-mot-de-passe', icone: 'password', titre: 'Mot de passe', description: 'Dix caractères au moins, avec une majuscule et un chiffre.' });
  const form = creerElement('form', { classes: ['parametres-form'], attrs: { id: 'form-mot-de-passe' } });
  form.innerHTML = `
    <div class="la-form-group">
      <label for="mdp-actuel">Mot de passe actuel</label>
      <input type="password" id="mdp-actuel" name="motDePasseActuel" class="la-input" required autocomplete="current-password">
    </div>

    <div class="la-form-group">
      <label for="mdp-nouveau">Nouveau mot de passe</label>
      <input type="password" id="mdp-nouveau" name="nouveauMotDePasse" class="la-input" required minlength="10" autocomplete="new-password">
    </div>

    <div class="la-form-group">
      <label for="mdp-confirmation">Confirmer le mot de passe</label>
      <input type="password" id="mdp-confirmation" name="confirmation" class="la-input" required autocomplete="new-password">
    </div>

    <div class="parametres-actions">
      <button type="submit" class="la-btn secondary">Changer le mot de passe</button>
    </div>
  `;
  ajouterBasculeMotDePasse(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await changerMotDePasse(form);
  });
  corps.append(form);
  return carte;
}

async function changerMotDePasse(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);
  const bouton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  const motDePasseActuel = formData.get('motDePasseActuel') as string;
  const nouveauMotDePasse = formData.get('nouveauMotDePasse') as string;
  const confirmation = formData.get('confirmation') as string;

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

function creerCarte2FA(): HTMLElement {
  const { carte, corps } = creerCarte({ id: 'section-2fa', icone: 'phonelink_lock', titre: 'Authentification à deux facteurs', description: 'Un code de votre application d\'authentification à chaque connexion.' });
  const contenu = creerElement('div', { classes: ['section-2fa-contenu'], attrs: { id: 'contenu-2fa' } });
  corps.append(contenu);
  // La carte n'est pas encore dans le document : on passe l'élément plutôt que de le chercher
  afficherContenu2FA(contenu);
  return carte;
}

function afficherContenu2FA(cible?: Element): void {
  const contenu = cible ?? $('#contenu-2fa');
  if (!contenu) return;
  vider(contenu);
  if (statut2FA?.actif) {
    afficher2FAActive(contenu);
  } else {
    afficher2FAInactive(contenu);
  }
}

function afficher2FAInactive(contenu: Element): void {
  const wrapper = creerElement('div', { classes: ['deux-fa-inactive'] });
  wrapper.innerHTML = `
    <div class="deux-fa-description">
      <div class="deux-fa-icone">${iconeHtml('lock_open')}</div>
      <div>
        <p class="deux-fa-titre">Renforcez la sécurité de votre compte</p>
        <p class="deux-fa-texte">L'authentification à deux facteurs ajoute une couche de protection supplémentaire.
        À chaque connexion, vous devrez entrer un code généré par votre application d'authentification.</p>
      </div>
    </div>
    <div class="parametres-actions">
      <button type="button" class="la-btn primary" id="btn-activer-2fa">Activer la 2FA</button>
    </div>
  `;
  contenu.append(wrapper);
  $('#btn-activer-2fa', contenu)?.addEventListener('click', () => demarrerActivation2FA());
}

function afficher2FAActive(contenu: Element): void {
  const wrapper = creerElement('div', { classes: ['deux-fa-active'] });
  wrapper.innerHTML = `
    <div class="deux-fa-description">
      <div class="deux-fa-icone deux-fa-icone-actif">${iconeHtml('lock', { plein: true })}</div>
      <div>
        <p class="deux-fa-titre deux-fa-titre-actif">Authentification à deux facteurs activée</p>
        <p class="deux-fa-texte">Votre compte est protégé par l'authentification à deux facteurs.</p>
      </div>
    </div>
    <div class="deux-fa-desactiver">
      <p class="deux-fa-avertissement">Pour désactiver la 2FA, entrez un code de votre application d'authentification.</p>
      <form id="form-desactiver-2fa" class="deux-fa-form-desactiver">
        <div class="la-form-group">
          <label for="code-desactiver-2fa">Code d'authentification</label>
          <input type="text" id="code-desactiver-2fa" name="code" class="la-input code-input"
                 placeholder="000000" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required>
        </div>
        <button type="submit" class="la-btn error">Désactiver la 2FA</button>
      </form>
    </div>
  `;
  contenu.append(wrapper);
  const formDesactiver = $('#form-desactiver-2fa', contenu) as HTMLFormElement | null;
  formDesactiver?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await desactiver2FA(formDesactiver);
  });
}

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

function afficherConfiguration2FA(contenu: Element, qrCode: string, secret: string): void {
  vider(contenu);
  const wrapper = creerElement('div', { classes: ['deux-fa-configuration'] });
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
              <button type="button" class="la-btn sm" id="btn-copier-secret">Copier</button>
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
            <div class="la-form-group">
              <input type="text" id="code-confirmer-2fa" name="code" class="la-input code-input code-input-grand"
                     placeholder="000000" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required>
            </div>
            <div class="form-actions">
              <button type="button" class="la-btn secondary" id="btn-annuler-2fa">Annuler</button>
              <button type="submit" class="la-btn primary">Confirmer et activer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  contenu.append(wrapper);

  $('#btn-copier-secret')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.succes('Code copié dans le presse-papier');
    } catch {
      toast.erreur('Impossible de copier le code');
    }
  });
  $('#btn-annuler-2fa')?.addEventListener('click', () => afficherContenu2FA());
  const formConfirmer = $('#form-confirmer-2fa') as HTMLFormElement | null;
  formConfirmer?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await confirmer2FA(formConfirmer);
  });
}

async function confirmer2FA(form: HTMLFormElement): Promise<void> {
  const code = new FormData(form).get('code') as string;
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

async function desactiver2FA(form: HTMLFormElement): Promise<void> {
  const code = new FormData(form).get('code') as string;
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

// ============================================
// Notifications : Web Push et résumé courriel
// ============================================

function afficherNotifications(panneau: HTMLElement): void {
  vider(panneau);
  panneau.append(creerGrille(creerCartePush(), creerCarteResume()));
}

function creerCartePush(): HTMLElement {
  const { carte, corps } = creerCarte({ id: 'section-push', icone: 'notifications_active', titre: 'Nouveaux articles sur cet appareil', description: 'Au plus une notification par demi-heure, regroupant les nouveautés de vos sources. Réglable source par source.' });
  corps.innerHTML = `
    <p class="la-help" id="push-etat">Vérification…</p>
    <div class="parametres-actions">
      <button type="button" class="la-btn secondary" id="btn-push" disabled>Activer les notifications</button>
      <button type="button" class="la-btn ghost sm" id="btn-push-test" hidden>Envoyer un test</button>
    </div>
  `;

  const etatPush = $('#push-etat', corps) as HTMLElement;
  const btnPush = $('#btn-push', corps) as HTMLButtonElement;
  const btnPushTest = $('#btn-push-test', corps) as HTMLButtonElement;
  let abonne = false;

  const rafraichirPush = async () => {
    if (!pushSupporte()) {
      etatPush.textContent = 'Ce navigateur ne prend pas en charge les notifications push.';
      return;
    }
    const [clePublique, abonnement, etat] = await Promise.all([
      notifications.clePublique(),
      abonnementCourant().catch(() => null),
      notifications.etat().catch(() => null),
    ]);
    if (!clePublique) {
      etatPush.textContent = 'Les notifications push ne sont pas activées sur ce serveur.';
      return;
    }
    abonne = abonnement !== null;
    const appareils = etat?.push.appareils ?? 0;
    if (abonne) {
      etatPush.textContent = `Activées sur cet appareil${appareils > 1 ? ` (${appareils} appareils au total)` : ''}.`;
    } else if (appareils > 0) {
      etatPush.textContent = `Désactivées ici, actives sur ${appareils} autre${appareils > 1 ? 's' : ''} appareil${appareils > 1 ? 's' : ''}.`;
    } else if (Notification.permission === 'denied') {
      etatPush.textContent = 'Les notifications sont bloquées par le navigateur pour ce site.';
    } else {
      etatPush.textContent = 'Désactivées sur cet appareil.';
    }
    btnPush.textContent = abonne ? 'Désactiver sur cet appareil' : 'Activer les notifications';
    btnPush.disabled = Notification.permission === 'denied' && !abonne;
    btnPushTest.hidden = !abonne;
    btnPush.dataset.clePublique = clePublique;
  };

  btnPush.addEventListener('click', async () => {
    btnPush.disabled = true;
    try {
      if (abonne) {
        const endpoint = await desabonnerPush();
        if (endpoint) await notifications.supprimerPush(endpoint);
        toast.info('Notifications désactivées sur cet appareil');
      } else {
        const abonnement = await abonnerPush(btnPush.dataset.clePublique ?? '');
        await notifications.enregistrerPush(abonnement);
        toast.succes('Notifications activées');
      }
    } catch (erreur) {
      toast.erreur((erreur as Error).message === 'Permission refusée' ? 'Vous avez refusé les notifications' : 'Impossible de modifier les notifications');
    } finally {
      btnPush.disabled = false;
      await rafraichirPush();
    }
  });

  btnPushTest.addEventListener('click', async () => {
    try {
      const { envoyes } = await notifications.testerPush();
      toast.info(envoyes > 0 ? 'Notification de test envoyée' : 'Aucun appareil joignable');
    } catch {
      toast.erreur('Échec de l\'envoi du test');
    }
  });

  void rafraichirPush();
  return carte;
}

function creerCarteResume(): HTMLElement {
  const preferences = utilisateurCourant?.preferences ?? {};
  const { carte, corps } = creerCarte({ id: 'section-resume', icone: 'mail', titre: 'Résumé par courriel', description: `Envoyé à ${utilisateurCourant?.email ?? 'votre adresse'}, seulement s'il y a quelque chose à lire.` });
  const form = creerElement('form', { classes: ['parametres-form'], attrs: { id: 'form-resume' } });
  form.innerHTML = `
    <div class="la-form-group">
      <label for="pref-resume">Articles non lus, groupés par source</label>
      <select id="pref-resume" name="resumeCourriel" class="la-select">
        <option value="aucun" ${!preferences.resumeCourriel || preferences.resumeCourriel === 'aucun' ? 'selected' : ''}>Jamais</option>
        <option value="quotidien" ${preferences.resumeCourriel === 'quotidien' ? 'selected' : ''}>Chaque matin (7 h)</option>
        <option value="hebdomadaire" ${preferences.resumeCourriel === 'hebdomadaire' ? 'selected' : ''}>Le lundi matin</option>
      </select>
    </div>
    <div class="parametres-actions">
      <button type="submit" class="la-btn primary">Enregistrer</button>
      <button type="button" class="la-btn ghost sm" id="btn-resume-test">M'envoyer un aperçu</button>
    </div>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const resumeCourriel = (new FormData(form).get('resumeCourriel') as Preferences['resumeCourriel']) ?? 'aucun';
    try {
      utilisateurCourant = await auth.mettreAJourProfil({ resumeCourriel });
      toast.succes(resumeCourriel === 'aucun' ? 'Vous ne recevrez plus de résumé' : 'Résumé courriel enregistré');
    } catch {
      toast.erreur('Impossible d\'enregistrer ce choix');
    }
  });
  ($('#btn-resume-test', form) as HTMLButtonElement).addEventListener('click', async () => {
    const frequence = (new FormData(form).get('resumeCourriel') as string) === 'hebdomadaire' ? 'hebdomadaire' : 'quotidien';
    try {
      const { envoye, email } = await notifications.testerResume(frequence);
      toast.info(envoye ? `Aperçu envoyé à ${email}` : 'Rien de nouveau à lire sur la période : aucun courriel envoyé');
    } catch {
      toast.erreur('Le serveur ne peut pas envoyer de courriel pour le moment');
    }
  });
  corps.append(form);
  return carte;
}

// ============================================
// Application et données : PWA et export
// ============================================

function afficherApplication(panneau: HTMLElement): void {
  vider(panneau);
  panneau.append(creerGrille(creerCarteInstallation(), creerCarteDonnees()));
}

function creerCarteInstallation(): HTMLElement {
  const { carte, corps } = creerCarte({ id: 'section-application', icone: 'install_mobile', titre: 'Installer Veilleur', description: 'Dans sa propre fenêtre, avec le fil consultable hors ligne.' });
  corps.innerHTML = `
    <p class="la-help" id="application-etat"></p>
    <div class="parametres-actions">
      <button type="button" class="la-btn secondary" id="btn-installer" hidden>Installer Veilleur</button>
    </div>
  `;
  const etat = $('#application-etat', corps) as HTMLElement;
  const bouton = $('#btn-installer', corps) as HTMLButtonElement;
  const rafraichir = () => {
    if (estInstallee()) {
      etat.textContent = 'Veilleur est installé sur cet appareil.';
      bouton.hidden = true;
    } else if (installationPossible()) {
      etat.textContent = 'Ajoutez Veilleur à votre écran d\'accueil : il s\'ouvre dans sa propre fenêtre et le fil reste consultable hors ligne.';
      bouton.hidden = false;
    } else {
      etat.textContent = 'Depuis le menu de votre navigateur, choisissez « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».';
      bouton.hidden = true;
    }
  };
  bouton.addEventListener('click', async () => {
    const accepte = await proposerInstallation();
    if (accepte) toast.succes('Veilleur est installé');
    rafraichir();
  });
  surChangementInstallation(rafraichir);
  rafraichir();
  return carte;
}

function creerCarteDonnees(): HTMLElement {
  const { carte, corps } = creerCarte({ id: 'section-donnees', icone: 'download', titre: 'Mes données', description: 'Vos notes, favoris, liste de lecture et articles lus. Les sources s\'exportent en OPML depuis la page Mes sources.' });
  const boutons = creerElement('div', { classes: ['parametres-actions'] });
  const creerBoutonExport = (format: 'json' | 'csv'): HTMLElement =>
    creerElement('button', {
      classes: ['la-btn', 'secondary'],
      attrs: { type: 'button', id: `btn-export-${format}` },
      icone: 'download',
      texte: `Exporter en ${format.toUpperCase()}`,
      onClick: async () => {
        try {
          const contenu = await articles.exporterAnnotations(format);
          telechargerFichier(contenu, `veilleur-annotations-${suffixeDate()}.${format}`, format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json');
          toast.succes('Annotations exportées');
        } catch {
          toast.erreur('Impossible d\'exporter les annotations');
        }
      },
    });
  boutons.append(creerBoutonExport('json'), creerBoutonExport('csv'));
  corps.append(boutons);
  return carte;
}
