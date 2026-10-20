/**
 * Veilleur - Page Accueil
 * Fil d'actualités de l'utilisateur : recherche, tri, filtres (note, favoris, tags)
 * et chargement au défilement
 */

import { creerElement, $, vider } from '../utils/dom';
import { formatNombre } from '../utils/format';
import { articles, estAuthentifie } from '../services/api';
import { creerCarteArticle } from '../composants/CarteArticle';
import { creerListeSkeletons } from '../composants/SkeletonArticle';
import { toast } from '../utils/toast';
import type { Article, OptionsFil, Statistiques, TagArticle, TriFil } from '../services/api';

const TAILLE_PAGE = 20;
const CLE_FILTRES = 'veilleur.fil.filtres';

/**
 * Choix de tri proposés (valeur = tri:ordre)
 */
const CHOIX_TRI: Array<{ valeur: string; libelle: string }> = [
  { valeur: 'date:desc', libelle: 'Plus récents' },
  { valeur: 'date:asc', libelle: 'Plus anciens' },
  { valeur: 'note:desc', libelle: 'Mieux notés' },
  { valeur: 'titre:asc', libelle: 'Titre A → Z' },
  { valeur: 'source:asc', libelle: 'Source A → Z' },
];

/**
 * Filtres courants du fil
 */
interface FiltresFil {
  recherche: string;
  tri: TriFil;
  ordre: 'asc' | 'desc';
  noteMin?: number;
  favoris: boolean;
  tagArticle?: string;
}

const FILTRES_DEFAUT: FiltresFil = { recherche: '', tri: 'date', ordre: 'desc', favoris: false };

let filtres: FiltresFil = { ...FILTRES_DEFAUT };
let pageCourante = 1;
let totalPages = 1;
let enChargement = false;
let requeteEnCours = 0;
let observateur: IntersectionObserver | null = null;
let minuterieRecherche: ReturnType<typeof setTimeout> | null = null;

/**
 * Affiche la page d'accueil
 */
export async function afficherPageAccueil(container: Element): Promise<void> {
  vider(container);
  observateur?.disconnect();

  if (!estAuthentifie()) {
    afficherPageNonConnecte(container);
    return;
  }

  filtres = chargerFiltres();

  const page = creerElement('div', { classes: ['page-accueil'] });

  // En-tête avec stats
  const entete = creerElement('div', { classes: ['page-accueil-entete'] });
  const titre = creerElement('h1', { texte: "Fil d'actualités" });
  const stats = creerElement('div', { classes: ['page-accueil-stats'], attrs: { id: 'stats-container' } });
  entete.append(titre, stats);

  // Conteneur du fil
  const fil = creerElement('div', { classes: ['fil-actualites'] });
  const liste = creerElement('div', { classes: ['fil-liste'], attrs: { id: 'fil-liste' } });
  liste.appendChild(creerListeSkeletons(6));

  // Sentinelle de chargement au défilement
  const sentinelle = creerElement('div', {
    classes: ['fil-sentinelle'],
    attrs: { id: 'fil-sentinelle', 'aria-live': 'polite' },
  });

  fil.append(creerBarreRecherche(), creerBarreOutils(), liste, sentinelle);
  page.append(entete, fil);
  container.append(page);

  observerDefilement(sentinelle);

  // Charger les données
  await Promise.all([chargerStatistiques(), chargerTagsFiltre(), chargerArticles(1)]);
}

/**
 * Barre de recherche plein texte dans tous les articles du fil
 */
function creerBarreRecherche(): HTMLElement {
  const formulaire = creerElement('form', { classes: ['fil-recherche'], attrs: { role: 'search' } });
  const champ = creerElement('input', {
    classes: ['champ-input'],
    attrs: {
      type: 'search',
      id: 'fil-recherche',
      placeholder: 'Rechercher dans tous les articles…',
      'aria-label': 'Rechercher dans les articles',
      autocomplete: 'off',
      value: filtres.recherche,
    },
  }) as HTMLInputElement;

  const lancer = () => {
    const valeur = champ.value.trim();
    if (valeur === filtres.recherche) return;
    filtres.recherche = valeur;
    appliquerFiltres();
  };

  champ.addEventListener('input', () => {
    if (minuterieRecherche) clearTimeout(minuterieRecherche);
    minuterieRecherche = setTimeout(lancer, 400);
  });
  formulaire.addEventListener('submit', e => {
    e.preventDefault();
    if (minuterieRecherche) clearTimeout(minuterieRecherche);
    lancer();
  });

  const bouton = creerElement('button', {
    classes: ['btn', 'btn-primaire'],
    attrs: { type: 'submit', 'aria-label': 'Rechercher' },
    texte: '🔍',
  });
  formulaire.append(champ, bouton);
  return formulaire;
}

