/**
 * Veilleur - Gamification : points, niveaux, badges et série de lecture
 * Tout se déduit de l'activité réelle (lectures, notes, favoris, sources…) : aucune table d'événements.
 */

import type {
  DepotStatistiquesUtilisateur,
  ParticipantClassement,
  StatistiquesUtilisateur,
} from '@/domaine/ports/DepotStatistiquesUtilisateur';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE } from '@/domaine/ports/ServiceCache';

export interface Niveau {
  numero: number;
  nom: string;
  seuil: number;
  /** Seuil du niveau suivant, null au dernier niveau */
  prochainSeuil: number | null;
  /** Avancement vers le niveau suivant, 0-100 */
  progression: number;
}

export interface Badge {
  code: string;
  nom: string;
  description: string;
  icone: string;
  obtenu: boolean;
  /** Avancement vers le badge, 0-100 */
  progression: number;
}

export interface Serie {
  courante: number;
  record: number;
  /** Lecture faite aujourd'hui (la série ne risque rien) */
  activeAujourdhui: boolean;
}

export interface DetailPoints {
  libelle: string;
  nombre: number;
  parUnite: number;
  total: number;
}

export interface Progression {
  points: number;
  detail: DetailPoints[];
  niveau: Niveau;
  badges: Badge[];
  serie: Serie;
  statistiques: StatistiquesUtilisateur;
}

export interface LigneClassement {
  rang: number;
  pseudo: string;
  points: number;
  niveau: string;
  badges: number;
  serie: number;
}

export const POINTS = {
  articleLu: 1,
  articleNote: 3,
  favori: 2,
  aLire: 1,
  source: 5,
  rubrique: 2,
  jourDeLecture: 3,
} as const;

export const NIVEAUX: { nom: string; seuil: number }[] = [
  { nom: 'Éclaireur', seuil: 0 },
  { nom: 'Lecteur', seuil: 50 },
  { nom: 'Veilleur', seuil: 200 },
  { nom: 'Sentinelle', seuil: 500 },
  { nom: 'Vigie', seuil: 1200 },
  { nom: 'Oracle', seuil: 3000 },
];

interface DefinitionBadge {
  code: string;
  nom: string;
  description: string;
  icone: string;
  /** Valeur courante et objectif ; obtenu quand valeur ≥ objectif */
  mesure: (s: StatistiquesUtilisateur, serie: Serie) => [number, number];
}

const BADGES: DefinitionBadge[] = [
  { code: 'premiere-lecture', nom: 'Première lecture', description: 'Lire un premier article', icone: 'auto_stories', mesure: s => [s.articlesLus, 1] },
  { code: 'lecteur-assidu', nom: 'Lecteur assidu', description: 'Lire 100 articles', icone: 'menu_book', mesure: s => [s.articlesLus, 100] },
  { code: 'devoreur', nom: 'Dévoreur', description: 'Lire 1 000 articles', icone: 'local_library', mesure: s => [s.articlesLus, 1000] },
  { code: 'critique', nom: 'Critique', description: 'Noter 25 articles', icone: 'star', mesure: s => [s.articlesNotes, 25] },
  { code: 'collectionneur', nom: 'Collectionneur', description: 'Mettre 20 articles en favoris', icone: 'favorite', mesure: s => [s.favoris, 20] },
  { code: 'curieux', nom: 'Curieux', description: 'Suivre 10 sources', icone: 'rss_feed', mesure: s => [s.sources, 10] },
  { code: 'encyclopediste', nom: 'Encyclopédiste', description: 'Suivre 30 sources', icone: 'public', mesure: s => [s.sources, 30] },
  { code: 'archiviste', nom: 'Archiviste', description: 'Classer ses sources en 5 rubriques', icone: 'label', mesure: s => [s.rubriques, 5] },
  { code: 'leve-tot', nom: 'Lève-tôt', description: 'Lire 10 articles avant 8 h', icone: 'wb_twilight', mesure: s => [s.lecturesAvant8h, 10] },
  { code: 'marathon', nom: 'Marathon', description: 'Lire 30 articles en une journée', icone: 'directions_run', mesure: s => [s.maxLecturesParJour, 30] },
  { code: 'regulier', nom: 'Régulier', description: 'Lire 7 jours d\'affilée', icone: 'calendar_month', mesure: (_s, serie) => [serie.record, 7] },
  { code: 'inarretable', nom: 'Inarrêtable', description: 'Lire 30 jours d\'affilée', icone: 'local_fire_department', mesure: (_s, serie) => [serie.record, 30] },
];

const CACHE_CLASSEMENT_S = 600;
const CLASSEMENT_TAILLE = 20;

function jourIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function jourPrecedent(jour: string): string {
  const date = new Date(`${jour}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return jourIso(date);
}

/**
 * Série de jours consécutifs avec lecture ; la série courante tient encore si la dernière lecture date d'hier
 */
export function calculerSerie(joursLecture: string[], aujourdhui: Date = new Date()): Serie {
  const jours = new Set(joursLecture);
  const jourCourant = jourIso(aujourdhui);
  const activeAujourdhui = jours.has(jourCourant);

  let courante = 0;
  let curseur = activeAujourdhui ? jourCourant : jourPrecedent(jourCourant);
  while (jours.has(curseur)) {
    courante += 1;
    curseur = jourPrecedent(curseur);
  }

  let record = 0;
  for (const jour of jours) {
    if (jours.has(jourPrecedent(jour))) continue; // pas un début de série
    let longueur = 0;
    let suivant = jour;
    while (jours.has(suivant)) {
      longueur += 1;
      const date = new Date(`${suivant}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      suivant = jourIso(date);
    }
    record = Math.max(record, longueur);
  }
  return { courante, record: Math.max(record, courante), activeAujourdhui };
}

export function calculerPoints(s: StatistiquesUtilisateur): { points: number; detail: DetailPoints[] } {
  const detail: DetailPoints[] = [
    { libelle: 'Articles lus', nombre: s.articlesLus, parUnite: POINTS.articleLu, total: 0 },
    { libelle: 'Articles notés', nombre: s.articlesNotes, parUnite: POINTS.articleNote, total: 0 },
    { libelle: 'Favoris', nombre: s.favoris, parUnite: POINTS.favori, total: 0 },
    { libelle: 'À lire plus tard', nombre: s.aLire, parUnite: POINTS.aLire, total: 0 },
    { libelle: 'Sources suivies', nombre: s.sources, parUnite: POINTS.source, total: 0 },
    { libelle: 'Rubriques', nombre: s.rubriques, parUnite: POINTS.rubrique, total: 0 },
    { libelle: 'Jours de lecture', nombre: s.joursLecture.length, parUnite: POINTS.jourDeLecture, total: 0 },
  ].map(ligne => ({ ...ligne, total: ligne.nombre * ligne.parUnite }));
  return { points: detail.reduce((somme, ligne) => somme + ligne.total, 0), detail };
}

export function calculerNiveau(points: number): Niveau {
  let index = 0;
  for (let i = 0; i < NIVEAUX.length; i++) {
    if (points >= NIVEAUX[i]!.seuil) index = i;
  }
  const courant = NIVEAUX[index]!;
  const suivant = NIVEAUX[index + 1];
  const progression = suivant
    ? Math.min(100, Math.floor(((points - courant.seuil) / (suivant.seuil - courant.seuil)) * 100))
    : 100;
  return { numero: index + 1, nom: courant.nom, seuil: courant.seuil, prochainSeuil: suivant?.seuil ?? null, progression };
}

export function calculerBadges(s: StatistiquesUtilisateur, serie: Serie): Badge[] {
  return BADGES.map(def => {
    const [valeur, objectif] = def.mesure(s, serie);
    return {
      code: def.code,
      nom: def.nom,
      description: def.description,
      icone: def.icone,
      obtenu: valeur >= objectif,
      progression: Math.min(100, Math.floor((valeur / objectif) * 100)),
    };
  });
}

export function calculerProgression(statistiques: StatistiquesUtilisateur, aujourdhui: Date = new Date()): Progression {
  const { points, detail } = calculerPoints(statistiques);
  const serie = calculerSerie(statistiques.joursLecture, aujourdhui);
  return {
    points,
    detail,
    niveau: calculerNiveau(points),
    badges: calculerBadges(statistiques, serie),
    serie,
    statistiques,
  };
}

export class ServiceGamification {
  constructor(
    private readonly depotStatistiques: DepotStatistiquesUtilisateur,
    private readonly serviceCache?: Pick<ServiceCache, 'obtenir' | 'stocker'>,
  ) {}

  async obtenirProgression(utilisateurId: string, aujourdhui: Date = new Date()): Promise<Progression | null> {
    const statistiques = await this.depotStatistiques.obtenir(utilisateurId);
    return statistiques ? calculerProgression(statistiques, aujourdhui) : null;
  }

  /**
   * Classement des volontaires, par points ; en cache dix minutes
   */
  async obtenirClassement(aujourdhui: Date = new Date()): Promise<LigneClassement[]> {
    const cle = `${PREFIXES_CACHE.UTILISATEUR}classement`;
    const enCache = await this.serviceCache?.obtenir<LigneClassement[]>(cle);
    if (enCache) return enCache;
    const participants = await this.depotStatistiques.listerParticipantsClassement();
    const classement = ServiceGamification.classer(participants, aujourdhui);
    await this.serviceCache?.stocker(cle, classement, { ttl: CACHE_CLASSEMENT_S });
    return classement;
  }

  static classer(participants: ParticipantClassement[], aujourdhui: Date = new Date()): LigneClassement[] {
    return participants
      .map(p => {
        const progression = calculerProgression(p.statistiques, aujourdhui);
        return {
          pseudo: p.pseudo,
          points: progression.points,
          niveau: progression.niveau.nom,
          badges: progression.badges.filter(b => b.obtenu).length,
          serie: progression.serie.courante,
        };
      })
      .sort((a, b) => b.points - a.points || b.badges - a.badges || a.pseudo.localeCompare(b.pseudo, 'fr'))
      .slice(0, CLASSEMENT_TAILLE)
      .map((ligne, index) => ({ rang: index + 1, ...ligne }));
  }
}
