/**
 * Veilleur - Page Accueil
 * Fil d'actualités de l'utilisateur
 */

import { creerElement, $, vider } from '../utils/dom';
import { formatNombre } from '../utils/format';
import { articles, estAuthentifie } from '../services/api';
import { creerCarteArticle } from '../composants/CarteArticle';
import { toast } from '../utils/toast';
import type { Article, Statistiques } from '../services/api';

let pageCourante = 1;
let totalPages = 1;
let enChargement = false;

/**
 * Affiche la page d'accueil
 */
export async function afficherPageAccueil(container: Element): Promise<void> {
  vider(container);

  if (!estAuthentifie()) {
    afficherPageNonConnecte(container);
    return;
  }

  const page = creerElement('div', {
    classes: ['page-accueil'],
  });

  // En-tête avec stats
  const entete = creerElement('div', {
    classes: ['page-accueil-entete'],
  });

  const titre = creerElement('h1', {
    texte: "Fil d'actualités",
  });

  const stats = creerElement('div', {
    classes: ['page-accueil-stats'],
    attrs: { id: 'stats-container' },
  });

  entete.append(titre, stats);

  // Conteneur du fil
  const fil = creerElement('div', {
    classes: ['fil-actualites'],
  });

  const liste = creerElement('div', {
    classes: ['fil-liste'],
    attrs: { id: 'fil-liste' },
  });

  // Pagination
  const pagination = creerElement('div', {
    classes: ['fil-pagination'],
    attrs: { id: 'fil-pagination' },
  });

  fil.append(liste, pagination);
  page.append(entete, fil);
  container.append(page);

  // Charger les données
  await Promise.all([chargerStatistiques(), chargerArticles()]);
}

/**
 * Affiche la page pour les utilisateurs non connectés
 */
function afficherPageNonConnecte(container: Element): void {
  const page = creerElement('div', {
    classes: ['page-auth'],
  });

  page.innerHTML = `
    <div class="auth-carte">
      <div class="auth-logo">
        <div class="auth-logo-icone">📰</div>
        <div class="auth-logo-texte">Veilleur</div>
      </div>
      <h2 class="auth-titre">Votre sentinelle de l'information</h2>
      <p style="text-align: center; color: var(--couleur-texte-secondaire); margin-bottom: var(--espace-6);">
        Agrégez vos sources d'actualités préférées en un seul endroit.
      </p>
      <div class="auth-actions">
        <a href="/connexion" class="btn btn-primaire btn-lg" data-nav>Se connecter</a>
        <a href="/inscription" class="btn btn-secondaire btn-lg" data-nav>Créer un compte</a>
      </div>
    </div>
  `;

  container.append(page);
}

/**
 * Charge les statistiques
 */
async function chargerStatistiques(): Promise<void> {
  const container = $('#stats-container');
  if (!container) return;

  try {
    const stats = await articles.statistiques();
    afficherStatistiques(container, stats);
  } catch {
    // Silencieux - les stats ne sont pas critiques
  }
}

/**
 * Affiche les statistiques
 */
function afficherStatistiques(container: Element, stats: Statistiques): void {
  vider(container);

  const statItems = [
    { valeur: stats.articlesAujourdhui, label: "Aujourd'hui" },
    { valeur: stats.articlesCetteSemaine, label: 'Cette semaine' },
    { valeur: stats.totalArticles, label: 'Total' },
  ];

  for (const item of statItems) {
    const stat = creerElement('div', {
      classes: ['stat'],
    });

    const valeur = creerElement('div', {
      classes: ['stat-valeur'],
      texte: formatNombre(item.valeur),
    });

    const label = creerElement('div', {
      classes: ['stat-label'],
      texte: item.label,
    });

    stat.append(valeur, label);
    container.append(stat);
  }
}

/**
 * Charge les articles
 */
async function chargerArticles(page = 1): Promise<void> {
  if (enChargement) return;

  const liste = $('#fil-liste');
  if (!liste) return;

  enChargement = true;
  pageCourante = page;

  if (page === 1) {
    vider(liste);
    liste.innerHTML = `
      <div class="chargement">
        <div class="spinner"></div>
        <p>Chargement des articles...</p>
      </div>
    `;
  }

  try {
    const result = await articles.listerFil(page, 20);
    totalPages = result.pagination.totalPages;

    if (page === 1) {
      vider(liste);
    }

    if (result.donnees.length === 0 && page === 1) {
      afficherMessageVide(liste);
    } else {
      afficherArticles(liste, result.donnees);
      mettreAJourPagination();
    }
  } catch (error) {
    toast.erreur('Erreur lors du chargement des articles');
    if (page === 1) {
      vider(liste);
      liste.innerHTML = `
        <div class="message-vide">
          <div class="message-vide-icone">❌</div>
          <div class="message-vide-titre">Erreur de chargement</div>
          <p>Impossible de charger les articles. Réessayez plus tard.</p>
          <button class="btn btn-primaire" onclick="location.reload()">Réessayer</button>
        </div>
      `;
    }
  } finally {
    enChargement = false;
  }
}

/**
 * Affiche les articles dans la liste
 */
function afficherArticles(container: Element, articlesData: Article[]): void {
  for (const article of articlesData) {
    const carte = creerCarteArticle(article);
    container.append(carte);
  }
}

/**
 * Affiche un message quand il n'y a pas d'articles
 */
function afficherMessageVide(container: Element): void {
  container.innerHTML = `
    <div class="message-vide">
      <div class="message-vide-icone">📭</div>
      <div class="message-vide-titre">Aucun article</div>
      <p>Commencez par ajouter des sources pour voir des articles ici.</p>
      <a href="/sources" class="btn btn-primaire" data-nav>Ajouter des sources</a>
    </div>
  `;
}

/**
 * Met à jour la pagination
 */
function mettreAJourPagination(): void {
  const container = $('#fil-pagination');
  if (!container) return;

  vider(container);

  if (totalPages <= 1) return;

  // Bouton précédent
  if (pageCourante > 1) {
    const btnPrev = creerElement('button', {
      classes: ['btn', 'btn-secondaire'],
      texte: '← Précédent',
      onClick: () => chargerArticles(pageCourante - 1),
    });
    container.append(btnPrev);
  }

  // Info page
  const info = creerElement('span', {
    classes: ['pagination-info'],
    texte: `Page ${pageCourante} sur ${totalPages}`,
  });
  container.append(info);

  // Bouton suivant
  if (pageCourante < totalPages) {
    const btnNext = creerElement('button', {
      classes: ['btn', 'btn-secondaire'],
      texte: 'Suivant →',
      onClick: () => chargerArticles(pageCourante + 1),
    });
    container.append(btnNext);
  }
}
