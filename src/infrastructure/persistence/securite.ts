/**
 * Veilleur - Utilitaires de sécurité pour les requêtes SQL
 * Protection contre les injections et caractères spéciaux
 */

/**
 * Échappe les caractères spéciaux LIKE (%, _, \) dans une chaîne
 * pour éviter les attaques par injection de pattern LIKE.
 *
 * @example
 * // Un utilisateur malveillant saisit "%" pour voir toutes les données
 * const recherche = echapperLike("%"); // Retourne "\\%"
 *
 * @param valeur - La chaîne à échapper
 * @returns La chaîne avec les caractères LIKE échappés
 */
export function echapperLike(valeur: string): string {
  return valeur
    .replace(/\\/g, '\\\\') // Échapper backslash en premier
    .replace(/%/g, '\\%')   // Échapper le wildcard %
    .replace(/_/g, '\\_');  // Échapper le wildcard _
}

/**
 * Construit un pattern LIKE sécurisé pour une recherche partielle
 *
 * @param recherche - Le terme de recherche utilisateur
 * @param position - Position du wildcard: 'start' (%term), 'end' (term%), 'both' (%term%)
 * @returns Le pattern LIKE sécurisé
 */
export function construirePatternLike(
  recherche: string,
  position: 'start' | 'end' | 'both' = 'both',
): string {
  const rechercheSecurisee = echapperLike(recherche);

  switch (position) {
    case 'start':
      return `%${rechercheSecurisee}`;
    case 'end':
      return `${rechercheSecurisee}%`;
    case 'both':
    default:
      return `%${rechercheSecurisee}%`;
  }
}

/**
 * Valide et nettoie un identifiant CUID2
 * Rejette les identifiants qui ne correspondent pas au format attendu
 *
 * @param id - L'identifiant à valider
 * @returns L'identifiant nettoyé ou null si invalide
 */
export function validerIdCuid(id: string): string | null {
  // CUID2 format: lettres minuscules et chiffres, longueur typique 24-25 caractères
  const cuidPattern = /^[a-z0-9]{20,30}$/;
  const idNettoye = id.trim().toLowerCase();

  if (!cuidPattern.test(idNettoye)) {
    return null;
  }

  return idNettoye;
}

/**
 * Nettoie une chaîne pour une utilisation sûre dans les logs
 * Évite les injections de logs et les caractères de contrôle
 *
 * @param valeur - La chaîne à nettoyer
 * @param longueurMax - Longueur maximum autorisée (défaut: 1000)
 * @returns La chaîne nettoyée
 */
export function nettoyerPourLogs(valeur: string, longueurMax = 1000): string {
  return valeur
    // Supprimer les caractères de contrôle (sauf newline et tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Limiter la longueur
    .substring(0, longueurMax)
    // Supprimer les retours à la ligne potentiellement dangereux pour les logs
    .replace(/[\r\n]/g, ' ');
}

/**
 * Valide une adresse email
 *
 * @param email - L'email à valider
 * @returns true si l'email est valide
 */
export function validerEmail(email: string): boolean {
  // Pattern RFC 5322 simplifié
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!email || email.length > 254) {
    return false;
  }

  return emailPattern.test(email);
}

/**
 * Limite la longueur d'une chaîne de recherche
 *
 * @param recherche - Le terme de recherche
 * @param longueurMax - Longueur maximum (défaut: 200)
 * @returns Le terme de recherche tronqué si nécessaire
 */
export function limiterRecherche(recherche: string, longueurMax = 200): string {
  return recherche.trim().substring(0, longueurMax);
}
