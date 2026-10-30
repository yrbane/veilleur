/**
 * Veilleur - Panneaux d'administration affichés dans la page Paramètres (rôle admin) :
 * tableau de bord (statistiques anonymes, graphiques), comptes, sources, état du système.
 */

import type { Chart, ChartConfiguration } from 'chart.js';
import { creerElement, vider } from '../utils/dom';
import { icone } from '../utils/icones';
import { formatDate, formatDateRelative, formatNombre } from '../utils/format';
import { urlFaviconLocale } from '../utils/favicons';
import { toast } from '../utils/toast';
import { admin } from '../services/api';
import type { EtatSysteme, SourceAdmin, TableauDeBord, Utilisateur, UtilisateurAdmin } from '../services/api';
import { creerGraphique, formatDuree, formatOctets, fusionnerOptions, libellesJours, optionsCommunes, palette, variableTheme } from '../utils/graphiques';
import { creerEnteteTriable, type ColonneTriable, type EtatTri } from '../utils/tableTriable';

const LIBELLES_STATUT_IMAGE: Record<string, string> = { termine: 'Terminées', en_attente: 'En attente', en_cours: 'En cours', echec: 'Échecs' };
const LIBELLES_TYPE_SOURCE: Record<string, string> = { rss: 'RSS', atom: 'Atom', html: 'Page HTML' };

let moi: Utilisateur | null = null;
let graphiques: Chart[] = [];
let constructeursGraphiques: Array<() => Promise<void>> = [];
let observateurTheme: MutationObserver | null = null;

/** L'administrateur connecté : ses propres lignes sont protégées dans la liste des comptes */
export function definirAdministrateurCourant(utilisateur: Utilisateur | null): void {
  moi = utilisateur;
}

export function creerChargement(): HTMLElement {
  return creerElement('div', { classes: ['chargement'], html: '<div class="la-spinner lg"></div><p>Chargement…</p>' });
}

function creerErreur(message: string, reessayer: () => void): HTMLElement {
  const bloc = creerElement('div', { classes: ['la-empty'] });
  bloc.append(
    creerElement('div', { classes: ['la-empty-icon'], enfants: [icone('error')] }),
    creerElement('p', { classes: ['la-empty-title'], texte: message }),
    creerElement('button', { classes: ['la-btn', 'secondary'], attrs: { type: 'button' }, texte: 'Réessayer', onClick: reessayer }),
  );
  return bloc;
}

// ============================================
// Vue d'ensemble
// ============================================

export async function afficherApercu(contenu: HTMLElement): Promise<void> {
  let tableau: TableauDeBord;
  try {
    tableau = await admin.tableauDeBord();
  } catch {
    vider(contenu);
    contenu.append(creerErreur('Impossible de charger les statistiques', () => void afficherApercu(contenu)));
    return;
  }
  vider(contenu);
  contenu.append(creerKpis(tableau), creerGrilleGraphiques(tableau));
  await construireGraphiques();
  ecouterTheme();
}

function creerKpi(nomIcone: string, valeur: string, libelle: string, detail?: string): HTMLElement {
  const kpi = creerElement('div', { classes: ['admin-kpi', 'la-card'] });
  kpi.append(
    creerElement('div', { classes: ['admin-kpi-icone'], enfants: [icone(nomIcone)] }),
    creerElement('div', { classes: ['admin-kpi-valeur'], texte: valeur }),
    creerElement('div', { classes: ['admin-kpi-libelle'], texte: libelle }),
  );
  if (detail) kpi.append(creerElement('div', { classes: ['admin-kpi-detail'], texte: detail }));
  return kpi;
}

