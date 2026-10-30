/**
 * Veilleur - Couleur des tags
 * Dérive une teinte stable du nom d'un tag : le nom normalisé est haché (FNV-1a), puis
 * projeté sur une roue de NOMBRE_TEINTES teintes régulièrement espacées à partir de la
 * teinte primaire du thème. Chroma et luminosité restent communs à tous les tags (CSS
 * `.tag-colore`), si bien que les couleurs sont variées mais harmonieuses, en clair
 * comme en sombre.
 */

/** Teinte primaire de Lunar Aurora (--la-hue-primary) : la roue part de là */
export const TEINTE_BASE = 262;

/** Nombre de teintes sur la roue (pas de 15°) */
export const NOMBRE_TEINTES = 24;

/** Classe CSS posée sur un élément coloré */
export const CLASSE_TAG_COLORE = 'tag-colore';

/** Nom de la variable CSS portant la teinte */
export const VARIABLE_TEINTE = '--tag-teinte';

/** Minuscules, sans accents ni espaces superflus : « Écologie » et « ecologie » partagent une teinte */
export function normaliserNomTag(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Hachage FNV-1a 32 bits, suffisant pour répartir des noms courts */
function hacher(texte: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    hash ^= texte.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Teinte oklch (0 ≤ teinte < 360) attribuée à un tag d'après son nom */
export function teinteTag(nom: string): number {
  const normalise = normaliserNomTag(nom);
  if (normalise === '') return TEINTE_BASE;
  const pas = 360 / NOMBRE_TEINTES;
  return (TEINTE_BASE + (hacher(normalise) % NOMBRE_TEINTES) * pas) % 360;
}

/** Pose la classe et la variable CSS de teinte sur l'élément, qui est retourné pour chaîner */
export function colorerTag<T extends HTMLElement>(element: T, nom: string): T {
  element.classList.add(CLASSE_TAG_COLORE);
  element.style.setProperty(VARIABLE_TEINTE, String(teinteTag(nom)));
  return element;
}
