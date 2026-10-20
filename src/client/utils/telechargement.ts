/**
 * Veilleur - Téléchargement d'un fichier généré côté client
 */

/**
 * Déclenche l'enregistrement d'un contenu texte sous le nom donné
 */
export function telechargerFichier(contenu: string, nomFichier: string, typeMime: string): void {
  const blob = new Blob([contenu], { type: typeMime });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

/**
 * Suffixe du jour (AAAA-MM-JJ) pour nommer les exports
 */
export function suffixeDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0] ?? '';
}