/**
 * Barre de tri et de filtres
 */
function creerBarreOutils(): HTMLElement {
  const barre = creerElement('div', { classes: ['fil-outils'] });

  // Tri
  const labelTri = creerElement('label', { classes: ['fil-outils-label'], attrs: { for: 'fil-tri' }, texte: 'Trier' });
  const selectTri = creerElement('select', { classes: ['champ-select'], attrs: { id: 'fil-tri' } }) as HTMLSelectElement;
  for (const choix of CHOIX_TRI) {
    const option = creerElement('option', { attrs: { value: choix.valeur }, texte: choix.libelle });
    selectTri.append(option);
  }
  selectTri.value = `${filtres.tri}:${filtres.ordre}`;
  selectTri.addEventListener('change', () => {
    const [tri, ordre] = selectTri.value.split(':') as [TriFil, 'asc' | 'desc'];
    filtres.tri = tri;
    filtres.ordre = ordre;
    appliquerFiltres();
  });

  // Note minimale
  const labelNote = creerElement('label', { classes: ['fil-outils-label'], attrs: { for: 'fil-note-min' }, texte: 'Note' });
  const selectNote = creerElement('select', { classes: ['champ-select'], attrs: { id: 'fil-note-min' } }) as HTMLSelectElement;
  selectNote.append(creerElement('option', { attrs: { value: '' }, texte: 'Toutes' }));
  for (let n = 1; n <= 5; n++) {
    selectNote.append(creerElement('option', { attrs: { value: String(n) }, texte: `${'★'.repeat(n)} et plus` }));
  }
  selectNote.value = filtres.noteMin ? String(filtres.noteMin) : '';
  selectNote.addEventListener('change', () => {
    filtres.noteMin = selectNote.value ? Number(selectNote.value) : undefined;
    appliquerFiltres();
  });

  // Favoris
  const btnFavoris = creerElement('button', {
    classes: ['chip-filtre', filtres.favoris ? 'active' : ''],
    attrs: { type: 'button', id: 'fil-favoris', 'aria-pressed': String(filtres.favoris) },
    texte: '♥ Favoris',
    onClick: () => {
      filtres.favoris = !filtres.favoris;
      btnFavoris.classList.toggle('active', filtres.favoris);
      btnFavoris.setAttribute('aria-pressed', String(filtres.favoris));
      appliquerFiltres();
    },
  });

  // Tags d'articles (remplis après chargement)
  const tagsFiltre = creerElement('div', { classes: ['fil-outils-tags'], attrs: { id: 'fil-tags' } });

  barre.append(labelTri, selectTri, labelNote, selectNote, btnFavoris, tagsFiltre);
  return barre;
}

/**
 * Charge les tags posés sur les articles et les affiche comme filtres
 */
async function chargerTagsFiltre(): Promise<void> {
  const conteneur = $('#fil-tags');
  if (!conteneur) return;

  try {
    const { donnees } = await articles.listerTags();
    afficherTagsFiltre(conteneur, donnees);
  } catch {
    // Les tags ne sont pas critiques
  }
}

function afficherTagsFiltre(conteneur: Element, tags: TagArticle[]): void {
  vider(conteneur);
  if (filtres.tagArticle && !tags.some(t => t.slug === filtres.tagArticle)) {
    filtres.tagArticle = undefined;
    sauvegarderFiltres();
  }
  for (const tag of tags) {
    const chip = creerElement('button', {
      classes: ['chip-filtre', filtres.tagArticle === tag.slug ? 'active' : ''],
      attrs: { type: 'button', 'data-tag': tag.slug, 'aria-pressed': String(filtres.tagArticle === tag.slug) },
      texte: `${tag.nom} (${tag.nombreArticles})`,
      onClick: () => {
        filtres.tagArticle = filtres.tagArticle === tag.slug ? undefined : tag.slug;
        conteneur.querySelectorAll('.chip-filtre').forEach(c => {
          const actif = c.getAttribute('data-tag') === filtres.tagArticle;
          c.classList.toggle('active', actif);
          c.setAttribute('aria-pressed', String(actif));
        });
        appliquerFiltres();
      },
    });
    conteneur.append(chip);
  }
}

/**
 * Relance le fil depuis le début avec les filtres courants
 */
function appliquerFiltres(): void {
  sauvegarderFiltres();
  void chargerArticles(1);
}

