/**
 * Veilleur - Chiffrement des variables d'environnement
 * Permet de stocker des secrets chiffrés dans les fichiers .env
 *
 * Format des valeurs chiffrées: ENC[version:iv:ciphertext:authTag]
 * Utilise AES-256-GCM pour le chiffrement authentifié
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Configuration du chiffrement
 */
const CONFIG = {
  // Algorithme de chiffrement
  algorithme: 'aes-256-gcm' as const,
  // Longueur de la clé en octets (256 bits)
  longueurCle: 32,
  // Longueur de l'IV en octets
  longueurIv: 12,
  // Longueur du tag d'authentification en octets
  longueurAuthTag: 16,
  // Version actuelle du format
  version: 1,
  // Préfixe des valeurs chiffrées
  prefixe: 'ENC[',
  // Suffixe des valeurs chiffrées
  suffixe: ']',
  // Paramètres scrypt pour dérivation de la clé master
  scrypt: {
    N: 16384,
    r: 8,
    p: 1,
  },
};

/**
 * Résultat du chiffrement
 */
interface ResultatChiffrement {
  version: number;
  iv: string;
  ciphertext: string;
  authTag: string;
}

/**
 * Dérive une clé de chiffrement à partir d'un mot de passe master
 *
 * @param masterPassword - Mot de passe master
 * @param salt - Sel (optionnel, généré si non fourni)
 * @returns Clé dérivée et sel utilisé
 */
export function derivierCle(
  masterPassword: string,
  salt?: Buffer,
): { cle: Buffer; sel: Buffer } {
  const sel = salt ?? randomBytes(16);

  const cle = scryptSync(masterPassword, sel, CONFIG.longueurCle, {
    N: CONFIG.scrypt.N,
    r: CONFIG.scrypt.r,
    p: CONFIG.scrypt.p,
  });

  return { cle, sel };
}

/**
 * Chiffre une valeur avec AES-256-GCM
 *
 * @param valeur - Valeur à chiffrer
 * @param cle - Clé de chiffrement (32 octets)
 * @returns Résultat du chiffrement
 */
