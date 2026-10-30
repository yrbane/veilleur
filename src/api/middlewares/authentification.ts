/**
 * Veilleur - Middleware d'authentification
 * Vérification des tokens JWT pour les routes protégées
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { ServiceAuthentification, PayloadAccessToken, ErreurAuthentification } from '@/domaine/services/ServiceAuthentification';
import { DepotUtilisateursMariaDB, DepotRefreshTokensMariaDB } from '@/infrastructure/persistence/DepotUtilisateursMariaDB';
import type { RoleUtilisateur } from '@/domaine/entites/Utilisateur';

declare module 'fastify' {
  interface FastifyRequest {
    utilisateur?: PayloadAccessToken;
  }
}

/**
 * Instance du service d'authentification
 */
let serviceAuth: ServiceAuthentification | null = null;

/**
 * Récupère ou crée le service d'authentification
 */
export function obtenirServiceAuth(): ServiceAuthentification {
  if (!serviceAuth) {
    const depotUtilisateurs = new DepotUtilisateursMariaDB();
    const depotRefreshTokens = new DepotRefreshTokensMariaDB();
    serviceAuth = new ServiceAuthentification(depotUtilisateurs, depotRefreshTokens);
  }
  return serviceAuth;
}

/**
 * Extrait le token Bearer de l'en-tête Authorization
 */
function extraireToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) {
    return null;
  }

  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

/**
 * Middleware qui vérifie l'authentification (route protégée)
 */
export async function verifierAuthentification(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extraireToken(request);

  if (!token) {
    return reply.status(401).send({
      erreur: 'Non authentifié',
      message: 'Token d\'accès requis',
    });
  }

  try {
    const service = obtenirServiceAuth();
    const payload = await service.verifierAccessToken(token);
    request.utilisateur = payload;
  } catch (erreur) {
    if (erreur instanceof ErreurAuthentification) {
      const statusCode = erreur.code === 'TOKEN_EXPIRE' ? 401 : 401;
      return reply.status(statusCode).send({
        erreur: erreur.code,
        message: erreur.message,
      });
    }

    return reply.status(401).send({
      erreur: 'TOKEN_INVALIDE',
      message: 'Token invalide',
    });
  }
}

/**
 * Fabrique le garde des routes d'administration : authentification, puis rôle « admin »
 * relu en base à chaque requête (une rétrogradation prend effet immédiatement)
 */
export function creerVerifierAdmin(
  chargerRole: (utilisateurId: string) => Promise<RoleUtilisateur | null>,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    await verifierAuthentification(request, reply);
    if (reply.sent || !request.utilisateur) return;
    const role = await chargerRole(request.utilisateur.sub);
    if (role !== 'admin') {
      return reply.status(403).send({
        erreur: 'ACCES_REFUSE',
        message: 'Réservé aux administrateurs',
      });
    }
  };
}

/**
 * Garde des routes d'administration branché sur la base
 */
export const verifierAdmin = creerVerifierAdmin(async utilisateurId => {
  const utilisateur = await new DepotUtilisateursMariaDB().trouverParId(utilisateurId);
  return utilisateur && utilisateur.estActif ? utilisateur.role : null;
});

/**
 * Middleware optionnel qui charge l'utilisateur si présent
 */
export async function chargerUtilisateurOptional(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extraireToken(request);

  if (!token) {
    return;
  }

  try {
    const service = obtenirServiceAuth();
    const payload = await service.verifierAccessToken(token);
    request.utilisateur = payload;
  } catch {
    // Ignorer les erreurs en mode optionnel
  }
}

/**
 * Plugin Fastify pour l'authentification
 */
export const pluginAuthentification = fp(async fastify => {
  // Décorateur pour accéder au service d'auth
  fastify.decorate('serviceAuth', obtenirServiceAuth());

  // Hook pour les routes avec preHandler
  fastify.decorateRequest('utilisateur', undefined);
});
