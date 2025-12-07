/**
 * Veilleur - Utilitaires de formatage
 * Formatage cohérent des dates, nombres et texte
 *
 * Fonctionnalités:
 * - Formatage de dates relatif et absolu
 * - Formatage de nombres (monnaie, pourcentage, abrégé)
 * - Manipulation de texte (troncature, slugify, pluriel)
 * - Formatage de durées et tailles de fichiers
 */

// ============================================================
// FORMATAGE DES DATES
// ============================================================

/**
 * Options de locale par défaut
 */
const LOCALE = 'fr-FR';

/**
 * Formatte une date en format relatif (il y a X minutes/heures/jours)
 */
export function formatageRelatif(
  date: Date | string | number,
  maintenant: Date = new Date(),
): string {
  const d = normaliserDate(date);
  const diff = maintenant.getTime() - d.getTime();
  const secondes = Math.floor(diff / 1000);
  const minutes = Math.floor(secondes / 60);
  const heures = Math.floor(minutes / 60);
  const jours = Math.floor(heures / 24);
  const semaines = Math.floor(jours / 7);
  const mois = Math.floor(jours / 30);
  const annees = Math.floor(jours / 365);

  if (secondes < 10) return 'à l\'instant';
  if (secondes < 60) return `il y a ${secondes} secondes`;
  if (minutes === 1) return 'il y a 1 minute';
  if (minutes < 60) return `il y a ${minutes} minutes`;
  if (heures === 1) return 'il y a 1 heure';
  if (heures < 24) return `il y a ${heures} heures`;
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;
  if (semaines === 1) return 'il y a 1 semaine';
  if (semaines < 4) return `il y a ${semaines} semaines`;
  if (mois === 1) return 'il y a 1 mois';
  if (mois < 12) return `il y a ${mois} mois`;
  if (annees === 1) return 'il y a 1 an';
  return `il y a ${annees} ans`;
}

/**
 * Formatte une date en format court (01/01/2024)
 */
