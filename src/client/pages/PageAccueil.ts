/**
 * Veilleur - Page Accueil
 * Fil d'actualités de l'utilisateur : recherche, tri, filtres (note, favoris, mots-clés)
 * et chargement au défilement
 */

import { iconeHtml } from '../utils/icones';
import { creerElement, $, vider } from '../utils/dom';
import { formatNombre } from '../utils/format';
import { articles, estAuthentifie } from '../services/api';
import { creerCarteArticle } from '../composants/CarteArticle';
import { creerListeSkeletons } from '../composants/SkeletonArticle';
import { toast } from '../utils/toast';
import type { Article, MotCleFil, OptionsFil, Statistiques, TriFil } from '../services/api';

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
  nonLus: boolean;
  motCle?: string;
}

const FILTRES_DEFAUT: FiltresFil = { recherche: '', tri: 'date', ordre: 'desc', favoris: false, nonLus: false };

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
  await Promise.all([chargerStatistiques(), chargerMotsClesFiltre(), chargerArticles(1)]);
}

/**
 * Barre de recherche plein texte dans tous les articles du fil
 */
function creerBarreRecherche(): HTMLElement {
  const formulaire = creerElement('form', { classes: ['fil-recherche'], attrs: { role: 'search' } });
  const champ = creerElement('input', {
    classes: ['la-input'],
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
    classes: ['la-btn', 'primary'],
    attrs: { type: 'submit', 'aria-label': 'Rechercher' },
    icone: 'search',
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
  const selectTri = creerElement('select', { classes: ['la-select'], attrs: { id: 'fil-tri' } }) as HTMLSelectElement;
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
  const selectNote = creerElement('select', { classes: ['la-select'], attrs: { id: 'fil-note-min' } }) as HTMLSelectElement;
  selectNote.append(creerElement('option', { attrs: { value: '' }, texte: 'Toutes' }));
  for (let n = 1; n <= 5; n++) {
    selectNote.append(creerElement('option', { attrs: { value: String(n) }, texte: `${n} étoile${n > 1 ? 's' : ''} et plus` }));
  }
  selectNote.value = filtres.noteMin ? String(filtres.noteMin) : '';
  selectNote.addEventListener('change', () => {
    filtres.noteMin = selectNote.value ? Number(selectNote.value) : undefined;
    appliquerFiltres();
  });

  // Favoris
  const btnFavoris = creerElement('button', {
    classes: ['la-chip chip-filtre', filtres.favoris ? 'active' : ''],
    attrs: { type: 'button', id: 'fil-favoris', 'aria-pressed': String(filtres.favoris) },
    icone: 'favorite',
    texte: 'Favoris',
    onClick: () => {
      filtres.favoris = !filtres.favoris;
      btnFavoris.classList.toggle('active', filtres.favoris);
      btnFavoris.setAttribute('aria-pressed', String(filtres.favoris));
      appliquerFiltres();
    },
  });

  // Mots-clés du fil (remplis après chargement)
  const motsClesFiltre = creerElement('div', {
    classes: ['fil-outils-tags'],
    attrs: { id: 'fil-mots-cles', 'aria-label': 'Filtrer par mot-clé' },
  });

  // Non lus
  const btnNonLus = creerElement('button', {
    classes: ['la-chip chip-filtre', filtres.nonLus ? 'active' : ''],
    attrs: { type: 'button', id: 'fil-non-lus', 'aria-pressed': String(filtres.nonLus) },
    icone: 'mark_email_unread',
    texte: 'Non lus',
    onClick: () => {
      filtres.nonLus = !filtres.nonLus;
      btnNonLus.classList.toggle('active', filtres.nonLus);
      btnNonLus.setAttribute('aria-pressed', String(filtres.nonLus));
      appliquerFiltres();
    },
  });

  // Tout marquer comme lu (borné à l'instant du clic)
  const btnToutLu = creerElement('button', {
    classes: ['la-btn', 'ghost', 'sm', 'btn-tout-lu'],
    attrs: { type: 'button', id: 'fil-tout-lu', title: 'Marquer comme lus tous les articles du fil' },
    icone: 'done_all',
    texte: 'Tout marquer lu',
    onClick: async () => {
      (btnToutLu as HTMLButtonElement).disabled = true;
      try {
        const { marques } = await articles.marquerTousLus({ avant: new Date() });
        toast.succes(marques > 0 ? `${marques} article${marques > 1 ? 's' : ''} marqué${marques > 1 ? 's' : ''} lu${marques > 1 ? 's' : ''}` : 'Tout était déjà lu');
        void chargerArticles(1);
        void chargerStatistiques();
      } catch {
        toast.erreur('Impossible de marquer le fil comme lu');
      } finally {
        (btnToutLu as HTMLButtonElement).disabled = false;
      }
    },
  });

  barre.append(labelTri, selectTri, labelNote, selectNote, btnFavoris, btnNonLus, btnToutLu, motsClesFiltre);
  return barre;
}

/**
 * Charge les mots-clés les plus fréquents du fil et les affiche comme filtres
 */
async function chargerMotsClesFiltre(): Promise<void> {
  const conteneur = $('#fil-mots-cles');
  if (!conteneur) return;

  try {
    const { donnees } = await articles.listerMotsCles(15);
    afficherMotsClesFiltre(conteneur, donnees);
  } catch {
    // Les mots-clés ne sont pas critiques
  }
}

function afficherMotsClesFiltre(conteneur: Element, motsCles: MotCleFil[]): void {
  vider(conteneur);
  // Le mot-clé filtré vient peut-être d'une carte et n'est pas dans les plus fréquents : on l'affiche quand même
  const liste = filtres.motCle && !motsCles.some(m => m.mot === filtres.motCle)
    ? [{ mot: filtres.motCle, nombreArticles: 0 }, ...motsCles]
    : motsCles;
  for (const { mot, nombreArticles } of liste) {
    const chip = creerElement('button', {
      classes: ['la-chip chip-filtre', filtres.motCle === mot ? 'active' : ''],
      attrs: { type: 'button', 'data-mot': mot, 'aria-pressed': String(filtres.motCle === mot) },
      texte: nombreArticles ? `${mot} (${nombreArticles})` : mot,
      onClick: () => filtrerParMotCle(filtres.motCle === mot ? undefined : mot),
    });
    conteneur.append(chip);
  }
}

/**
 * Active (ou retire) le filtre par mot-clé, depuis un bouton de la barre ou depuis une carte
 */
function filtrerParMotCle(mot: string | undefined): void {
  filtres.motCle = mot;
  const conteneur = $('#fil-mots-cles');
  if (conteneur) {
    const present = [...conteneur.querySelectorAll('.chip-filtre')].some(c => c.getAttribute('data-mot') === mot);
    if (mot && !present) {
      void chargerMotsClesFiltre();
    } else {
      conteneur.querySelectorAll('.chip-filtre').forEach(c => {
        const actif = c.getAttribute('data-mot') === mot;
        c.classList.toggle('active', actif);
        c.setAttribute('aria-pressed', String(actif));
      });
    }
  }
  appliquerFiltres();
  if (mot) window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const persistants = { tri: filtres.tri, ordre: filtres.ordre, noteMin: filtres.noteMin, favoris: filtres.favoris, nonLus: filtres.nonLus, motCle: filtres.motCle };
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
        <div class="auth-logo-icone">${iconeHtml('newspaper', { plein: true })}</div>
        <div class="auth-logo-texte">Veilleur</div>
      </div>
      <h2 class="auth-titre">Votre sentinelle de l'information</h2>
      <p style="text-align: center; color: var(--couleur-texte-secondaire); margin-bottom: var(--espace-6);">
        Agrégez vos sources d'actualités préférées en un seul endroit.
      </p>
      <div class="auth-actions">
        <a href="/connexion" class="la-btn primary lg" data-nav>Se connecter</a>
        <a href="/inscription" class="la-btn secondary lg" data-nav>Créer un compte</a>
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
    const [stats, nonLus] = await Promise.all([articles.statistiques(), articles.nonLus()]);
    afficherStatistiques(container, stats, nonLus.total);
  } catch {
    // Silencieux - les stats ne sont pas critiques
  }
}

/**
 * Affiche les statistiques
 */
function afficherStatistiques(container: Element, stats: Statistiques, nonLus: number): void {
  vider(container);

  const statItems = [
    { valeur: nonLus, label: 'Non lus' },
    { valeur: stats.articlesAujourdhui, label: "Aujourd'hui" },
    { valeur: stats.articlesCetteSemaine, label: 'Cette semaine' },
    { valeur: stats.totalArticles, label: 'Total' },
  ];

  for (const item of statItems) {
    const stat = creerElement('div', {
      classes: ['la-stat plain'],
    });

    const valeur = creerElement('div', {
      classes: ['la-stat-value'],
      texte: formatNombre(item.valeur),
    });

    const label = creerElement('div', {
      classes: ['la-stat-label'],
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
    nonLus: filtres.nonLus,
    motCle: filtres.motCle,
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
        <div class="la-empty">
          <div class="la-empty-icon">${iconeHtml('error')}</div>
          <div class="la-empty-title">Erreur de chargement</div>
          <p>Impossible de charger les articles. Réessayez plus tard.</p>
          <button class="la-btn primary" onclick="location.reload()">Réessayer</button>
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
      onLu: () => void chargerStatistiques(),
      onMotCle: mot => filtrerParMotCle(mot),
    });
    container.append(carte);
  }
}

/**
 * Affiche un message quand il n'y a pas d'articles
 */
function afficherMessageVide(container: Element): void {
  const filtresActifs = filtres.recherche || filtres.noteMin || filtres.favoris || filtres.nonLus || filtres.motCle;
  if (filtresActifs) {
    container.innerHTML = `
      <div class="la-empty">
        <div class="la-empty-icon">${iconeHtml('search_off')}</div>
        <div class="la-empty-title">Aucun article ne correspond</div>
        <p>Modifiez la recherche ou les filtres pour voir plus d'articles.</p>
        <button class="la-btn secondary" id="btn-reinitialiser-filtres" type="button">Réinitialiser les filtres</button>
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
    <div class="la-empty">
      <div class="la-empty-icon">${iconeHtml('inbox')}</div>
      <div class="la-empty-title">Aucun article</div>
      <p>Commencez par ajouter des sources pour voir des articles ici.</p>
      <a href="/sources" class="la-btn primary" data-nav>Ajouter des sources</a>
    </div>
  `;
}
