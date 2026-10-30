/**
 * Veilleur - Promotion d'un compte au rôle administrateur (secours en ligne de commande)
 *
 * Usage : node dist/promouvoir-admin.js utilisateur@exemple.org
 */

import { pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';
import { creerConnexion, fermerConnexion, obtenirBdd } from '../persistence/connexion';
import { utilisateurs } from '../persistence/schema';

/**
 * Passe le compte au rôle admin ; retourne false si l'adresse est inconnue
 */
export async function promouvoirAdmin(email: string): Promise<boolean> {
  const db = obtenirBdd();
  const [compte] = await db.select({ id: utilisateurs.id, role: utilisateurs.role }).from(utilisateurs).where(eq(utilisateurs.email, email.toLowerCase())).limit(1);
  if (!compte) return false;
  if (compte.role !== 'admin') {
    await db.update(utilisateurs).set({ role: 'admin' }).where(eq(utilisateurs.id, compte.id));
  }
  return true;
}

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage : node dist/promouvoir-admin.js <email>');
    process.exit(2);
  }
  await creerConnexion();
  try {
    const trouve = await promouvoirAdmin(email);
    if (!trouve) {
      console.error(`Aucun compte pour ${email}`);
      process.exitCode = 1;
    } else {
      console.error(`${email} est administrateur`);
    }
  } finally {
    await fermerConnexion();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(erreur => {
    console.error(erreur);
    process.exit(1);
  });
}