function chargerFiltres(): FiltresFil {
  try {
    const brut = localStorage.getItem(CLE_FILTRES);
    if (!brut) return { ...FILTRES_DEFAUT };
    const lu = JSON.parse(brut) as Partial<FiltresFil>;
    return { ...FILTRES_DEFAUT, ...lu, recherche: '' };
  } catch {
    return { ...FILTRES_DEFAUT };
  }
}

function sauvegarderFiltres(): void {
  try {
    // La recherche n'est pas mémorisée : on revient toujours sur le fil complet
    const persistants = { tri: filtres.tri, ordre: filtres.ordre, noteMin: filtres.noteMin, favoris: filtres.favoris, tagArticle: filtres.tagArticle };
    localStorage.setItem(CLE_FILTRES, JSON.stringify(persistants));
  } catch {
    // Stockage indisponible : les filtres ne survivent pas au rechargement, sans gravité
  }
}

/**
 * Charge la page suivante quand la sentinelle devient visible
 */
function observerDefilement(sentinelle: Element): void {
  observateur?.disconnect();
  observateur = new IntersectionObserver(entrees => {
    if (entrees.some(e => e.isIntersecting) && !enChargement && pageCourante < totalPages) {
      void chargerArticles(pageCourante + 1);
    }
  }, { rootMargin: '400px 0px' });
  observateur.observe(sentinelle);
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
 * Charge une page d'articles (page 1 = remplacement, suivantes = ajout en fin de liste)
 */
async function chargerArticles(page: number): Promise<void> {
  const liste = $('#fil-liste');
  const sentinelle = $('#fil-sentinelle');
  if (!liste) return;

  const numeroRequete = ++requeteEnCours;
  enChargement = true;
  if (page === 1) {
    vider(liste);
    liste.appendChild(creerListeSkeletons(6));
  }
  if (sentinelle) sentinelle.textContent = page === 1 ? '' : 'Chargement…';

  const options: OptionsFil = {
    page,
    limite: TAILLE_PAGE,
    recherche: filtres.recherche || undefined,
    tri: filtres.tri,
    ordre: filtres.ordre,
    noteMin: filtres.noteMin,
    favoris: filtres.favoris,
    tagArticle: filtres.tagArticle,
  };

  try {
    const result = await articles.listerFil(options);
    // Une requête plus récente a été lancée entre-temps (frappe au clavier) : on ignore celle-ci
    if (numeroRequete !== requeteEnCours) return;

    pageCourante = page;
    totalPages = result.pagination?.totalPages ?? 1;

    if (page === 1) {
      vider(liste);
    }

    if (result.donnees.length === 0 && page === 1) {
      afficherMessageVide(liste);
    } else {
      afficherArticles(liste, result.donnees);
    }

    if (sentinelle) {
      sentinelle.textContent = pageCourante < totalPages ? '' : (result.pagination?.total ? 'Vous avez tout vu.' : '');
    }
  } catch {
    if (numeroRequete !== requeteEnCours) return;
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
    if (numeroRequete === requeteEnCours) enChargement = false;
  }
}

/**
 * Affiche les articles dans la liste
 */
function afficherArticles(container: Element, articlesData: Article[]): void {
  for (const article of articlesData) {
    const carte = creerCarteArticle(article, {
      // Un tag ajouté ou retiré change la liste des filtres disponibles
      onAnnotation: () => void chargerTagsFiltre(),
    });
    container.append(carte);
  }
}

/**
 * Affiche un message quand il n'y a pas d'articles
 */
function afficherMessageVide(container: Element): void {
  const filtresActifs = filtres.recherche || filtres.noteMin || filtres.favoris || filtres.tagArticle;
  if (filtresActifs) {
    container.innerHTML = `
      <div class="message-vide">
        <div class="message-vide-icone">🔍</div>
        <div class="message-vide-titre">Aucun article ne correspond</div>
        <p>Modifiez la recherche ou les filtres pour voir plus d'articles.</p>
        <button class="btn btn-secondaire" id="btn-reinitialiser-filtres" type="button">Réinitialiser les filtres</button>
      </div>
    `;
    $('#btn-reinitialiser-filtres')?.addEventListener('click', () => {
      filtres = { ...FILTRES_DEFAUT };
      sauvegarderFiltres();
      const contenu = document.querySelector('#app-contenu');
      if (contenu) void afficherPageAccueil(contenu);
    });
    return;
  }
  container.innerHTML = `
    <div class="message-vide">
      <div class="message-vide-icone">📭</div>
      <div class="message-vide-titre">Aucun article</div>
      <p>Commencez par ajouter des sources pour voir des articles ici.</p>
      <a href="/sources" class="btn btn-primaire" data-nav>Ajouter des sources</a>
    </div>
  `;
}
