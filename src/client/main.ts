/**
 * Veilleur - Point d'entrée principal du client
 * Router et initialisation de l'application
 */

// Lunar Aurora (framework CSS, source avec ses @layer pour que nos styles non couchés
// gardent la main), puis les styles propres à Veilleur (dont la police Material Symbols)
import 'lunar-aurora/src/aurora.css';
import './styles/variables.css';
import './styles/base.css';
import './styles/composants.css';
import './styles/pages.css';

import { $, $$, creerElement } from './utils/dom';
import { icone, iconeHtml } from './utils/icones';
import { appliquerTheme, themeEnregistre, themeSuivant, iconeTheme, libelleTheme, type Theme } from './utils/theme';
import { estAuthentifie, auth, setOnDeconnexion } from './services/api';
import { afficherPageAccueil } from './pages/PageAccueil';
import { afficherPageSources } from './pages/PageSources';
import { afficherPageConnexion, afficherPageInscription } from './pages/PageAuth';
import { afficherPageParametres } from './pages/PageParametres';
import { afficherPageDecouverte } from './pages/PageDecouverte';
import { toast } from './utils/toast';

// Version injectée par Vite (define) depuis package.json
declare const __VERSION_APP__: string;

// Types
interface Route {
  pattern: RegExp;
  handler: (container: Element, params?: Record<string, string>) => void | Promise<void>;
  auth?: boolean;
}

// Routes de l'application
const routes: Route[] = [
  {
    pattern: /^\/$/,
    handler: afficherPageAccueil,
  },
  {
    pattern: /^\/sources$/,
    handler: afficherPageSources,
    auth: true,
  },
  {
    pattern: /^\/connexion$/,
    handler: afficherPageConnexion,
  },
  {
    pattern: /^\/inscription$/,
    handler: afficherPageInscription,
  },
  {
    pattern: /^\/parametres$/,
    handler: afficherPageParametres,
    auth: true,
  },
  {
    pattern: /^\/decouverte$/,
    handler: afficherPageDecouverte,
  },
];

/**
 * Navigue vers une URL
 */
export function naviguerVers(url: string, remplacer = false): void {
  if (remplacer) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
  router();
}

/**
 * Router principal
 */
async function router(): Promise<void> {
  const path = window.location.pathname;
  const container = $('#app-contenu');

  if (!container) {
    console.error('Conteneur principal non trouvé');
    return;
  }

  // L'état de connexion a pu changer depuis le rendu précédent (connexion, inscription)
  mettreAJourAuth();

  // Trouver la route correspondante
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      // Vérifier l'authentification si requise
      if (route.auth && !estAuthentifie()) {
        naviguerVers('/connexion', true);
        return;
      }

      // Extraire les paramètres
      const params: Record<string, string> = {};
      if (match.groups) {
        Object.assign(params, match.groups);
      }

      // Exécuter le handler
      try {
        await route.handler(container, params);
      } catch (error) {
        console.error('Erreur lors du chargement de la page:', error);
        container.innerHTML = `
          <div class="la-empty">
            <div class="la-empty-icon">${iconeHtml('error')}</div>
            <div class="la-empty-title">Erreur</div>
            <p>Une erreur est survenue lors du chargement de la page.</p>
            <button class="la-btn primary" onclick="location.reload()">Réessayer</button>
          </div>
        `;
      }

      // Mettre à jour la navigation active
      mettreAJourNavigation(path);
      return;
    }
  }

  // 404 - Page non trouvée
  container.innerHTML = `
    <div class="la-empty">
      <div class="la-empty-icon">${iconeHtml('search_off')}</div>
      <div class="la-empty-title">Page non trouvée</div>
      <p>La page que vous recherchez n'existe pas.</p>
      <a href="/" class="la-btn primary" data-nav>Retour à l'accueil</a>
    </div>
  `;
}

/**
 * Met à jour l'état actif de la navigation
 */
function mettreAJourNavigation(path: string): void {
  const liens = $$('.nav-principale a');
  for (const lien of liens) {
    const href = lien.getAttribute('href');
    if (href === path || (href === '/' && path === '/')) {
      lien.classList.add('actif');
    } else {
      lien.classList.remove('actif');
    }
  }
}

/**
 * Met à jour l'interface selon l'état d'authentification
 */
