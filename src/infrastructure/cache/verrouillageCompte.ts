/**
 * Veilleur - Verrouillage de compte
 * Protection contre les attaques par force brute
 *
 * Bloque temporairement les comptes après plusieurs tentatives échouées
 */

import { obtenirRedis } from './connexionRedis';
import { loggerCache } from '../logging/logger';

/**
 * Configuration du verrouillage
 */
const CONFIG_VERROUILLAGE = {
  // Nombre maximum de tentatives avant verrouillage
  maxTentatives: 5,
  // Fenêtre de temps pour compter les tentatives (en secondes)
  fenetreTentatives: 15 * 60, // 15 minutes
  // Durée du verrouillage (en secondes)
  dureeVerrouillage: 30 * 60, // 30 minutes
  // Durée du verrouillage étendu après récidive (en secondes)
  dureeVerrouillageEtendu: 24 * 60 * 60, // 24 heures
  // Seuil de récidive pour verrouillage étendu
  seuilRecidive: 3,
};

/**
 * Préfixes des clés Redis
 */
const PREFIXES = {
  tentatives: 'auth:tentatives:',
  verrouillage: 'auth:verrouillage:',
  recidive: 'auth:recidive:',
};

/**
 * Résultat de la vérification de verrouillage
 */
export interface ResultatVerrouillage {
  estVerrouille: boolean;
  tentativesRestantes: number;
  tempsRestant: number | null; // en secondes
}

/**
 * Vérifie si un compte est verrouillé
 *
 * @param identifiant - Email ou IP de l'utilisateur
 * @returns Statut du verrouillage
 */
export async function verifierVerrouillage(identifiant: string): Promise<ResultatVerrouillage> {
  const redis = obtenirRedis();
  const cleVerrouillage = `${PREFIXES.verrouillage}${identifiant}`;
  const cleTentatives = `${PREFIXES.tentatives}${identifiant}`;

  // Vérifier si le compte est verrouillé
  const ttl = await redis.ttl(cleVerrouillage);
  if (ttl > 0) {
    return {
      estVerrouille: true,
      tentativesRestantes: 0,
      tempsRestant: ttl,
    };
  }

  // Compter les tentatives actuelles
  const tentatives = await redis.get(cleTentatives);
  const nbTentatives = tentatives ? parseInt(tentatives, 10) : 0;
  const tentativesRestantes = Math.max(0, CONFIG_VERROUILLAGE.maxTentatives - nbTentatives);

  return {
    estVerrouille: false,
    tentativesRestantes,
    tempsRestant: null,
  };
}

/**
 * Enregistre une tentative de connexion échouée
 *
 * @param identifiant - Email ou IP de l'utilisateur
 * @returns Résultat du verrouillage après cette tentative
 */
export async function enregistrerEchec(identifiant: string): Promise<ResultatVerrouillage> {
  const redis = obtenirRedis();
  const cleTentatives = `${PREFIXES.tentatives}${identifiant}`;
  const cleVerrouillage = `${PREFIXES.verrouillage}${identifiant}`;
  const cleRecidive = `${PREFIXES.recidive}${identifiant}`;

  // Vérifier si déjà verrouillé
  const verrouillageExistant = await redis.ttl(cleVerrouillage);
  if (verrouillageExistant > 0) {
    return {
      estVerrouille: true,
      tentativesRestantes: 0,
      tempsRestant: verrouillageExistant,
    };
  }

  // Incrémenter le compteur de tentatives
  const nbTentatives = await redis.incr(cleTentatives);

  // Définir l'expiration si c'est la première tentative
  if (nbTentatives === 1) {
    await redis.expire(cleTentatives, CONFIG_VERROUILLAGE.fenetreTentatives);
  }

  // Vérifier si le seuil est atteint
  if (nbTentatives >= CONFIG_VERROUILLAGE.maxTentatives) {
    // Vérifier le nombre de récidives
    const recidives = await redis.incr(cleRecidive);
    if (recidives === 1) {
      // Expiration de la récidive après 24h
      await redis.expire(cleRecidive, 24 * 60 * 60);
    }

    // Durée du verrouillage (étendue si récidive)
    const duree = recidives >= CONFIG_VERROUILLAGE.seuilRecidive
      ? CONFIG_VERROUILLAGE.dureeVerrouillageEtendu
      : CONFIG_VERROUILLAGE.dureeVerrouillage;

    // Verrouiller le compte
    await redis.set(cleVerrouillage, '1', 'EX', duree);

    // Réinitialiser le compteur de tentatives
    await redis.del(cleTentatives);

    loggerCache.warn(
      { identifiant, recidives, dureeMinutes: Math.ceil(duree / 60) },
      'Compte verrouillé après tentatives échouées',
    );

    return {
      estVerrouille: true,
      tentativesRestantes: 0,
      tempsRestant: duree,
    };
  }

  const tentativesRestantes = CONFIG_VERROUILLAGE.maxTentatives - nbTentatives;

  loggerCache.debug(
    { identifiant, nbTentatives, tentativesRestantes },
    'Tentative de connexion échouée enregistrée',
  );

  return {
    estVerrouille: false,
    tentativesRestantes,
    tempsRestant: null,
  };
}

/**
 * Réinitialise le compteur de tentatives après une connexion réussie
 *
 * @param identifiant - Email ou IP de l'utilisateur
 */
export async function reinitialiserTentatives(identifiant: string): Promise<void> {
  const redis = obtenirRedis();
  const cleTentatives = `${PREFIXES.tentatives}${identifiant}`;

  await redis.del(cleTentatives);

  loggerCache.debug({ identifiant }, 'Compteur de tentatives réinitialisé');
}

/**
 * Déverrouille manuellement un compte (admin)
 *
 * @param identifiant - Email ou IP de l'utilisateur
 * @returns true si le compte était verrouillé
 */
export async function deverrouillerCompte(identifiant: string): Promise<boolean> {
  const redis = obtenirRedis();
  const cleVerrouillage = `${PREFIXES.verrouillage}${identifiant}`;
  const cleTentatives = `${PREFIXES.tentatives}${identifiant}`;
  const cleRecidive = `${PREFIXES.recidive}${identifiant}`;

  const etaitVerrouille = await redis.exists(cleVerrouillage) === 1;

  await Promise.all([
    redis.del(cleVerrouillage),
    redis.del(cleTentatives),
    redis.del(cleRecidive),
  ]);

  if (etaitVerrouille) {
    loggerCache.info({ identifiant }, 'Compte déverrouillé manuellement');
  }

  return etaitVerrouille;
}

/**
 * Obtient les statistiques de verrouillage pour monitoring
 */
export async function obtenirStatsVerrouillage(): Promise<{
  comptesVerrouilles: number;
  tentativesEnCours: number;
}> {
  const redis = obtenirRedis();

  let comptesVerrouilles = 0;
  let tentativesEnCours = 0;
  let cursor = '0';

  // Compter les verrouillages
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${PREFIXES.verrouillage}*`,
      'COUNT',
      100,
    );
    cursor = nextCursor;
    comptesVerrouilles += keys.length;
  } while (cursor !== '0');

  // Compter les tentatives en cours
  cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${PREFIXES.tentatives}*`,
      'COUNT',
      100,
    );
    cursor = nextCursor;
    tentativesEnCours += keys.length;
  } while (cursor !== '0');

  return { comptesVerrouilles, tentativesEnCours };
}