function creerKpis(t: TableauDeBord): HTMLElement {
  const grille = creerElement('div', { classes: ['admin-kpis'] });
  const pluriel = (n: number, mot: string): string => `${formatNombre(n)} ${mot}${n > 1 ? 's' : ''}`;
  grille.append(
    creerKpi('group', formatNombre(t.utilisateurs.total), 'Comptes', `${pluriel(t.utilisateurs.nouveaux7j, 'inscription')} sur 7 jours · ${t.utilisateurs.admins} admin${t.utilisateurs.admins > 1 ? 's' : ''}`),
    creerKpi('login', formatNombre(t.utilisateurs.connectes7j), 'Actifs cette semaine', `${pluriel(t.utilisateurs.avec2fa, 'compte')} avec 2FA · ${t.utilisateurs.abonnesPush} notifié${t.utilisateurs.abonnesPush > 1 ? 's' : ''} par push`),
    creerKpi('rss_feed', formatNombre(t.sources.total), 'Sources', `${pluriel(t.sources.abonnements, 'abonnement')} · ${t.sources.enEchec} en échec · ${t.sources.enPause} en pause`),
    creerKpi('article', formatNombre(t.articles.total), 'Articles', `${formatNombre(t.articles.dernieres24h)} en 24 h · ${formatNombre(t.articles.derniers7j)} sur 7 jours`),
    creerKpi('visibility', formatNombre(t.annotations.lus), 'Lectures', `${pluriel(t.annotations.favoris, 'favori')} · ${formatNombre(t.annotations.aLire)} à lire · note moyenne ${t.annotations.noteMoyenne ?? '—'}`),
    creerKpi('photo_library', formatNombre(t.articles.imagesCachees), 'Images en cache', `${t.articles.total ? Math.round((t.articles.avecImage / t.articles.total) * 100) : 0} % des articles illustrés · ${formatOctets(t.images.octets)}`),
  );
  return grille;
}

interface DefinitionCarte {
  titre: string;
  indication?: string;
  large?: boolean;
  configuration: () => ChartConfiguration;
}

function creerCarteGraphique(def: DefinitionCarte): HTMLElement {
  const carte = creerElement('section', { classes: ['admin-carte', 'la-card', def.large ? 'large' : ''] });
  const entete = creerElement('header', { classes: ['admin-carte-entete'] });
  entete.append(creerElement('h2', { classes: ['admin-carte-titre'], texte: def.titre }));
  if (def.indication) entete.append(creerElement('span', { classes: ['admin-carte-indication'], texte: def.indication }));
  const zone = creerElement('div', { classes: ['admin-graphique'] });
  const canvas = creerElement('canvas', { attrs: { role: 'img', 'aria-label': def.titre } });
  zone.append(canvas);
  carte.append(entete, zone);
  constructeursGraphiques.push(async () => {
    graphiques.push(await creerGraphique(canvas, def.configuration()));
  });
  return carte;
}