function mettreAJourAuth(): void {
  const navAuth = $('#nav-auth');
  const navSources = $('a[href="/sources"]');

  if (!navAuth) return;

  if (estAuthentifie()) {
    navAuth.innerHTML = `
      <a href="/parametres" class="la-btn ghost" data-nav title="Paramètres">${iconeHtml('settings')}<span class="nav-libelle">Paramètres</span></a>
      <button class="la-btn ghost" id="btn-deconnexion" type="button" title="Se déconnecter">
        ${iconeHtml('logout')}<span class="nav-libelle">Se déconnecter</span>
      </button>
    `;

    const btnDeconnexion = $('#btn-deconnexion');
    btnDeconnexion?.addEventListener('click', async () => {
      try {
        await auth.deconnexion();
        toast.succes('Déconnexion réussie');
        mettreAJourAuth();
        naviguerVers('/');
      } catch {
        toast.erreur('Erreur lors de la déconnexion');
      }
    });

    navSources?.classList.remove('masque');
  } else {
    navAuth.innerHTML = `
      <a href="/connexion" class="la-btn ghost" data-nav title="Connexion">${iconeHtml('login')}<span class="nav-libelle">Connexion</span></a>
      <a href="/inscription" class="la-btn primary" data-nav title="Inscription">${iconeHtml('person_add')}<span class="nav-libelle">Inscription</span></a>
    `;

    navSources?.classList.add('masque');
  }
}

/**
 * Initialise la navigation SPA
 */
function initialiserNavigation(): void {
  // Gestion des clics sur les liens avec data-nav
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const lien = target.closest('a[data-nav]') as HTMLAnchorElement;

    if (lien) {
      e.preventDefault();
      const href = lien.getAttribute('href');
      if (href) {
        naviguerVers(href);
      }
    }
  });

  // Gestion du bouton retour/avancer
  window.addEventListener('popstate', () => {
    router();
  });
}

/**
 * Affiche la version de l'application dans le pied de page
 */
function afficherVersion(): void {
  const element = document.getElementById('version-app');
  if (element) {
    element.textContent = `v${__VERSION_APP__}`;
  }
}

/**
 * Initialise l'application
 */
/**
 * Bouton de thème de l'en-tête : auto → clair → sombre, synchronisé avec la page Paramètres
 */
function initialiserBoutonTheme(): void {
  const bouton = $('#btn-theme') as HTMLButtonElement | null;
  if (!bouton) return;
  const rafraichir = (theme: Theme) => {
    bouton.replaceChildren(icone(iconeTheme(theme)));
    bouton.title = `${libelleTheme(theme)} — cliquer pour changer`;
    bouton.setAttribute('aria-label', libelleTheme(theme));
  };
  rafraichir(themeEnregistre());
  bouton.addEventListener('click', () => {
    const theme = themeSuivant(themeEnregistre());
    appliquerTheme(theme);
    // Le compte retient aussi le choix ; en cas d'échec le thème reste appliqué localement
    if (estAuthentifie()) auth.mettreAJourProfil({ theme }).catch(() => undefined);
  });
  document.addEventListener('veilleur:theme', (e) => rafraichir((e as CustomEvent<Theme>).detail));
}

/**
 * Bouton « retour en haut » pour le défilement infini
 */
function initialiserRetourEnHaut(): void {
  const bouton = creerElement('button', {
    classes: ['la-btn', 'secondary', 'icon-only', 'btn-haut', 'masque'],
    attrs: { type: 'button', id: 'btn-haut', 'aria-label': 'Revenir en haut de la page', title: 'Revenir en haut' },
    icone: 'arrow_upward',
    onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  });
  document.body.append(bouton);
  let planifie = false;
  window.addEventListener('scroll', () => {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(() => {
      bouton.classList.toggle('masque', window.scrollY < 600);
      planifie = false;
    });
  }, { passive: true });
}

/**
 * Raccourci clavier « / » : focus sur la recherche du fil
 */
function initialiserRaccourcis(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const cible = e.target as HTMLElement | null;
    if (cible && (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))) return;
    const recherche = $('#fil-recherche') as HTMLInputElement | null;
    if (!recherche) return;
    e.preventDefault();
    recherche.focus();
    recherche.select();
  });
}

async function initialiser(): Promise<void> {
  // Thème choisi par l'utilisateur, avant tout rendu pour éviter un flash
  appliquerTheme(themeEnregistre());
  initialiserBoutonTheme();
  initialiserRetourEnHaut();
  initialiserRaccourcis();
  // Configurer le callback de déconnexion automatique
  setOnDeconnexion(() => {
    toast.info('Session expirée, veuillez vous reconnecter');
    mettreAJourAuth();
    naviguerVers('/connexion');
  });

  // Initialiser la navigation
  initialiserNavigation();

  // Afficher la version dans le pied de page
  afficherVersion();

  // Mettre à jour l'interface d'authentification
  mettreAJourAuth();

  // Router vers la page actuelle
  await router();
}

// Démarrer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiser);
} else {
  initialiser();
}
