/**
 * Veilleur - Pages d'authentification
 * Connexion, inscription, mot de passe oublié et réinitialisation
 */

import { iconeHtml } from '../utils/icones';
import { ajouterBasculeMotDePasse } from '../utils/formulaires';
import { creerElement, $, vider } from '../utils/dom';
import { auth, ErreurAPI } from '../services/api';
import { toast } from '../utils/toast';
import { naviguerVers } from '../main';

/** Règle affichée sous les champs « nouveau mot de passe » (identique à la règle serveur) */
const AIDE_MOT_DE_PASSE = '8 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial';

/**
 * Monte la carte d'authentification (logo + titre + contenu) dans le conteneur
 */
function monterCarte(container: Element, titre: string, contenu: string): HTMLElement {
  vider(container);
  const page = creerElement('div', { classes: ['page-auth'] });
  const carte = creerElement('div', { classes: ['auth-carte'] });
  carte.innerHTML = `
    <div class="auth-logo">
      <div class="auth-logo-icone">${iconeHtml('newspaper', { plein: true })}</div>
      <div class="auth-logo-texte">Veilleur</div>
    </div>
    <h2 class="auth-titre">${titre}</h2>
    ${contenu}
  `;
  ajouterBasculeMotDePasse(carte);
  page.append(carte);
  container.append(page);
  return carte;
}

function afficherErreur(id: string, message: string): void {
  const erreurDiv = $(`#${id}`);
  if (erreurDiv) {
    erreurDiv.textContent = message;
    erreurDiv.classList.remove('masque');
  }
}

function messageErreur(error: unknown, defaut: string): string {
  return error instanceof ErreurAPI ? error.message : defaut;
}

function valeur(form: HTMLFormElement, nom: string): string {
  return (form.elements.namedItem(nom) as HTMLInputElement).value;
}

/**
 * Désactive le bouton le temps d'une action asynchrone, puis le restaure
 */
async function avecBoutonOccupe(btn: HTMLButtonElement, libelleOccupe: string, action: () => Promise<void>): Promise<void> {
  const libelle = btn.textContent;
  btn.disabled = true;
  btn.textContent = libelleOccupe;
  try {
    await action();
  } finally {
    btn.disabled = false;
    btn.textContent = libelle;
  }
}

/**
 * Affiche la page de connexion
 */
export function afficherPageConnexion(container: Element): void {
  monterCarte(container, 'Connexion', `
    <form class="auth-formulaire" id="form-connexion">
      <div class="la-form-group">
        <label class="la-label requis" for="email">Email</label>
        <input type="email" id="email" name="email" class="la-input"
               placeholder="votre@email.com" required autocomplete="username" inputmode="email" spellcheck="false">
      </div>
      <div class="la-form-group">
        <label class="la-label requis" for="motDePasse">Mot de passe</label>
        <input type="password" id="motDePasse" name="motDePasse" class="la-input"
               placeholder="••••••••" required autocomplete="current-password">
        <a class="auth-lien-discret" href="/mot-de-passe-oublie" data-nav>Mot de passe oublié ?</a>
      </div>
      <div class="champ-erreur masque" id="erreur-connexion"></div>
      <div class="auth-actions">
        <button type="submit" class="la-btn primary lg" id="btn-connexion">
          Se connecter
        </button>
      </div>
    </form>
    <div class="auth-lien">
      Pas encore de compte ? <a href="/inscription" data-nav>Créer un compte</a>
    </div>
  `);

  $('#form-connexion')?.addEventListener('submit', gererConnexion);
}

/**
 * Gère la soumission du formulaire de connexion
 */
async function gererConnexion(e: Event): Promise<void> {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const email = valeur(form, 'email');
  const motDePasse = valeur(form, 'motDePasse');
  $('#erreur-connexion')?.classList.add('masque');

  await avecBoutonOccupe($('#btn-connexion') as HTMLButtonElement, 'Connexion...', async () => {
    try {
      await auth.connexion(email, motDePasse);
      toast.succes('Connexion réussie');
      naviguerVers('/');
    } catch (error) {
      afficherErreur('erreur-connexion', messageErreur(error, 'Email ou mot de passe incorrect'));
    }
  });
}

