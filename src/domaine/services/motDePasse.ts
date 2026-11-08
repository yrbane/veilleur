/**
 * Veilleur - Hachage et validation des mots de passe
 * Partagé par l'authentification et la réinitialisation (mot de passe oublié)
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, ScryptOptions } from 'crypto';

/**
 * Wrapper promisifié de scrypt avec support des options
 */
function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options?: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options ?? {}, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Paramètres de scrypt pour le hachage sécurisé
 * N=16384 (2^14), r=8, p=1 - recommandé par OWASP
 * keylen=64 octets pour une sécurité post-quantique
 */
const SCRYPT_PARAMS = {
  N: 16384,        // Coût CPU (mémoire = 128 * N * r octets)
  r: 8,            // Taille de bloc
  p: 1,            // Parallélisme
  keylen: 64,      // Longueur de la clé dérivée
  saltlen: 32,     // Longueur du sel (256 bits)
};

/**
 * Règles de validation du mot de passe
 */
const REGLES_MOT_DE_PASSE = {
  longueurMin: 8,
  longueurMax: 128,
  requiertMajuscule: true,
  requiertMinuscule: true,
  requiertChiffre: true,
  requiertSpecial: true,
};

/**
 * Valide la force d'un mot de passe
 */
export function validerForceMotDePasse(motDePasse: string): { valide: boolean; erreurs: string[] } {
  const erreurs: string[] = [];

  if (motDePasse.length < REGLES_MOT_DE_PASSE.longueurMin) {
    erreurs.push(`Le mot de passe doit contenir au moins ${REGLES_MOT_DE_PASSE.longueurMin} caractères`);
  }

  if (motDePasse.length > REGLES_MOT_DE_PASSE.longueurMax) {
    erreurs.push(`Le mot de passe ne doit pas dépasser ${REGLES_MOT_DE_PASSE.longueurMax} caractères`);
  }

  if (REGLES_MOT_DE_PASSE.requiertMajuscule && !/[A-Z]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins une majuscule');
  }

  if (REGLES_MOT_DE_PASSE.requiertMinuscule && !/[a-z]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins une minuscule');
  }

  if (REGLES_MOT_DE_PASSE.requiertChiffre && !/[0-9]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins un chiffre');
  }

  if (REGLES_MOT_DE_PASSE.requiertSpecial && !/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~';]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins un caractère spécial');
  }

  return { valide: erreurs.length === 0, erreurs };
}

/**
 * Hash un mot de passe avec scrypt (paramètres OWASP)
 * Format: version:N:r:p:sel:hash
 */
export async function hasherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(SCRYPT_PARAMS.saltlen).toString('hex');
  const hash = await scryptAsync(motDePasse, sel, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  // Format versionné pour permettre les upgrades futurs
  return `v2:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${sel}:${hash.toString('hex')}`;
}

/**
 * Vérifie un mot de passe contre son hash
 * Supporte l'ancien format (sel:hash) et le nouveau (v2:N:r:p:sel:hash)
 */
export async function verifierMotDePasse(motDePasse: string, hash: string): Promise<boolean> {
  const parts = hash.split(':');

  // Nouveau format v2: version:N:r:p:sel:hash
  if (parts[0] === 'v2' && parts.length === 6) {
    const [, nStr, rStr, pStr, sel, hashStocke] = parts;
    const N = parseInt(nStr!, 10);
    const r = parseInt(rStr!, 10);
    const p = parseInt(pStr!, 10);

    if (!sel || !hashStocke || isNaN(N) || isNaN(r) || isNaN(p)) {
      return false;
    }

    const hashCalcule = await scryptAsync(motDePasse, sel, SCRYPT_PARAMS.keylen, { N, r, p });
    const hashStockeBuffer = Buffer.from(hashStocke, 'hex');

    if (hashCalcule.length !== hashStockeBuffer.length) {
      return false;
    }

    return timingSafeEqual(hashCalcule, hashStockeBuffer);
  }

  // Ancien format: sel:hash (rétrocompatibilité)
  if (parts.length === 2) {
    const [sel, hashStocke] = parts;
    if (!sel || !hashStocke) {
      return false;
    }
    const hashCalcule = await scryptAsync(motDePasse, sel, 64);
    const hashStockeBuffer = Buffer.from(hashStocke, 'hex');

    if (hashCalcule.length !== hashStockeBuffer.length) {
      return false;
    }

    return timingSafeEqual(hashCalcule, hashStockeBuffer);
  }

  return false;
}
