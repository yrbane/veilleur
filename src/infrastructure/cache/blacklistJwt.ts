/**
 * Veilleur - Blacklist JWT
 * Stockage des access tokens révoqués dans Redis
 *
 * Permet de révoquer des access tokens avant leur expiration naturelle
 * (déconnexion, changement de mot de passe, compromission)
 */

import { obtenirRedis } from './connexionRedis';
import { loggerCache } from '../logging/logger';

/**
 * Préfixe des clés Redis pour la blacklist
 */
const PREFIXE_BLACKLIST = 'jwt:blacklist:';

/**
 * Ajoute un access token à la blacklist
 *
 * @param jti - Identifiant unique du token (claim jti)
 * @param ttlSecondes - Durée de vie restante du token en secondes
 */
export async function ajouterABlacklist(jti: string, ttlSecondes: number): Promise<void> {
  const redis = obtenirRedis();
  const cle = `${PREFIXE_BLACKLIST}${jti}`;

  // Stocker avec TTL pour auto-nettoyage à l'expiration du token
  // Une fois le token expiré naturellement, plus besoin de le garder en blacklist
  await redis.set(cle, '1', 'EX', Math.max(1, Math.ceil(ttlSecondes)));

  loggerCache.debug({ jti, ttlSecondes }, 'Token ajouté à la blacklist');
}

/**
 * Vérifie si un access token est dans la blacklist
 *
 * @param jti - Identifiant unique du token (claim jti)
 * @returns true si le token est blacklisté (révoqué)
 */
export async function estDansBlacklist(jti: string): Promise<boolean> {
  const redis = obtenirRedis();
  const cle = `${PREFIXE_BLACKLIST}${jti}`;

  const resultat = await redis.exists(cle);
  return resultat === 1;
}

/**
 * Supprime un token de la blacklist (rarement utilisé)
 *
 * @param jti - Identifiant unique du token
 */
export async function supprimerDeBlacklist(jti: string): Promise<void> {
  const redis = obtenirRedis();
  const cle = `${PREFIXE_BLACKLIST}${jti}`;

  await redis.del(cle);
  loggerCache.debug({ jti }, 'Token supprimé de la blacklist');
}

/**
 * Compte le nombre de tokens dans la blacklist
 * Utile pour monitoring/diagnostics
 */
export async function compterTokensBlacklist(): Promise<number> {
  const redis = obtenirRedis();
  const pattern = `${PREFIXE_BLACKLIST}*`;

  // SCAN plutôt que KEYS pour ne pas bloquer Redis
  let cursor = '0';
  let count = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    count += keys.length;
  } while (cursor !== '0');

  return count;
}

/**
 * Nettoie tous les tokens de la blacklist (pour les tests uniquement)
 */
export async function viderBlacklist(): Promise<number> {
  const redis = obtenirRedis();
  const pattern = `${PREFIXE_BLACKLIST}*`;

  let cursor = '0';
  let supprimees = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      supprimees += keys.length;
    }
  } while (cursor !== '0');

  loggerCache.info({ supprimees }, 'Blacklist JWT vidée');
  return supprimees;
}