export function formatageDateCourt(date: Date | string | number): string {
  return normaliserDate(date).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatte une date en format long (1 janvier 2024)
 */
export function formatageDateLong(date: Date | string | number): string {
  return normaliserDate(date).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formatte une date en format moyen (1 jan. 2024)
 */
export function formatageDateMoyen(date: Date | string | number): string {
  return normaliserDate(date).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formatte une date avec l'heure (01/01/2024 14:30)
 */
export function formatageDateHeure(date: Date | string | number): string {
  const d = normaliserDate(date);
  return `${formatageDateCourt(d)} ${formattageHeure(d)}`;
}

/**
 * Formatte l'heure (14:30)
 */
export function formattageHeure(date: Date | string | number): string {
  return normaliserDate(date).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatte pour attribut datetime HTML
 */
export function formatageDatetimeHtml(date: Date | string | number): string {
  return normaliserDate(date).toISOString();
}

/**
 * Normalise une date (string, number ou Date -> Date)
 */
function normaliserDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  return new Date(date);
}

// ============================================================
// FORMATAGE DES DURÉES
// ============================================================

/**
 * Formatte une durée en millisecondes
 */
export function formatageDuree(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const secondes = Math.floor(ms / 1000);
  const minutes = Math.floor(secondes / 60);
  const heures = Math.floor(minutes / 60);
  const jours = Math.floor(heures / 24);

  if (jours > 0) {
    const h = heures % 24;
    return h > 0 ? `${jours}j ${h}h` : `${jours}j`;
  }
  if (heures > 0) {
    const m = minutes % 60;
    return m > 0 ? `${heures}h ${m}min` : `${heures}h`;
  }
  if (minutes > 0) {
    const s = secondes % 60;
    return s > 0 ? `${minutes}min ${s}s` : `${minutes}min`;
  }
  return `${secondes}s`;
}

/**
 * Formatte une durée en format court (1:30:45)
 */
export function formatageDureeCourt(ms: number): string {
  const secondes = Math.floor(ms / 1000);
  const minutes = Math.floor(secondes / 60);
  const heures = Math.floor(minutes / 60);

  const s = (secondes % 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  const h = heures.toString();

  if (heures > 0) return `${h}:${m}:${s}`;
  return `${m}:${s}`;
}

// ============================================================
// FORMATAGE DES NOMBRES
// ============================================================

/**
 * Formatte un nombre avec séparateurs de milliers
 */
export function formatageNombre(n: number, decimales: number = 0): string {
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Formatte un nombre en format abrégé (1.2k, 3.4M)
 */
export function formatageNombreAbrege(n: number): string {
  const absN = Math.abs(n);

  if (absN >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}Md`;
  }
  if (absN >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (absN >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return n.toString();
}

/**
 * Formatte un pourcentage
 */
export function formatagePourcentage(
  n: number,
  decimales: number = 0,
): string {
  return n.toLocaleString(LOCALE, {
    style: 'percent',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Formatte un prix en euros
 */
export function formatageMonnaie(
  n: number,
  devise: string = 'EUR',
): string {
  return n.toLocaleString(LOCALE, {
    style: 'currency',
    currency: devise,
  });
}

/**
 * Formatte un nombre ordinal (1er, 2e, 3e...)
 */
export function formatageOrdinal(n: number): string {
  if (n === 1) return '1er';
  return `${n}e`;
}

// ============================================================
// FORMATAGE DES TAILLES DE FICHIERS
// ============================================================

const UNITES_TAILLE = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'];

/**
 * Formatte une taille de fichier en bytes
 */
export function formatageTaille(bytes: number, decimales: number = 1): string {
  if (bytes === 0) return '0 o';

  const k = 1024;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const valeur = bytes / Math.pow(k, i);

  return `${valeur.toFixed(decimales).replace(/\.0+$/, '')} ${UNITES_TAILLE[i]}`;
}

// ============================================================
// MANIPULATION DE TEXTE
// ============================================================

/**
 * Tronque un texte avec ellipsis
 */
export function tronquer(
  texte: string,
  longueurMax: number,
  suffixe: string = '…',
): string {
  if (texte.length <= longueurMax) return texte;
  return texte.slice(0, longueurMax - suffixe.length).trim() + suffixe;
}

/**
 * Tronque au dernier mot entier
 */
export function tronquerMot(
  texte: string,
  longueurMax: number,
  suffixe: string = '…',
): string {
  if (texte.length <= longueurMax) return texte;

  let tronque = texte.slice(0, longueurMax - suffixe.length);
  const dernierEspace = tronque.lastIndexOf(' ');

  if (dernierEspace > longueurMax * 0.5) {
    tronque = tronque.slice(0, dernierEspace);
  }

  return tronque.trim() + suffixe;
}

/**
 * Génère un slug URL-friendly
 */
export function slugify(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retire les accents
    .replace(/[^a-z0-9\s-]/g, '') // Retire les caractères spéciaux
    .replace(/\s+/g, '-') // Espaces -> tirets
    .replace(/-+/g, '-') // Tirets multiples -> unique
    .replace(/^-|-$/g, ''); // Retire tirets début/fin
}

/**
 * Met en majuscule la première lettre
 */
export function majuscule(texte: string): string {
  if (!texte) return texte;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Met en majuscule chaque mot
 */
export function majusculeChaqueMot(texte: string): string {
  return texte.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Formate un nom de variable en label lisible
 */
export function labeliser(texte: string): string {
  return texte
    .replace(/([A-Z])/g, ' $1') // camelCase -> camel Case
    .replace(/[_-]/g, ' ') // snake_case, kebab-case -> espaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Pluralise un mot selon le nombre
 */
export function pluriel(
  nombre: number,
  singulier: string,
  pluriel?: string,
): string {
  const pl = pluriel ?? `${singulier}s`;
  return nombre <= 1 ? singulier : pl;
}

/**
 * Formate un nombre avec son unité au pluriel
 */
export function avecUnite(
  nombre: number,
  singulier: string,
  plurielMot?: string,
): string {
  return `${formatageNombre(nombre)} ${pluriel(nombre, singulier, plurielMot)}`;
}

/**
 * Extrait les initiales d'un nom
 */
export function initiales(nom: string, max: number = 2): string {
  return nom
    .split(/\s+/)
    .map(mot => mot.charAt(0).toUpperCase())
    .slice(0, max)
    .join('');
}

/**
 * Retire les balises HTML
 */
export function sansBalisesHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Échappe les caractères HTML
 */
export function echapperHtml(texte: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#039;',
  };
  return texte.replace(/[&<>"']/g, char => map[char] ?? char);
}

/**
 * Formate une liste en texte (a, b et c)
 */
export function formatageListe(
  items: string[],
  conjonction: string = 'et',
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return items.join(` ${conjonction} `);

  const derniers = items.slice(-2);
  const premiers = items.slice(0, -2);
  return [...premiers, derniers.join(` ${conjonction} `)].join(', ');
}

// ============================================================
// FORMATAGE D'URLS
// ============================================================

/**
 * Extrait le domaine d'une URL
 */
export function extraireDomaine(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Formate une URL pour affichage (sans protocole ni www)
 */
export function formatageUrl(url: string, longueurMax?: number): string {
  let affichage = url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');

  if (longueurMax && affichage.length > longueurMax) {
    affichage = tronquer(affichage, longueurMax);
  }

  return affichage;
}

// ============================================================
// EXPORTS GROUPÉS
// ============================================================

export const format = {
  // Dates
  relatif: formatageRelatif,
  dateCourt: formatageDateCourt,
  dateLong: formatageDateLong,
  dateMoyen: formatageDateMoyen,
  dateHeure: formatageDateHeure,
  heure: formattageHeure,
  datetimeHtml: formatageDatetimeHtml,
  duree: formatageDuree,
  dureeCourt: formatageDureeCourt,

  // Nombres
  nombre: formatageNombre,
  nombreAbrege: formatageNombreAbrege,
  pourcentage: formatagePourcentage,
  monnaie: formatageMonnaie,
  ordinal: formatageOrdinal,
  taille: formatageTaille,

  // Texte
  tronquer,
  tronquerMot,
  slugify,
  majuscule,
  majusculeChaqueMot,
  labeliser,
  pluriel,
  avecUnite,
  initiales,
  sansBalisesHtml,
  echapperHtml,
  liste: formatageListe,

  // URLs
  domaine: extraireDomaine,
  url: formatageUrl,
};
