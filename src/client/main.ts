/**
 * Veilleur - Point d'entrée principal du client
 * Router et initialisation de l'application
 */

import { $, $$ } from './utils/dom';
import { estAuthentifie, auth, setOnDeconnexion } from './services/api';
import { afficherPageAccueil } from './pages/PageAccueil';
import { afficherPageSources } from './pages/PageSources';
import { afficherPageConnexion, afficherPageInscription } from './pages/PageAuth';
import { afficherPageParametres } from './pages/PageParametres';
import { afficherPageDecouverte } from './pages/PageDecouverte';
import { toast } from './utils/toast';

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
          <div class="message-vide">
            <div class="message-vide-icone">❌</div>
            <div class="message-vide-titre">Erreur</div>
            <p>Une erreur est survenue lors du chargement de la page.</p>
            <button class="btn btn-primaire" onclick="location.reload()">Réessayer</button>
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
    <div class="message-vide">
      <div class="message-vide-icone">🔍</div>
      <div class="message-vide-titre">Page non trouvée</div>
      <p>La page que vous recherchez n'existe pas.</p>
      <a href="/" class="btn btn-primaire" data-nav>Retour à l'accueil</a>
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
      <a href="/parametres" class="btn btn-ghost" data-nav>Paramètres</a>
      <button class="btn btn-ghost" id="btn-deconnexion">
        Se déconnecter
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
      <a href="/connexion" class="btn btn-ghost" data-nav>Connexion</a>
      <a href="/inscription" class="btn btn-primaire" data-nav>Inscription</a>
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
 * Initialise l'application
 */
async function initialiser(): Promise<void> {
  // Configurer le callback de déconnexion automatique
  setOnDeconnexion(() => {
    toast.info('Session expirée, veuillez vous reconnecter');
    mettreAJourAuth();
    naviguerVers('/connexion');
  });

  // Initialiser la navigation
  initialiserNavigation();

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