export function chiffrer(valeur: string, cle: Buffer): ResultatChiffrement {
  const iv = randomBytes(CONFIG.longueurIv);
  const cipher = createCipheriv(CONFIG.algorithme, cle, iv);

  const encrypted = Buffer.concat([
    cipher.update(valeur, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: CONFIG.version,
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Déchiffre une valeur chiffrée avec AES-256-GCM
 *
 * @param resultat - Résultat du chiffrement
 * @param cle - Clé de chiffrement (32 octets)
 * @returns Valeur déchiffrée
 */
export function dechiffrer(resultat: ResultatChiffrement, cle: Buffer): string {
  const iv = Buffer.from(resultat.iv, 'base64');
  const ciphertext = Buffer.from(resultat.ciphertext, 'base64');
  const authTag = Buffer.from(resultat.authTag, 'base64');

  const decipher = createDecipheriv(CONFIG.algorithme, cle, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Formate un résultat de chiffrement en chaîne pour stockage
 *
 * @param resultat - Résultat du chiffrement
 * @returns Chaîne formatée ENC[version:iv:ciphertext:authTag]
 */
export function formaterValeurChiffree(resultat: ResultatChiffrement): string {
  return `${CONFIG.prefixe}${resultat.version}:${resultat.iv}:${resultat.ciphertext}:${resultat.authTag}${CONFIG.suffixe}`;
}

/**
 * Parse une chaîne de valeur chiffrée
 *
 * @param valeurChiffree - Chaîne formatée ENC[version:iv:ciphertext:authTag]
 * @returns Résultat du chiffrement ou null si format invalide
 */
export function parserValeurChiffree(valeurChiffree: string): ResultatChiffrement | null {
  if (!valeurChiffree.startsWith(CONFIG.prefixe) || !valeurChiffree.endsWith(CONFIG.suffixe)) {
    return null;
  }

  const contenu = valeurChiffree.slice(CONFIG.prefixe.length, -CONFIG.suffixe.length);
  const parties = contenu.split(':');

  if (parties.length !== 4) {
    return null;
  }

  const [versionStr, iv, ciphertext, authTag] = parties;
  const version = parseInt(versionStr ?? '', 10);

  if (isNaN(version) || !iv || !ciphertext || !authTag) {
    return null;
  }

  return { version, iv, ciphertext, authTag };
}

/**
 * Vérifie si une valeur est chiffrée
 *
 * @param valeur - Valeur à vérifier
 * @returns true si la valeur est au format chiffré
 */
export function estValeurChiffree(valeur: string): boolean {
  return valeur.startsWith(CONFIG.prefixe) && valeur.endsWith(CONFIG.suffixe);
}

/**
 * Chiffre une valeur et retourne la chaîne formatée
 *
 * @param valeur - Valeur à chiffrer
 * @param masterPassword - Mot de passe master
 * @param sel - Sel pour la dérivation de clé (optionnel)
 * @returns Valeur chiffrée formatée
 */
export function chiffrerValeurEnv(valeur: string, masterPassword: string, sel?: Buffer): string {
  const { cle } = derivierCle(masterPassword, sel);
  const resultat = chiffrer(valeur, cle);
  return formaterValeurChiffree(resultat);
}

/**
 * Déchiffre une valeur d'environnement
 *
 * @param valeurChiffree - Valeur chiffrée formatée
 * @param masterPassword - Mot de passe master
 * @param sel - Sel pour la dérivation de clé
 * @returns Valeur déchiffrée ou null si échec
 */
export function dechiffrerValeurEnv(
  valeurChiffree: string,
  masterPassword: string,
  sel: Buffer,
): string | null {
  const resultat = parserValeurChiffree(valeurChiffree);
  if (!resultat) {
    return null;
  }

  try {
    const { cle } = derivierCle(masterPassword, sel);
    return dechiffrer(resultat, cle);
  } catch (erreur) {
    logger.error({ erreur }, 'Erreur lors du déchiffrement de la variable d\'environnement');
    return null;
  }
}

/**
 * Traite les variables d'environnement et déchiffre celles qui sont chiffrées
 *
 * @param env - Objet de variables d'environnement
 * @param masterPassword - Mot de passe master
 * @param sel - Sel pour la dérivation de clé
 * @returns Objet avec les valeurs déchiffrées
 */
export function traiterEnvironnementChiffre(
  env: Record<string, string | undefined>,
  masterPassword: string,
  sel: Buffer,
): Record<string, string | undefined> {
  const resultat: Record<string, string | undefined> = {};
  let nbDechiffrees = 0;

  for (const [cle, valeur] of Object.entries(env)) {
    if (valeur && estValeurChiffree(valeur)) {
      const dechiffree = dechiffrerValeurEnv(valeur, masterPassword, sel);
      if (dechiffree !== null) {
        resultat[cle] = dechiffree;
        nbDechiffrees++;
      } else {
        logger.warn({ cle }, 'Impossible de déchiffrer la variable d\'environnement');
        resultat[cle] = valeur; // Garder la valeur originale en cas d'erreur
      }
    } else {
      resultat[cle] = valeur;
    }
  }

  if (nbDechiffrees > 0) {
    logger.info({ nbDechiffrees }, 'Variables d\'environnement déchiffrées');
  }

  return resultat;
}

/**
 * Génère un sel aléatoire pour le chiffrement
 * À stocker de manière sécurisée séparément du mot de passe master
 */
export function genererSel(): Buffer {
  return randomBytes(16);
}

/**
 * Exporte les utilitaires CLI pour chiffrer/déchiffrer les variables
 */
export const cli = {
  /**
   * Chiffre une valeur pour usage dans .env
   */
  chiffrer(valeur: string, masterPassword: string): { valeurChiffree: string; sel: string } {
    const sel = genererSel();
    const valeurChiffree = chiffrerValeurEnv(valeur, masterPassword, sel);
    return {
      valeurChiffree,
      sel: sel.toString('base64'),
    };
  },

  /**
   * Déchiffre une valeur du .env
   */
  dechiffrer(valeurChiffree: string, masterPassword: string, selBase64: string): string | null {
    const sel = Buffer.from(selBase64, 'base64');
    return dechiffrerValeurEnv(valeurChiffree, masterPassword, sel);
  },
};
