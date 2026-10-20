/**
 * Veilleur - Export CSV
 * Format RFC 4180 : séparateur « ; » (Excel francophone), champs cités quand nécessaire, BOM UTF-8.
 */

export const SEPARATEUR_CSV = ';';
// Marque d'ordre d'octets : Excel reconnaît ainsi l'UTF-8
const BOM_UTF8 = '\uFEFF';

/**
 * Cite un champ si besoin (séparateur, guillemet, retour à la ligne) ; null/undefined → vide
 */
export function citerChampCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '';
  const texte = valeur instanceof Date ? valeur.toISOString() : String(valeur);
  if (/[";\n\r]/.test(texte)) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

/**
 * Sérialise des lignes en CSV ; `colonnes` fixe l'ordre et l'en-tête
 */
export function formaterCsv<T extends Record<string, unknown>>(lignes: T[], colonnes: (keyof T & string)[]): string {
  const entete = colonnes.map(citerChampCsv).join(SEPARATEUR_CSV);
  const corps = lignes.map(ligne => colonnes.map(colonne => citerChampCsv(ligne[colonne])).join(SEPARATEUR_CSV));
  return `${BOM_UTF8}${[entete, ...corps].join('\r\n')}\r\n`;
}
