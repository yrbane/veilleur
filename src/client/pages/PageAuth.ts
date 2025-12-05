/**
 * Veilleur - Pages d'authentification
 * Connexion et inscription
 */

import { creerElement, $, vider } from '../utils/dom';
import { auth, ErreurAPI } from '../services/api';
import { toast } from '../utils/toast';
import { naviguerVers } from '../main';

/**
 * Affiche la page de connexion
 */
export function afficherPageConnexion(container: Element): void {
  vider(container);

  const page = creerElement('div', {
    classes: ['page-auth'],
  });

  const carte = creerElement('div', {
    classes: ['auth-carte'],
  });

  carte.innerHTML = `
    <div class="auth-logo">
      <div class="auth-logo-icone">📰</div>
      <div class="auth-logo-texte">Veilleur</div>
    </div>
    <h2 class="auth-titre">Connexion</h2>
    <form class="auth-formulaire" id="form-connexion">
      <div class="champ">
        <label class="champ-label requis" for="email">Email</label>
        <input type="email" id="email" name="email" class="champ-input"
               placeholder="votre@email.com" required autocomplete="email">
      </div>
      <div class="champ">
        <label class="champ-label requis" for="motDePasse">Mot de passe</label>
        <input type="password" id="motDePasse" name="motDePasse" class="champ-input"
               placeholder="••••••••" required autocomplete="current-password">
      </div>
      <div class="champ-erreur masque" id="erreur-connexion"></div>
      <div class="auth-actions">
        <button type="submit" class="btn btn-primaire btn-lg" id="btn-connexion">
          Se connecter
        </button>
      </div>
    </form>
    <div class="auth-lien">
      Pas encore de compte ? <a href="/inscription" data-nav>Créer un compte</a>
    </div>
  `;

  page.append(carte);
  container.append(page);

  // Gestion du formulaire
  const form = $('#form-connexion') as HTMLFormElement;
  form?.addEventListener('submit', gererConnexion);
}

/**
 * Gère la soumission du formulaire de connexion
 */
async function gererConnexion(e: Event): Promise<void> {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const email = (form.elements.namedItem('email') as HTMLInputElement).value;
  const motDePasse = (form.elements.namedItem('motDePasse') as HTMLInputElement).value;
  const erreurDiv = $('#erreur-connexion');
  const btn = $('#btn-connexion') as HTMLButtonElement;

  erreurDiv?.classList.add('masque');
  btn.disabled = true;
  btn.textContent = 'Connexion...';

  try {
    await auth.connexion(email, motDePasse);
    toast.succes('Connexion réussie');
    naviguerVers('/');
  } catch (error) {
    if (erreurDiv) {
      erreurDiv.textContent =
        error instanceof ErreurAPI
          ? error.message
          : 'Email ou mot de passe incorrect';
      erreurDiv.classList.remove('masque');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
}

/**
 * Affiche la page d'inscription
 */
export function afficherPageInscription(container: Element): void {
  vider(container);

  const page = creerElement('div', {
    classes: ['page-auth'],
  });

  const carte = creerElement('div', {
    classes: ['auth-carte'],
  });

  carte.innerHTML = `
    <div class="auth-logo">
      <div class="auth-logo-icone">📰</div>
      <div class="auth-logo-texte">Veilleur</div>
    </div>
    <h2 class="auth-titre">Créer un compte</h2>
    <form class="auth-formulaire" id="form-inscription">
      <div class="champ">
        <label class="champ-label requis" for="email">Email</label>
        <input type="email" id="email" name="email" class="champ-input"
               placeholder="votre@email.com" required autocomplete="email">
      </div>
      <div class="champ">
        <label class="champ-label requis" for="motDePasse">Mot de passe</label>
        <input type="password" id="motDePasse" name="motDePasse" class="champ-input"
               placeholder="••••••••" required autocomplete="new-password" minlength="8">
        <span class="champ-aide">8 caractères minimum</span>
      </div>
      <div class="champ">
        <label class="champ-label requis" for="confirmation">Confirmer le mot de passe</label>
        <input type="password" id="confirmation" name="confirmation" class="champ-input"
               placeholder="••••••••" required autocomplete="new-password">
      </div>
      <div class="champ-erreur masque" id="erreur-inscription"></div>
      <div class="auth-actions">
        <button type="submit" class="btn btn-primaire btn-lg" id="btn-inscription">
          Créer mon compte
        </button>
      </div>
    </form>
    <div class="auth-lien">
      Déjà inscrit ? <a href="/connexion" data-nav>Se connecter</a>
    </div>
  `;

  page.append(carte);
  container.append(page);

  // Gestion du formulaire
  const form = $('#form-inscription') as HTMLFormElement;
  form?.addEventListener('submit', gererInscription);
}

/**
 * Gère la soumission du formulaire d'inscription
 */
async function gererInscription(e: Event): Promise<void> {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const email = (form.elements.namedItem('email') as HTMLInputElement).value;
  const motDePasse = (form.elements.namedItem('motDePasse') as HTMLInputElement).value;
  const confirmation = (form.elements.namedItem('confirmation') as HTMLInputElement).value;
  const erreurDiv = $('#erreur-inscription');
  const btn = $('#btn-inscription') as HTMLButtonElement;

  // Validation
  if (motDePasse !== confirmation) {
    if (erreurDiv) {
      erreurDiv.textContent = 'Les mots de passe ne correspondent pas';
      erreurDiv.classList.remove('masque');
    }
    return;
  }

  if (motDePasse.length < 8) {
    if (erreurDiv) {
      erreurDiv.textContent = 'Le mot de passe doit contenir au moins 8 caractères';
      erreurDiv.classList.remove('masque');
    }
    return;
  }

  erreurDiv?.classList.add('masque');
  btn.disabled = true;
  btn.textContent = 'Création...';

  try {
    await auth.inscription(email, motDePasse);
    toast.succes('Compte créé avec succès');
    naviguerVers('/');
  } catch (error) {
    if (erreurDiv) {
      erreurDiv.textContent =
        error instanceof ErreurAPI
          ? error.message
          : "Erreur lors de la création du compte";
      erreurDiv.classList.remove('masque');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  }
}