/**
 * Affiche la page d'inscription
 */
export function afficherPageInscription(container: Element): void {
  monterCarte(container, 'Créer un compte', `
    <form class="auth-formulaire" id="form-inscription">
      <div class="la-form-group">
        <label class="la-label requis" for="email">Email</label>
        <input type="email" id="email" name="email" class="la-input"
               placeholder="votre@email.com" required autocomplete="username" inputmode="email" spellcheck="false">
      </div>
      <div class="la-form-group">
        <label class="la-label requis" for="motDePasse">Mot de passe</label>
        <input type="password" id="motDePasse" name="motDePasse" class="la-input"
               placeholder="••••••••" required autocomplete="new-password" minlength="8">
        <span class="la-help">${AIDE_MOT_DE_PASSE}</span>
      </div>
      <div class="la-form-group">
        <label class="la-label requis" for="confirmation">Confirmer le mot de passe</label>
        <input type="password" id="confirmation" name="confirmation" class="la-input"
               placeholder="••••••••" required autocomplete="new-password">
      </div>
      <div class="champ-erreur masque" id="erreur-inscription"></div>
      <div class="auth-actions">
        <button type="submit" class="la-btn primary lg" id="btn-inscription">
          Créer mon compte
        </button>
      </div>
    </form>
    <div class="auth-lien">
      Déjà inscrit ? <a href="/connexion" data-nav>Se connecter</a>
    </div>
  `);

  $('#form-inscription')?.addEventListener('submit', gererInscription);
}

/**
 * Vérifie la paire mot de passe / confirmation ; renvoie le message d'erreur ou null
 */
function erreurPaireMotsDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse !== confirmation) return 'Les mots de passe ne correspondent pas';
  if (motDePasse.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères';
  return null;
}

/**
 * Gère la soumission du formulaire d'inscription
 */
async function gererInscription(e: Event): Promise<void> {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const email = valeur(form, 'email');
  const motDePasse = valeur(form, 'motDePasse');

  const erreur = erreurPaireMotsDePasse(motDePasse, valeur(form, 'confirmation'));
  if (erreur) {
    afficherErreur('erreur-inscription', erreur);
    return;
  }
  $('#erreur-inscription')?.classList.add('masque');

  await avecBoutonOccupe($('#btn-inscription') as HTMLButtonElement, 'Création...', async () => {
    try {
      await auth.inscription(email, motDePasse);
      toast.succes('Compte créé avec succès');
      naviguerVers('/');
    } catch (error) {
      afficherErreur('erreur-inscription', messageErreur(error, 'Erreur lors de la création du compte'));
    }
  });
}

/**
 * Affiche la page « Mot de passe oublié » (saisie de l'adresse)
 */
export function afficherPageMotDePasseOublie(container: Element): void {
  const carte = monterCarte(container, 'Mot de passe oublié', `
    <p class="auth-intro">Indiquez l'adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    <form class="auth-formulaire" id="form-oubli">
      <div class="la-form-group">
        <label class="la-label requis" for="email">Email</label>
        <input type="email" id="email" name="email" class="la-input"
               placeholder="votre@email.com" required autocomplete="username" inputmode="email" spellcheck="false">
      </div>
      <div class="champ-erreur masque" id="erreur-oubli"></div>
      <div class="auth-actions">
        <button type="submit" class="la-btn primary lg" id="btn-oubli">
          Envoyer le lien
        </button>
      </div>
    </form>
    <div class="auth-lien">
      <a href="/connexion" data-nav>Retour à la connexion</a>
    </div>
  `);

  $('#form-oubli')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = valeur(form, 'email');
    $('#erreur-oubli')?.classList.add('masque');

    await avecBoutonOccupe($('#btn-oubli') as HTMLButtonElement, 'Envoi...', async () => {
      try {
        await auth.motDePasseOublie(email);
        form.replaceWith(creerConfirmationEnvoi(email));
        carte.querySelector('.auth-titre')!.textContent = 'Courriel envoyé';
      } catch (error) {
        afficherErreur('erreur-oubli', messageErreur(error, 'Impossible d\'envoyer le courriel pour le moment'));
      }
    });
  });
}

