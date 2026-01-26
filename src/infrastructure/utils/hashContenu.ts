/**
 * Veilleur - Utilitaires de hashing pour détection de contenu dupliqué
 * Calcul optimisé de hash pour articles et contenus
 *
 * Fonctionnalités:
 * - Hash rapide xxHash pour comparaisons fréquentes
 * - Hash SHA-256 pour signatures sécurisées
 * - Normalisation du contenu avant hashing
 * - SimHash pour détection de similarité (near-duplicates)
 * - Cache de hash pour éviter recalculs
 */

import { createHash, Hash } from 'crypto';

/**
 * Configuration du hashing
 */
interface ConfigHash {
  // Normaliser le contenu avant hashing (retirer espaces multiples, etc.)
  normaliser?: boolean;
  // Convertir en minuscules
  minuscules?: boolean;
  // Retirer la ponctuation
  retirerPonctuation?: boolean;
  // Algorithme de hash
  algorithme?: 'sha256' | 'sha1' | 'md5' | 'xxhash';
}

const CONFIG_DEFAUT: Required<ConfigHash> = {
  normaliser: true,
  minuscules: true,
  retirerPonctuation: false,
  algorithme: 'sha256',
};

/**
 * Normalise le contenu pour un hashing cohérent
 */
export function normaliserContenu(
  contenu: string,
  options: Omit<ConfigHash, 'algorithme'> = {},
): string {
  const opts = { ...CONFIG_DEFAUT, ...options };
  let resultat = contenu;

  if (opts.normaliser) {
    // Retirer les espaces multiples
    resultat = resultat.replace(/\s+/g, ' ').trim();
    // Normaliser les retours à la ligne
    resultat = resultat.replace(/\r\n/g, '\n');
  }

  if (opts.minuscules) {
    resultat = resultat.toLowerCase();
  }

  if (opts.retirerPonctuation) {
    resultat = resultat.replace(/[^\w\s]/g, '');
  }

  return resultat;
}

/**
 * Calcule un hash SHA-256 du contenu
 */
export function hashSha256(contenu: string, options: ConfigHash = {}): string {
  const normalise = normaliserContenu(contenu, options);
  return createHash('sha256').update(normalise, 'utf8').digest('hex');
}

/**
 * Calcule un hash MD5 (plus rapide, moins sécurisé - pour déduplication uniquement)
 */
export function hashMd5(contenu: string, options: ConfigHash = {}): string {
  const normalise = normaliserContenu(contenu, options);
  return createHash('md5').update(normalise, 'utf8').digest('hex');
}

/**
 * Calcule un hash SHA-1 (compromis vitesse/sécurité)
 */
export function hashSha1(contenu: string, options: ConfigHash = {}): string {
  const normalise = normaliserContenu(contenu, options);
  return createHash('sha1').update(normalise, 'utf8').digest('hex');
}

/**
 * Hash rapide FNV-1a (non-cryptographique, très rapide)
 * Utilisé pour comparaisons rapides en mémoire
 */
export function hashFnv1a(contenu: string): number {
  let hash = 2166136261;
  for (let i = 0; i < contenu.length; i++) {
    hash ^= contenu.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // Force unsigned 32-bit
  }
  return hash;
}

/**
 * Hash rapide FNV-1a en string hexadécimal
 */
export function hashFnv1aHex(contenu: string, options: ConfigHash = {}): string {
  const normalise = normaliserContenu(contenu, options);
  return hashFnv1a(normalise).toString(16).padStart(8, '0');
}

/**
 * Calcule un hash générique selon l'algorithme spécifié
 */
export function calculerHash(contenu: string, options: ConfigHash = {}): string {
  const opts = { ...CONFIG_DEFAUT, ...options };

  switch (opts.algorithme) {
    case 'sha256':
      return hashSha256(contenu, options);
    case 'sha1':
      return hashSha1(contenu, options);
    case 'md5':
      return hashMd5(contenu, options);
    case 'xxhash':
      return hashFnv1aHex(contenu, options); // FNV-1a comme alternative à xxhash
    default:
      return hashSha256(contenu, options);
  }
}

/**
 * Hash incrémental pour grands contenus (streaming)
 */
export class HashIncrementel {
  private hash: Hash;
  private taille = 0;

  constructor(algorithme: 'sha256' | 'sha1' | 'md5' = 'sha256') {
    this.hash = createHash(algorithme);
  }

  /**
   * Ajoute du contenu au hash
   */
  ajouter(chunk: string | Buffer): this {
    this.hash.update(chunk);
    this.taille += typeof chunk === 'string' ? chunk.length : chunk.length;
    return this;
  }

  /**
   * Finalise et retourne le hash
   */
  finaliser(): string {
    return this.hash.digest('hex');
  }

  /**
   * Retourne la taille du contenu hashé
   */
  obtenirTaille(): number {
    return this.taille;
  }
}

/**
 * SimHash pour détection de similarité (near-duplicates)
 * Permet de détecter des contenus similaires même avec modifications mineures
 */
