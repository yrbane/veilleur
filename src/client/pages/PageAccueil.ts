/**
 * Veilleur - Page Accueil
 * Fil d'actualités de l'utilisateur : recherche, tri, filtres (note, favoris, mots-clés)
 * et chargement au défilement
 */

import { icone, iconeHtml } from '../utils/icones';
import { creerElement, $, vider } from '../utils/dom';
import { formatNombre } from '../utils/format';
import { articles, sources, tags, tendances as apiTendances, estAuthentifie } from '../services/api';
import { creerPopover } from '../composants/Popover';
import { creerRailPuces, type RailPuces } from '../composants/RailPuces';
import { termesRecherche } from '../utils/surlignage';
import { creerCarteArticle } from '../composants/CarteArticle';
import { creerListeSkeletons } from '../composants/SkeletonArticle';
import { toast } from '../utils/toast';
import type { Article, MotCleFil, OptionsFil, Statistiques, Tag, Tendance, TriFil } from '../services/api';
import { colorerTag } from '../utils/couleursTags';
import { modeEnregistre, appliquerMode, creerSelecteurAffichage } from '../utils/affichageArticles';

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
  aLire: boolean;
  motCle?: string;
  /** Une seule source */
  sourceId?: string;
  /** Fenêtre de publication */
  periode?: Periode;
  /** Rubrique (slug d'un tag de source) */
  tag?: string;
}

type Periode = '24h' | '7j' | '30j';

const CHOIX_PERIODE: { valeur: Periode; libelle: string; heures: number }[] = [
  { valeur: '24h', libelle: 'Dernières 24 h', heures: 24 },
  { valeur: '7j', libelle: '7 derniers jours', heures: 24 * 7 },
  { valeur: '30j', libelle: '30 derniers jours', heures: 24 * 30 },
];

/**
 * Borne « depuis » (ISO) d'une période, ou undefined pour tout le fil
 */
export function depuisPeriode(periode: Periode | undefined, maintenant: Date = new Date()): string | undefined {
  const choix = CHOIX_PERIODE.find(c => c.valeur === periode);
  if (!choix) return undefined;
  return new Date(maintenant.getTime() - choix.heures * 3600 * 1000).toISOString();
}

const FILTRES_DEFAUT: FiltresFil = { recherche: '', tri: 'date', ordre: 'desc', favoris: false, nonLus: false, aLire: false };

let filtres: FiltresFil = { ...FILTRES_DEFAUT };
let pageCourante = 1;
let totalPages = 1;
let enChargement = false;
let requeteEnCours = 0;
let observateur: IntersectionObserver | null = null;
let minuterieRecherche: ReturnType<typeof setTimeout> | null = null;
/** Rail des filtres rapides (rubriques, tendances, mots-clés), rempli après chargement */
let rail: RailPuces | null = null;

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
  // Arrivée depuis une autre page avec un mot-clé (tendances de la Découverte)
  const motCleUrl = new URLSearchParams(window.location.search).get('motCle');
  if (motCleUrl) {
    filtres.motCle = motCleUrl;
    window.history.replaceState(null, '', window.location.pathname);
  }

  const page = creerElement('div', { classes: ['page-accueil'] });

  // En-tête avec stats
  const entete = creerElement('div', { classes: ['page-accueil-entete'] });
  const titre = creerElement('h1', { texte: "Fil d'actualités" });
  const stats = creerElement('div', { classes: ['page-accueil-stats'], attrs: { id: 'stats-container' } });
  entete.append(titre, stats);

  // Conteneur du fil
  const fil = creerElement('div', { classes: ['fil-actualites'] });
  const liste = creerElement('div', { classes: ['fil-liste'], attrs: { id: 'fil-liste' } });
  appliquerMode(liste, modeEnregistre());
  liste.appendChild(creerListeSkeletons(6));

  // Sentinelle de chargement au défilement
  const sentinelle = creerElement('div', {
    classes: ['fil-sentinelle'],
    attrs: { id: 'fil-sentinelle', 'aria-live': 'polite' },
  });

  rail = creerRailPuces({
    libelle: 'Filtres rapides',
    groupes: [
      { id: 'fil-rubriques', icone: 'label', titre: 'Rubriques' },
      { id: 'fil-tendances', icone: 'local_fire_department', titre: 'Tendances dans votre fil' },
      { id: 'fil-mots-cles', icone: 'tag', titre: 'Mots-clés fréquents' },
    ],
  });
  fil.append(creerBarreCommandes(), rail, liste, sentinelle);
  page.append(entete, fil);
  container.append(page);

  observerDefilement(sentinelle);

  // Charger les données
  await Promise.all([chargerStatistiques(), chargerTendances(), chargerMotsClesFiltre(), chargerArticles(1)]);
}