function creerGrilleGraphiques(t: TableauDeBord): HTMLElement {
  const grille = creerElement('div', { classes: ['admin-grille'] });
  const jours = libellesJours(t.series.articles.map(p => p.jour));
  const [c1, c2, c3] = palette(3);
  const primaire = (): string => variableTheme('--couleur-primaire', c1!);

  grille.append(
    creerCarteGraphique({
      titre: 'Activité sur 30 jours',
      indication: 'Articles collectés (gauche), inscriptions et lectures (droite)',
      large: true,
      configuration: () => ({
        type: 'line',
        data: {
          labels: jours,
          datasets: [
            { label: 'Articles collectés', data: t.series.articles.map(p => p.valeur), borderColor: primaire(), backgroundColor: palette(1, 0.15)[0], fill: true, tension: 0.3, pointRadius: 0, yAxisID: 'y' },
            { label: 'Lectures', data: t.series.lectures.map(p => p.valeur), borderColor: c2, tension: 0.3, pointRadius: 2, yAxisID: 'y2' },
            { label: 'Inscriptions', data: t.series.inscriptions.map(p => p.valeur), borderColor: c3, tension: 0.3, pointRadius: 2, yAxisID: 'y2' },
          ],
        },
        options: fusionnerOptions(optionsCommunes(), {
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: optionsCommunes().scales!.x,
            y: { ...optionsCommunes().scales!.y, position: 'left' },
            y2: { ...optionsCommunes().scales!.y, position: 'right', grid: { drawOnChartArea: false } },
          },
        }),
      }),
    }),
    creerCarteGraphique({
      titre: 'Heures de publication',
      indication: 'Articles des 30 derniers jours, par heure',
      configuration: () => ({
        type: 'bar',
        data: { labels: t.articlesParHeure.map((_, h) => `${h} h`), datasets: [{ label: 'Articles', data: t.articlesParHeure, backgroundColor: palette(1, 0.75)[0], borderRadius: 4 }] },
        options: fusionnerOptions(optionsCommunes(), { plugins: { legend: { display: false } } }),
      }),
    }),
    creerCarteGraphique({
      titre: 'Sources par type',
      configuration: () => {
        const entrees = Object.entries(t.sources.parType);
        return {
          type: 'doughnut',
          data: { labels: entrees.map(([k]) => LIBELLES_TYPE_SOURCE[k] ?? k), datasets: [{ data: entrees.map(([, v]) => v), backgroundColor: palette(entrees.length, 0.85), borderWidth: 0 }] },
          options: fusionnerOptions(optionsCommunes(), { scales: {}, cutout: '62%', plugins: { legend: { position: 'right' } } } as never),
        };
      },
    }),
    creerCarteGraphique({
      titre: 'Images en cache',
      indication: 'Par statut de traitement',
      configuration: () => {
        const entrees = Object.entries(t.images.parStatut);
        return {
          type: 'doughnut',
          data: { labels: entrees.map(([k]) => LIBELLES_STATUT_IMAGE[k] ?? k), datasets: [{ data: entrees.map(([, v]) => v), backgroundColor: palette(entrees.length + 2, 0.85).slice(2), borderWidth: 0 }] },
          options: fusionnerOptions(optionsCommunes(), { scales: {}, cutout: '62%', plugins: { legend: { position: 'right' } } } as never),
        };
      },
    }),
    creerCarteGraphique({
      titre: 'Notes attribuées',
      indication: `${formatNombre(t.annotations.notes)} note${t.annotations.notes > 1 ? 's' : ''} au total`,
      configuration: () => ({
        type: 'bar',
        data: { labels: ['1 ★', '2 ★', '3 ★', '4 ★', '5 ★'], datasets: [{ label: 'Articles notés', data: t.annotations.repartitionNotes, backgroundColor: palette(5, 0.8), borderRadius: 4 }] },
        options: fusionnerOptions(optionsCommunes(), { plugins: { legend: { display: false } } }),
      }),
    }),
    creerCarteGraphique({
      titre: 'Sources les plus suivies',
      indication: 'Abonnés et articles collectés',
      large: true,
      configuration: () => ({
        type: 'bar',
        data: {
          labels: t.topSources.map(s => s.nom),
          datasets: [
            { label: 'Abonnés', data: t.topSources.map(s => s.abonnes), backgroundColor: palette(1, 0.85)[0], borderRadius: 4, xAxisID: 'x' },
            { label: 'Articles', data: t.topSources.map(s => s.articles), backgroundColor: palette(2, 0.5)[1], borderRadius: 4, xAxisID: 'x2' },
          ],
        },
        options: fusionnerOptions(optionsCommunes(), {
          indexAxis: 'y',
          scales: {
            y: { ...optionsCommunes().scales!.y, beginAtZero: undefined, grid: { display: false } },
            x: { ...optionsCommunes().scales!.x, position: 'bottom', beginAtZero: true },
            x2: { ...optionsCommunes().scales!.x, position: 'top', beginAtZero: true, grid: { drawOnChartArea: false } },
          },
        }),
      }),
    }),
    creerCarteGraphique({
      titre: 'Rubriques les plus utilisées',
      indication: 'Nombre de sources portant le tag',
      configuration: () => ({
        type: 'bar',
        data: { labels: t.tagsPopulaires.map(x => x.nom), datasets: [{ label: 'Sources', data: t.tagsPopulaires.map(x => x.nombreSources), backgroundColor: palette(t.tagsPopulaires.length, 0.8), borderRadius: 4 }] },
        options: fusionnerOptions(optionsCommunes(), { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { y: { ...optionsCommunes().scales!.y, beginAtZero: undefined, grid: { display: false } }, x: { ...optionsCommunes().scales!.x, beginAtZero: true } } }),
      }),
    }),
  );

  // Mots-clés : un nuage de puces, plus lisible qu'un graphique
  const nuage = creerElement('section', { classes: ['admin-carte', 'la-card'] });
  nuage.append(creerElement('header', { classes: ['admin-carte-entete'], enfants: [creerElement('h2', { classes: ['admin-carte-titre'], texte: 'Mots-clés les plus fréquents' })] }));
  const puces = creerElement('div', { classes: ['admin-nuage'] });
  const max = Math.max(1, ...t.motsClesFrequents.map(m => m.nombre));
  for (const { mot, nombre } of t.motsClesFrequents) {
    const puce = creerElement('span', { classes: ['la-chip', 'admin-nuage-mot'], texte: mot });
    puce.style.fontSize = `${0.8 + (nombre / max) * 0.5}rem`;
    puce.append(creerElement('span', { classes: ['admin-nuage-nombre'], texte: formatNombre(nombre) }));
    puces.append(puce);
  }
  if (t.motsClesFrequents.length === 0) puces.append(creerElement('p', { classes: ['admin-vide'], texte: 'Aucun mot-clé extrait pour le moment.' }));
  nuage.append(puces);
  grille.append(nuage);
  return grille;
}