export function simHash(contenu: string, nbBits: number = 64): bigint {
  const normalise = normaliserContenu(contenu);
  const mots = normalise.split(/\s+/).filter(m => m.length > 2);

  // Vecteur de comptage
  const v = new Array(nbBits).fill(0);

  for (const mot of mots) {
    // Hash du mot
    const h = hashFnv1a(mot);

    // Mettre à jour le vecteur
    for (let i = 0; i < Math.min(nbBits, 32); i++) {
      if ((h >> i) & 1) {
        v[i]++;
      } else {
        v[i]--;
      }
    }
  }

  // Convertir en bits
  let hash = BigInt(0);
  for (let i = 0; i < nbBits; i++) {
    if (v[i] > 0) {
      hash |= BigInt(1) << BigInt(i);
    }
  }

  return hash;
}

/**
 * Calcule la distance de Hamming entre deux SimHash
 * Plus la distance est petite, plus les contenus sont similaires
 */
export function distanceHamming(hash1: bigint, hash2: bigint): number {
  let xor = hash1 ^ hash2;
  let distance = 0;

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
}

/**
 * Calcule le pourcentage de similarité entre deux contenus via SimHash
 * @returns Pourcentage de similarité (0-100)
 */
export function similarite(contenu1: string, contenu2: string, nbBits: number = 64): number {
  const hash1 = simHash(contenu1, nbBits);
  const hash2 = simHash(contenu2, nbBits);
  const distance = distanceHamming(hash1, hash2);
  return ((nbBits - distance) / nbBits) * 100;
}

/**
 * Vérifie si deux contenus sont similaires (seuil configurable)
 */
export function sontSimilaires(
  contenu1: string,
  contenu2: string,
  seuilPourcentage: number = 90,
): boolean {
  return similarite(contenu1, contenu2) >= seuilPourcentage;
}

/**
 * Hash pour article (combine titre + contenu)
 */
export interface HashArticle {
  hashComplet: string;    // Hash du titre + contenu complet
  hashTitre: string;      // Hash du titre seul
  hashContenu: string;    // Hash du contenu seul
  simHash: string;        // SimHash pour détection similarité
}

/**
 * Calcule les différents hash pour un article
 */
export function hasherArticle(
  titre: string,
  contenu: string,
  options: ConfigHash = {},
): HashArticle {
  const titreNormalise = normaliserContenu(titre, options);
  const contenuNormalise = normaliserContenu(contenu, options);

  return {
    hashComplet: hashSha256(`${titreNormalise}|${contenuNormalise}`, { normaliser: false }),
    hashTitre: hashMd5(titreNormalise, { normaliser: false }),
    hashContenu: hashSha256(contenuNormalise, { normaliser: false }),
    simHash: simHash(contenuNormalise).toString(16),
  };
}

/**
 * Cache de hash en mémoire pour éviter recalculs
 */
class CacheHash {
  private cache = new Map<string, string>();
  private readonly tailleMax: number;

  constructor(tailleMax: number = 10000) {
    this.tailleMax = tailleMax;
  }

  /**
   * Obtient un hash du cache ou le calcule
   */
  obtenir(
    contenu: string,
    calculateur: (c: string) => string,
  ): string {
    // Clé basée sur un hash rapide du contenu
    const cle = hashFnv1a(contenu).toString(16);

    if (this.cache.has(cle)) {
      return this.cache.get(cle)!;
    }

    const hash = calculateur(contenu);

    // Éviction LRU simple : supprimer le premier si plein
    if (this.cache.size >= this.tailleMax) {
      const premiereCle = this.cache.keys().next().value;
      if (premiereCle) {
        this.cache.delete(premiereCle);
      }
    }

    this.cache.set(cle, hash);
    return hash;
  }

  /**
   * Vide le cache
   */
  vider(): void {
    this.cache.clear();
  }

  /**
   * Retourne la taille actuelle du cache
   */
  taille(): number {
    return this.cache.size;
  }
}

/**
 * Instance singleton du cache de hash
 */
export const cacheHash = new CacheHash();

/**
 * Hash avec cache (pour contenus répétés)
 */
export function hashAvecCache(contenu: string, options: ConfigHash = {}): string {
  return cacheHash.obtenir(contenu, c => calculerHash(c, options));
}

/**
 * Hash d'un fichier par streaming (pour grands fichiers)
 */
export async function hashFichierStream(
  stream: NodeJS.ReadableStream,
  algorithme: 'sha256' | 'sha1' | 'md5' = 'sha256',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithme);

    stream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', reject);
  });
}

/**
 * Vérifie si un contenu est un doublon exact
 */
export function estDoublonExact(
  nouveauContenu: string,
  hashsExistants: Set<string>,
  options: ConfigHash = {},
): boolean {
  const hash = calculerHash(nouveauContenu, options);
  return hashsExistants.has(hash);
}

/**
 * Trouve les contenus similaires dans un ensemble
 */
export function trouverSimilaires(
  contenu: string,
  contenusExistants: Array<{ id: string; contenu: string }>,
  seuilPourcentage: number = 85,
): Array<{ id: string; similarite: number }> {
  const resultats: Array<{ id: string; similarite: number }> = [];
  const hashSource = simHash(contenu);

  for (const existant of contenusExistants) {
    const hashExistant = simHash(existant.contenu);
    const distance = distanceHamming(hashSource, hashExistant);
    const pourcentage = ((64 - distance) / 64) * 100;

    if (pourcentage >= seuilPourcentage) {
      resultats.push({ id: existant.id, similarite: pourcentage });
    }
  }

  return resultats.sort((a, b) => b.similarite - a.similarite);
}