/**
 * Champ de recherche plein texte dans tous les articles du fil
 */
function creerChampRecherche(): HTMLElement {
  const formulaire = creerElement('form', { classes: ['fil-recherche'], attrs: { role: 'search' } });
  const champ = creerElement('input', {
    classes: ['la-input'],
    attrs: {
      type: 'search',
      id: 'fil-recherche',
      placeholder: 'Rechercher… (-mot exclut, "phrase exacte", préfixe*)',
      'aria-label': 'Rechercher dans les articles. Un tiret devant un mot l\'exclut, les guillemets imposent une phrase exacte, l\'astérisque accepte un préfixe.',
      title: '-mot exclut · "phrase exacte" · préfixe*',
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
    classes: ['la-btn', 'ghost', 'icon-only', 'fil-recherche-bouton'],
    attrs: { type: 'submit', 'aria-label': 'Rechercher' },
    icone: 'search',
  });
  formulaire.append(champ, bouton);
  return formulaire;
}

/**
 * Sélecteur étiqueté du panneau de filtres
 */
function creerChampSelect(id: string, libelle: string, options: Array<{ valeur: string; libelle: string }>, valeur: string, onChange: (valeur: string) => void): HTMLElement {
  const champ = creerElement('label', { classes: ['popover-champ'], attrs: { for: id } });
  champ.append(creerElement('span', { classes: ['popover-champ-libelle'], texte: libelle }));
  const select = creerElement('select', { classes: ['la-select'], attrs: { id } }) as HTMLSelectElement;
  for (const option of options) {
    select.append(creerElement('option', { attrs: { value: option.valeur }, texte: option.libelle }));
  }
  select.value = valeur;
  select.addEventListener('change', () => onChange(select.value));
  champ.append(select);
  return champ;
}

/**
 * Bascule (favoris, à lire, non lus) : une puce pressable
 */
function creerBascule(id: string, nomIcone: string, libelle: string, lire: () => boolean, ecrire: (v: boolean) => void): HTMLElement {
  const puce = creerElement('button', {
    classes: ['la-chip chip-filtre chip-bascule', lire() ? 'active' : ''],
    attrs: { type: 'button', id, 'aria-pressed': String(lire()), title: libelle },
    icone: nomIcone,
    texte: libelle,
    onClick: () => {
      ecrire(!lire());
      puce.classList.toggle('active', lire());
      puce.setAttribute('aria-pressed', String(lire()));
      appliquerFiltres();
    },
  });
  return puce;
}

/**
 * Barre de commandes sur une ligne : recherche, tri, panneau de filtres, bascules, tout lu, affichage
 */
function creerBarreCommandes(): HTMLElement {
  const barre = creerElement('div', { classes: ['fil-commandes'] });

  // Tri
  const tri = creerElement('div', { classes: ['fil-tri'], attrs: { title: 'Trier' } });
  tri.append(icone('sort'));
  const selectTri = creerElement('select', { classes: ['la-select'], attrs: { id: 'fil-tri', 'aria-label': 'Trier' } }) as HTMLSelectElement;
  for (const choix of CHOIX_TRI) {
    selectTri.append(creerElement('option', { attrs: { value: choix.valeur }, texte: choix.libelle }));
  }
  selectTri.value = `${filtres.tri}:${filtres.ordre}`;
  selectTri.addEventListener('change', () => {
    const [tri, ordre] = selectTri.value.split(':') as [TriFil, 'asc' | 'desc'];
    filtres.tri = tri;
    filtres.ordre = ordre;
    appliquerFiltres();
  });
  tri.append(selectTri);

  // Panneau de filtres : source, période, note
  const panneau = creerElement('div', { classes: ['popover-filtres'] });
  const nombreFiltres = (): number => [filtres.sourceId, filtres.periode, filtres.noteMin].filter(Boolean).length;
  const champSource = creerChampSelect('fil-source', 'Source', [{ valeur: '', libelle: 'Toutes' }], filtres.sourceId ?? '', valeur => {
    filtres.sourceId = valeur || undefined;
    appliquerFiltres();
  });
  const selectSource = champSource.querySelector('select') as HTMLSelectElement;
  if (filtres.sourceId) {
    // En attendant la liste : on garde la source mémorisée sélectionnable
    selectSource.append(creerElement('option', { attrs: { value: filtres.sourceId }, texte: 'Source choisie' }));
    selectSource.value = filtres.sourceId;
  }
  void remplirSelectSources(selectSource);
  const champPeriode = creerChampSelect('fil-periode', 'Période', [{ valeur: '', libelle: 'Tout' }, ...CHOIX_PERIODE.map(c => ({ valeur: c.valeur, libelle: c.libelle }))], filtres.periode ?? '', valeur => {
    filtres.periode = (valeur || undefined) as Periode | undefined;
    appliquerFiltres();
  });
  const champNote = creerChampSelect('fil-note-min', 'Note', [{ valeur: '', libelle: 'Toutes' }, ...[1, 2, 3, 4, 5].map(n => ({ valeur: String(n), libelle: `${n} étoile${n > 1 ? 's' : ''} et plus` }))], filtres.noteMin ? String(filtres.noteMin) : '', valeur => {
    filtres.noteMin = valeur ? Number(valeur) : undefined;
    appliquerFiltres();
  });
  const reinitialiser = creerElement('button', {
    classes: ['la-btn', 'ghost', 'sm', 'popover-reinitialiser'],
    attrs: { type: 'button' },
    icone: 'restart_alt',
    texte: 'Réinitialiser',
    onClick: () => {
      filtres.sourceId = undefined;
      filtres.periode = undefined;
      filtres.noteMin = undefined;
      selectSource.value = '';
      (champPeriode.querySelector('select') as HTMLSelectElement).value = '';
      (champNote.querySelector('select') as HTMLSelectElement).value = '';
      appliquerFiltres();
    },
  });
  panneau.append(champSource, champPeriode, champNote, reinitialiser);
  const popoverFiltres = creerPopover({ libelle: 'Filtres', icone: 'tune', contenu: panneau });
  popoverFiltres.definirBadge(nombreFiltres());
  panneau.addEventListener('change', () => popoverFiltres.definirBadge(nombreFiltres()));
  reinitialiser.addEventListener('click', () => popoverFiltres.definirBadge(0));

  // Bascules
  const bascules = creerElement('div', { classes: ['fil-bascules'], attrs: { role: 'group', 'aria-label': 'Filtres rapides' } });
  bascules.append(
    creerBascule('fil-favoris', 'favorite', 'Favoris', () => filtres.favoris, v => { filtres.favoris = v; }),
    creerBascule('fil-a-lire', 'bookmark', 'À lire', () => filtres.aLire, v => { filtres.aLire = v; }),
    creerBascule('fil-non-lus', 'mark_email_unread', 'Non lus', () => filtres.nonLus, v => { filtres.nonLus = v; }),
  );

  // Tout marquer comme lu (borné à l'instant du clic)
  const btnToutLu = creerElement('button', {
    classes: ['la-btn', 'ghost', 'sm', 'icon-only', 'btn-tout-lu'],
    attrs: { type: 'button', id: 'fil-tout-lu', title: 'Tout marquer lu', 'aria-label': 'Marquer comme lus tous les articles du fil' },
    icone: 'done_all',
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

  // Liste ou tuiles (mémorisé)
  const selecteurAffichage = creerSelecteurAffichage(modeEnregistre(), mode => {
    const fil = $('#fil-liste');
    if (fil) appliquerMode(fil as HTMLElement, mode);
  });

  const droite = creerElement('div', { classes: ['fil-commandes-droite'] });
  droite.append(tri, popoverFiltres, bascules, btnToutLu, selecteurAffichage);
  barre.append(creerChampRecherche(), droite);
  return barre;
}

/**
 * Tendances du fil : mots en forte hausse sur 24 h, en tête du rail
 */
async function chargerTendances(): Promise<void> {
  const conteneur = $('#fil-tendances');
  if (!conteneur) return;
  let tendances: Tendance[] = [];
  try {
    tendances = (await apiTendances.fil(8)).donnees;
  } catch {
    // Les tendances sont un bonus : rien à signaler si elles manquent
  }
  vider(conteneur);
  for (const tendance of tendances) {
    const puce = creerElement('button', {
      classes: ['la-chip chip-filtre chip-tendance', tendance.score >= 2 ? 'forte' : '', filtres.motCle === tendance.mot ? 'active' : ''],
      attrs: {
        type: 'button',
        'data-mot': tendance.mot,
        'aria-pressed': String(filtres.motCle === tendance.mot),
        title: `${tendance.nombreRecents} article${tendance.nombreRecents > 1 ? 's' : ''} en 24 h, ${tendance.nombreReference} les 7 jours précédents`,
      },
      icone: tendance.score >= 2 ? 'trending_up' : undefined,
      texte: tendance.mot,
      onClick: () => filtrerParMotCle(filtres.motCle === tendance.mot ? undefined : tendance.mot),
    });
    puce.append(creerElement('span', { classes: ['chip-tendance-nombre'], texte: String(tendance.nombreRecents) }));
    conteneur.append(puce);
  }
  rail?.actualiser();
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
  // Un mot déjà présent dans les tendances n'est pas répété
  const dejaEnTendance = new Set([...document.querySelectorAll('#fil-tendances [data-mot]')].map(p => p.getAttribute('data-mot')));
  const frequents = motsCles.filter(m => !dejaEnTendance.has(m.mot));
  const liste = filtres.motCle && !dejaEnTendance.has(filtres.motCle) && !frequents.some(m => m.mot === filtres.motCle)
    ? [{ mot: filtres.motCle, nombreArticles: 0 }, ...frequents]
    : frequents;
  for (const { mot, nombreArticles } of liste) {
    const chip = creerElement('button', {
      classes: ['la-chip chip-filtre', filtres.motCle === mot ? 'active' : ''],
      attrs: { type: 'button', 'data-mot': mot, 'aria-pressed': String(filtres.motCle === mot) },
      texte: nombreArticles ? `${mot} (${nombreArticles})` : mot,
      onClick: () => filtrerParMotCle(filtres.motCle === mot ? undefined : mot),
    });
    conteneur.append(chip);
  }
  rail?.actualiser();
}

/**
 * Active (ou retire) le filtre par mot-clé, depuis un bouton de la barre ou depuis une carte
 */
function filtrerParMotCle(mot: string | undefined): void {
  filtres.motCle = mot;
  const puces = [...document.querySelectorAll('#fil-tendances [data-mot], #fil-mots-cles [data-mot]')];
  if (mot && !puces.some(c => c.getAttribute('data-mot') === mot)) {
    void chargerMotsClesFiltre();
  } else {
    puces.forEach(c => {
      const actif = c.getAttribute('data-mot') === mot;
      c.classList.toggle('active', actif);
      c.setAttribute('aria-pressed', String(actif));
    });
  }
  appliquerFiltres();
  if (mot) window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Rubriques : les tags de sources de l'utilisateur, en puces avec leurs non-lus, dans le rail
 */
function afficherRubriques(liste: Tag[], nonLusParTag: Record<string, number>): void {
  const barre = $('#fil-rubriques');
  if (!barre) return;
  vider(barre);
  const rubriques = [...liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  if (rubriques.length === 0) {
    rail?.actualiser();
    if (filtres.tag) {
      filtres.tag = undefined;
      appliquerFiltres();
    }
    return;
  }
  if (filtres.tag && !rubriques.some(r => r.slug === filtres.tag)) {
    // Rubrique supprimée entre-temps : retour au fil complet
    filtres.tag = undefined;
    appliquerFiltres();
  }
  const choisir = (slug: string | undefined): void => {
    filtres.tag = slug;
    barre.querySelectorAll('.chip-rubrique').forEach(c => {
      const actif = (c.getAttribute('data-slug') || undefined) === slug;
      c.classList.toggle('active', actif);
      c.setAttribute('aria-pressed', String(actif));
    });
    appliquerFiltres();
  };
  const creerPuce = (slug: string | undefined, nom: string, nonLus: number): HTMLElement => {
    const actif = (filtres.tag ?? undefined) === slug;
    const puce = creerElement('button', {
      classes: ['la-chip chip-filtre chip-rubrique', actif ? 'active' : ''],
      attrs: { type: 'button', 'data-slug': slug ?? '', 'aria-pressed': String(actif) },
      icone: slug ? 'label' : 'apps',
      texte: nom,
      onClick: () => choisir(slug),
    });
    if (slug) colorerTag(puce, nom);
    if (nonLus > 0) {
      puce.append(
        creerElement('span', {
          classes: ['la-badge', 'sm', 'badge-non-lus'],
          attrs: { title: `${nonLus} non lu${nonLus > 1 ? 's' : ''}` },
          texte: String(nonLus),
        }),
      );
    }
    return puce;
  };
  barre.append(creerPuce(undefined, 'Toutes', 0));
  for (const rubrique of rubriques) {
    barre.append(creerPuce(rubrique.slug, rubrique.nom, nonLusParTag[rubrique.slug] ?? 0));
  }
  rail?.actualiser();
}

/**
 * Remplit le sélecteur de sources avec celles de l'utilisateur (triées par nom)
 */
async function remplirSelectSources(select: HTMLSelectElement): Promise<void> {
  try {
    const resultat = await sources.lister(1, 100);
    const liste = [...resultat.donnees].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const courante = filtres.sourceId;
    select.replaceChildren(creerElement('option', { attrs: { value: '' }, texte: 'Toutes' }));
    for (const source of liste) {
      select.append(creerElement('option', { attrs: { value: source.id }, texte: source.nom }));
    }
    if (courante && liste.some(s => s.id === courante)) {
      select.value = courante;
    } else if (courante) {
      // Source disparue : on revient au fil complet
      filtres.sourceId = undefined;
      appliquerFiltres();
    }
  } catch {
    // Sans la liste, le sélecteur reste sur « Toutes »
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
    const persistants = { tri: filtres.tri, ordre: filtres.ordre, noteMin: filtres.noteMin, favoris: filtres.favoris, nonLus: filtres.nonLus, aLire: filtres.aLire, motCle: filtres.motCle, sourceId: filtres.sourceId, periode: filtres.periode, tag: filtres.tag };
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
    const [stats, nonLus, rubriques] = await Promise.all([
      articles.statistiques(),
      articles.nonLus(),
      tags.lister().catch(() => ({ donnees: [] as Tag[] })),
    ]);
    afficherStatistiques(container, stats, nonLus.total);
    afficherRubriques(rubriques.donnees, nonLus.parTag ?? {});
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
    aLire: filtres.aLire,
    motCle: filtres.motCle,
    sourceId: filtres.sourceId,
    depuis: depuisPeriode(filtres.periode),
    tag: filtres.tag,
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
      surligner: termesRecherche(filtres.recherche),
    });
    container.append(carte);
  }
}

/**
 * Affiche un message quand il n'y a pas d'articles
 */
function afficherMessageVide(container: Element): void {
  const filtresActifs = filtres.recherche || filtres.noteMin || filtres.favoris || filtres.nonLus || filtres.aLire || filtres.motCle || filtres.sourceId || filtres.periode || filtres.tag;
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