async function construireGraphiques(): Promise<void> {
  for (const construire of constructeursGraphiques) {
    try {
      await construire();
    } catch {
      // Un graphique qui échoue ne doit pas masquer les autres
    }
  }
}

export function detruireGraphiques(): void {
  for (const graphique of graphiques) graphique.destroy();
  graphiques = [];
  constructeursGraphiques = [];
  observateurTheme?.disconnect();
  observateurTheme = null;
}

/** Au changement de thème, les graphiques sont reconstruits avec les nouvelles couleurs */
function ecouterTheme(): void {
  observateurTheme?.disconnect();
  observateurTheme = new MutationObserver(() => {
    for (const graphique of graphiques) graphique.destroy();
    graphiques = [];
    void construireGraphiques();
  });
  observateurTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// ============================================
// Comptes
// ============================================

function creerBarreListe(placeholder: string, onRecherche: (valeur: string) => void): { barre: HTMLElement; compteur: HTMLElement } {
  const barre = creerElement('div', { classes: ['admin-barre'] });
  const champ = creerElement('input', { classes: ['la-input', 'admin-recherche'], attrs: { type: 'search', placeholder, 'aria-label': placeholder } }) as HTMLInputElement;
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  champ.addEventListener('input', () => {
    if (minuterie) clearTimeout(minuterie);
    minuterie = setTimeout(() => onRecherche(champ.value.trim()), 350);
  });
  const compteur = creerElement('span', { classes: ['admin-compteur'] });
  barre.append(champ, compteur);
  return { barre, compteur };
}

function creerPagination(page: number, total: number, limite: number, aller: (page: number) => void): HTMLElement {
  const pages = Math.max(1, Math.ceil(total / limite));
  const nav = creerElement('nav', { classes: ['admin-pagination'], attrs: { 'aria-label': 'Pagination' } });
  if (pages <= 1) return nav;
  const precedent = creerElement('button', { classes: ['la-btn', 'ghost', 'sm'], attrs: { type: 'button' }, icone: 'chevron_left', texte: 'Précédent', onClick: () => aller(page - 1) }) as HTMLButtonElement;
  precedent.disabled = page <= 1;
  const suivant = creerElement('button', { classes: ['la-btn', 'ghost', 'sm'], attrs: { type: 'button' }, texte: 'Suivant', onClick: () => aller(page + 1) }) as HTMLButtonElement;
  suivant.append(icone('chevron_right'));
  suivant.disabled = page >= pages;
  nav.append(precedent, creerElement('span', { classes: ['admin-pagination-etat'], texte: `Page ${page} / ${pages}` }), suivant);
  return nav;
}

function badge(texte: string, variante: string): HTMLElement {
  return creerElement('span', { classes: ['la-badge', 'sm', variante], texte });
}

export async function afficherComptes(contenu: HTMLElement): Promise<void> {
  let page = 1;
  let recherche = '';
  let tri: EtatTri = { tri: 'dateCreation', ordre: 'desc' };
  const LIMITE = 25;
  const { barre, compteur } = creerBarreListe('Rechercher un courriel…', valeur => { recherche = valeur; page = 1; void charger(); });
  const zone = creerElement('div', { classes: ['admin-table-zone'] });
  vider(contenu);
  contenu.append(barre, zone);

  const charger = async (): Promise<void> => {
    zone.setAttribute('aria-busy', 'true');
    try {
      const resultat = await admin.listerUtilisateurs({ page, limite: LIMITE, recherche: recherche || undefined, ...tri });
      compteur.textContent = `${formatNombre(resultat.total)} compte${resultat.total > 1 ? 's' : ''}`;
      vider(zone);
      zone.append(
        creerTableComptes(resultat.donnees, charger, tri, nouveau => { tri = nouveau; page = 1; void charger(); }),
        creerPagination(page, resultat.total, LIMITE, p => { page = p; void charger(); }),
      );
    } catch {
      vider(zone);
      zone.append(creerErreur('Impossible de charger les comptes', () => void charger()));
    } finally {
      zone.removeAttribute('aria-busy');
    }
  };
  await charger();
}

const COLONNES_COMPTES: ColonneTriable[] = [
  { cle: 'email', libelle: 'Compte' },
  { cle: 'role', libelle: 'Rôle' },
  { cle: 'dateCreation', libelle: 'Inscription' },
  { cle: 'dateDerniereConnexion', libelle: 'Dernière connexion' },
  { cle: 'nombreSources', libelle: 'Sources', numerique: true },
  { cle: 'nombreLectures', libelle: 'Lectures', numerique: true },
  { libelle: 'Actions' },
];

function creerTableComptes(comptes: UtilisateurAdmin[], rafraichir: () => Promise<void>, tri: EtatTri, onTri: (tri: EtatTri) => void): HTMLElement {
  const enveloppe = creerElement('div', { classes: ['admin-table'] });
  const table = creerElement('table', { classes: ['la-table'] });
  table.append(creerEnteteTriable(COLONNES_COMPTES, tri, onTri));
  const corps = creerElement('tbody');
  for (const compte of comptes) {
    const estMoi = compte.id === moi?.id;
    const tr = creerElement('tr', { classes: [compte.estActif ? '' : 'inactif', estMoi ? 'moi' : ''] });

    const cellule = creerElement('td', { classes: ['admin-cellule-compte'] });
    cellule.append(creerElement('span', { classes: ['admin-courriel'], texte: compte.email }));
    const badges = creerElement('span', { classes: ['admin-badges'] });
    if (estMoi) badges.append(badge('vous', 'primary'));
    if (!compte.estActif) badges.append(badge('désactivé', 'danger'));
    if (compte.totpActif) badges.append(badge('2FA', 'success'));
    cellule.append(badges);
    tr.append(cellule);

    const selectRole = creerElement('select', { classes: ['la-select', 'admin-select'], attrs: { 'aria-label': `Rôle de ${compte.email}` } }) as HTMLSelectElement;
    selectRole.append(creerElement('option', { attrs: { value: 'membre' }, texte: 'Membre' }), creerElement('option', { attrs: { value: 'admin' }, texte: 'Administrateur' }));
    selectRole.value = compte.role;
    selectRole.disabled = estMoi;
    selectRole.addEventListener('change', async () => {
      try {
        await admin.modifierUtilisateur(compte.id, { role: selectRole.value as 'membre' | 'admin' });
        toast.succes(selectRole.value === 'admin' ? `${compte.email} est maintenant administrateur` : `${compte.email} redevient membre`);
        await rafraichir();
      } catch (erreur) {
        toast.erreur(messageErreur(erreur, 'Impossible de changer le rôle'));
        selectRole.value = compte.role;
      }
    });
    tr.append(creerElement('td', { enfants: [selectRole] }));
    tr.append(creerElement('td', { texte: formatDate(compte.dateCreation) }));
    tr.append(creerElement('td', { texte: compte.dateDerniereConnexion ? formatDateRelative(compte.dateDerniereConnexion) : 'jamais' }));
    tr.append(creerElement('td', { classes: ['num'], texte: formatNombre(compte.nombreSources) }));
    tr.append(creerElement('td', { classes: ['num'], texte: formatNombre(compte.nombreLectures) }));

    const actions = creerElement('td', { classes: ['admin-actions'] });
    const btnActif = creerElement('button', {
      classes: ['la-btn', 'ghost', 'sm', 'icon-only'],
      attrs: { type: 'button', title: compte.estActif ? 'Désactiver le compte' : 'Réactiver le compte', 'aria-label': compte.estActif ? `Désactiver ${compte.email}` : `Réactiver ${compte.email}` },
      icone: compte.estActif ? 'person_off' : 'person_check',
      onClick: async () => {
        try {
          await admin.modifierUtilisateur(compte.id, { estActif: !compte.estActif });
          toast.succes(compte.estActif ? 'Compte désactivé, sessions fermées' : 'Compte réactivé');
          await rafraichir();
        } catch (erreur) {
          toast.erreur(messageErreur(erreur, 'Impossible de modifier le compte'));
        }
      },
    }) as HTMLButtonElement;
    btnActif.disabled = estMoi;
    const btnSupprimer = creerElement('button', {
      classes: ['la-btn', 'ghost', 'sm', 'icon-only', 'danger'],
      attrs: { type: 'button', title: 'Supprimer le compte', 'aria-label': `Supprimer ${compte.email}` },
      icone: 'delete',
      onClick: async () => {
        if (!confirm(`Supprimer définitivement ${compte.email} et toutes ses données (sources suivies, notes, favoris) ?`)) return;
        try {
          await admin.supprimerUtilisateur(compte.id);
          toast.succes(`${compte.email} supprimé`);
          await rafraichir();
        } catch (erreur) {
          toast.erreur(messageErreur(erreur, 'Impossible de supprimer le compte'));
        }
      },
    }) as HTMLButtonElement;
    btnSupprimer.disabled = estMoi;
    actions.append(btnActif, btnSupprimer);
    tr.append(actions);
    corps.append(tr);
  }
  if (comptes.length === 0) {
    corps.append(creerElement('tr', { enfants: [creerElement('td', { attrs: { colspan: '7' }, classes: ['admin-vide'], texte: 'Aucun compte ne correspond.' })] }));
  }
  table.append(corps);
  enveloppe.append(table);
  return enveloppe;
}

function messageErreur(erreur: unknown, repli: string): string {
  const message = (erreur as { message?: string } | null)?.message;
  return message && message !== 'Conflict' ? message : repli;
}

// ============================================
// Sources
// ============================================

export async function afficherSources(contenu: HTMLElement): Promise<void> {
  let page = 1;
  let recherche = '';
  let tri: EtatTri = { tri: 'nombreEchecs', ordre: 'desc' };
  const LIMITE = 25;
  const { barre, compteur } = creerBarreListe('Rechercher une source…', valeur => { recherche = valeur; page = 1; void charger(); });
  const zone = creerElement('div', { classes: ['admin-table-zone'] });
  vider(contenu);
  contenu.append(barre, zone);

  const charger = async (): Promise<void> => {
    try {
      const resultat = await admin.listerSources({ page, limite: LIMITE, recherche: recherche || undefined, ...tri });
      compteur.textContent = `${formatNombre(resultat.total)} source${resultat.total > 1 ? 's' : ''}`;
      vider(zone);
      zone.append(
        creerTableSources(resultat.donnees, charger, tri, nouveau => { tri = nouveau; page = 1; void charger(); }),
        creerPagination(page, resultat.total, LIMITE, p => { page = p; void charger(); }),
      );
    } catch {
      vider(zone);
      zone.append(creerErreur('Impossible de charger les sources', () => void charger()));
    }
  };
  await charger();
}

const VARIANTE_STATUT: Record<string, string> = { active: 'success', erreur: 'danger', inactive: 'secondary' };
const LIBELLE_STATUT: Record<string, string> = { active: 'active', erreur: 'en erreur', inactive: 'inactive' };

const COLONNES_SOURCES: ColonneTriable[] = [
  { cle: 'nom', libelle: 'Source' },
  { cle: 'typeSource', libelle: 'Type' },
  { cle: 'statut', libelle: 'Statut' },
  { cle: 'nombreEchecs', libelle: 'Échecs', numerique: true },
  { cle: 'abonnes', libelle: 'Abonnés', numerique: true },
  { cle: 'articles', libelle: 'Articles', numerique: true },
  { cle: 'dateDerniereSynchro', libelle: 'Dernière synchro' },
  { libelle: 'Actions' },
];

function creerTableSources(sources: SourceAdmin[], rafraichir: () => Promise<void>, tri: EtatTri, onTri: (tri: EtatTri) => void): HTMLElement {
  const enveloppe = creerElement('div', { classes: ['admin-table'] });
  const table = creerElement('table', { classes: ['la-table'] });
  table.append(creerEnteteTriable(COLONNES_SOURCES, tri, onTri));
  const corps = creerElement('tbody');
  for (const source of sources) {
    const tr = creerElement('tr', { classes: [source.statut === 'erreur' ? 'en-erreur' : ''] });
    const cellule = creerElement('td', { classes: ['admin-cellule-source'] });
    const favicon = urlFaviconLocale(source);
    if (favicon) cellule.append(creerElement('img', { classes: ['admin-favicon'], attrs: { src: favicon, alt: '', width: '16', height: '16', loading: 'lazy' } }));
    const infos = creerElement('span', { classes: ['admin-source-infos'] });
    infos.append(creerElement('span', { classes: ['admin-source-nom'], texte: source.nom }), creerElement('a', { classes: ['admin-source-url'], attrs: { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, texte: source.url.replace(/^https?:\/\//, '') }));
    cellule.append(infos);
    tr.append(cellule);
    tr.append(creerElement('td', { texte: LIBELLES_TYPE_SOURCE[source.typeSource] ?? source.typeSource }));
    tr.append(creerElement('td', { enfants: [badge(LIBELLE_STATUT[source.statut] ?? source.statut, VARIANTE_STATUT[source.statut] ?? 'secondary')] }));
    tr.append(creerElement('td', { classes: ['num', source.nombreEchecs > 0 ? 'alerte' : ''], texte: String(source.nombreEchecs) }));
    tr.append(creerElement('td', { classes: ['num'], texte: formatNombre(source.abonnes) }));
    tr.append(creerElement('td', { classes: ['num'], texte: formatNombre(source.articles) }));
    tr.append(creerElement('td', { texte: source.dateDerniereSynchro ? formatDateRelative(source.dateDerniereSynchro) : 'jamais' }));

    const actions = creerElement('td', { classes: ['admin-actions'] });
    const btnSync = creerElement('button', {
      classes: ['la-btn', 'ghost', 'sm', 'icon-only'],
      attrs: { type: 'button', title: 'Synchroniser maintenant', 'aria-label': `Synchroniser ${source.nom}` },
      icone: 'sync',
      onClick: async () => {
        try {
          await admin.synchroniserSource(source.id);
          toast.succes(`Synchronisation de ${source.nom} lancée`);
        } catch (erreur) {
          toast.erreur(messageErreur(erreur, 'Impossible de lancer la synchronisation'));
        }
      },
    });
    const activer = source.statut !== 'active';
    const btnStatut = creerElement('button', {
      classes: ['la-btn', 'ghost', 'sm', 'icon-only'],
      attrs: { type: 'button', title: activer ? 'Réactiver la source' : 'Désactiver la source', 'aria-label': `${activer ? 'Réactiver' : 'Désactiver'} ${source.nom}` },
      icone: activer ? 'play_circle' : 'pause_circle',
      onClick: async () => {
        try {
          await admin.modifierSource(source.id, activer ? 'active' : 'inactive');
          toast.succes(activer ? `${source.nom} réactivée, échecs remis à zéro` : `${source.nom} désactivée`);
          await rafraichir();
        } catch (erreur) {
          toast.erreur(messageErreur(erreur, 'Impossible de modifier la source'));
        }
      },
    });
    actions.append(btnSync, btnStatut);
    tr.append(actions);
    corps.append(tr);
  }
  if (sources.length === 0) {
    corps.append(creerElement('tr', { enfants: [creerElement('td', { attrs: { colspan: '8' }, classes: ['admin-vide'], texte: 'Aucune source ne correspond.' })] }));
  }
  table.append(corps);
  enveloppe.append(table);
  return enveloppe;
}

// ============================================
// Système
// ============================================

export async function afficherSysteme(contenu: HTMLElement): Promise<void> {
  let etat: EtatSysteme;
  try {
    etat = await admin.systeme();
  } catch {
    vider(contenu);
    contenu.append(creerErreur('Impossible de lire l\'état du système', () => void afficherSysteme(contenu)));
    return;
  }
  vider(contenu);
  const barre = creerElement('div', { classes: ['admin-barre'] });
  barre.append(
    creerElement('span', { classes: ['admin-compteur'], texte: `Relevé à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` }),
    creerElement('button', { classes: ['la-btn', 'ghost', 'sm'], attrs: { type: 'button' }, icone: 'refresh', texte: 'Actualiser', onClick: () => { vider(contenu); contenu.append(creerChargement()); void afficherSysteme(contenu); } }),
  );
  const grille = creerElement('div', { classes: ['admin-kpis'] });
  grille.append(
    creerKpi('new_releases', `v${etat.version}`, 'Veilleur', `Node ${etat.node}`),
    creerKpi('schedule', formatDuree(etat.uptimeSecondes), 'En service depuis', 'Redémarrage du processus serveur'),
    creerKpi('memory', formatOctets(etat.memoire.rss), 'Mémoire du processus', `${formatOctets(etat.memoire.heapUtilise)} de tas JavaScript utilisé`),
    creerKpi(etat.redis.ok ? 'check_circle' : 'error', etat.redis.ok ? 'En ligne' : 'Injoignable', 'Redis', etat.redis.memoireOctets !== null ? `${formatOctets(etat.redis.memoireOctets)} occupés` : 'Cache, sessions et files d\'attente'),
    creerKpi('storage', formatOctets(etat.baseDonnees.octets), 'Base de données', 'Données et index MariaDB'),
  );
  const carte = creerElement('section', { classes: ['admin-carte', 'la-card', 'large'] });
  carte.append(creerElement('header', { classes: ['admin-carte-entete'], enfants: [creerElement('h2', { classes: ['admin-carte-titre'], texte: 'Files d\'attente' }), creerElement('span', { classes: ['admin-carte-indication'], texte: 'Travaux BullMQ : synchronisation des sources et cache des images' })] }));
  const table = creerElement('table', { classes: ['la-table'] });
  table.innerHTML = '<thead><tr><th>File</th><th class="num">En attente</th><th class="num">En cours</th><th class="num">Différés</th><th class="num">Terminés</th><th class="num">Échoués</th></tr></thead>';
  const corps = creerElement('tbody');
  const noms: Record<string, string> = { synchro: 'Synchronisation', images: 'Images' };
  for (const [cle, f] of Object.entries(etat.files)) {
    const tr = creerElement('tr');
    tr.append(creerElement('td', { texte: noms[cle] ?? cle }));
    for (const valeur of [f.attente, f.actifs, f.differes, f.termines, f.echoues]) tr.append(creerElement('td', { classes: ['num'], texte: formatNombre(valeur) }));
    corps.append(tr);
  }
  table.append(corps);
  carte.append(creerElement('div', { classes: ['admin-table'], enfants: [table] }));
  contenu.append(barre, grille, carte);
}