function creerConfirmationEnvoi(email: string): HTMLElement {
  const bloc = creerElement('div', { classes: ['auth-confirmation'] });
  bloc.innerHTML = `
    <div class="auth-confirmation-icone">${iconeHtml('mail', { plein: true })}</div>
    <p>Si un compte existe pour <strong></strong>, un courriel vient de lui être envoyé avec un lien valable une heure.</p>
    <p class="la-help">Rien reçu après quelques minutes ? Vérifiez vos courriers indésirables.</p>
  `;
  bloc.querySelector('strong')!.textContent = email;
  return bloc;
}

/**
 * Lit le jeton de réinitialisation dans la chaîne de requête (`?token=…`)
 */
export function extraireTokenReinitialisation(search: string): string | null {
  const token = new URLSearchParams(search).get('token');
  return token && token.length > 0 ? token : null;
}

/**
 * Affiche la page de choix d'un nouveau mot de passe (lien reçu par courriel)
 */
export function afficherPageReinitialisation(container: Element, search: string = window.location.search): void {
  const token = extraireTokenReinitialisation(search);

  if (!token) {
    monterCarte(container, 'Lien incomplet', `
      <p class="auth-intro">Ce lien ne contient pas de jeton de réinitialisation. Il a peut-être été coupé par votre messagerie.</p>
      <div class="auth-actions">
        <a class="la-btn primary lg" href="/mot-de-passe-oublie" data-nav>Refaire une demande</a>
      </div>
    `);
    return;
  }

  monterCarte(container, 'Nouveau mot de passe', `
    <form class="auth-formulaire" id="form-reinitialisation">
      <div class="la-form-group">
        <label class="la-label requis" for="motDePasse">Nouveau mot de passe</label>
        <input type="password" id="motDePasse" name="motDePasse" class="la-input"
               placeholder="••••••••" required autocomplete="new-password" minlength="8" autofocus>
        <span class="la-help">${AIDE_MOT_DE_PASSE}</span>
      </div>
      <div class="la-form-group">
        <label class="la-label requis" for="confirmation">Confirmer le mot de passe</label>
        <input type="password" id="confirmation" name="confirmation" class="la-input"
               placeholder="••••••••" required autocomplete="new-password">
      </div>
      <div class="champ-erreur masque" id="erreur-reinitialisation"></div>
      <div class="auth-actions">
        <button type="submit" class="la-btn primary lg" id="btn-reinitialisation">
          Enregistrer et me connecter
        </button>
      </div>
    </form>
    <div class="auth-lien">
      Lien périmé ? <a href="/mot-de-passe-oublie" data-nav>Refaire une demande</a>
    </div>
  `);

  $('#form-reinitialisation')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const motDePasse = valeur(form, 'motDePasse');

    const erreur = erreurPaireMotsDePasse(motDePasse, valeur(form, 'confirmation'));
    if (erreur) {
      afficherErreur('erreur-reinitialisation', erreur);
      return;
    }
    $('#erreur-reinitialisation')?.classList.add('masque');

    await avecBoutonOccupe($('#btn-reinitialisation') as HTMLButtonElement, 'Enregistrement...', async () => {
      try {
        await auth.reinitialiserMotDePasse(token, motDePasse);
        toast.succes('Mot de passe modifié, vous êtes connecté');
        naviguerVers('/');
      } catch (error) {
        afficherErreur('erreur-reinitialisation', messageErreur(error, 'Impossible de modifier le mot de passe'));
      }
    });
  });
}
