/**
 * Veilleur - Version de l'application
 * Lue depuis package.json (répertoire de travail) : source unique de vérité,
 * valable en développement (tsx), en production (bundle) et dans les tests.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const VERSION_INCONNUE = '0.0.0';

/**
 * Lit la version déclarée dans le package.json du répertoire de travail
 */
export function lireVersion(cheminPackage: string = resolve('package.json')): string {
  try {
    const contenu = JSON.parse(readFileSync(cheminPackage, 'utf-8')) as { version?: unknown };
    return typeof contenu.version === 'string' && contenu.version.length > 0
      ? contenu.version
      : VERSION_INCONNUE;
  } catch {
    return VERSION_INCONNUE;
  }
}

/** Version courante de Veilleur */
export const VERSION = lireVersion();
