/**
 * Veilleur - Protection CSRF
 * Vérifie l'origine des requêtes pour les opérations sensibles
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { estDeveloppement, obtenirOriginesCORS } from '@/config/environnement';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Méthodes HTTP considérées comme modifiant l'état (nécessitent protection CSRF)
 */
const METHODES_MODIFIANTES = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Routes exemptées de la vérification CSRF
 * (routes publiques qui n'ont pas besoin de protection)
 */
const ROUTES_EXEMPTEES = [
  '/api/v1/auth/inscription',
  '/api/v1/auth/connexion',
  '/api/v1/auth/rafraichir',
  '/api/v1/health',
  '/api/v1/health/cache',
];

/**
 * Extrait l'origine d'une URL
 */
function extraireOrigine(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Vérifie si une origine est autorisée
 */
function estOrigineAutorisee(origine: string | null): boolean {
  if (!origine) return false;

  const originesAutorisees = obtenirOriginesCORS();
  return originesAutorisees.includes(origine);
}

/**
 * Middleware de protection CSRF
 * Vérifie que l'origine de la requête est autorisée pour les opérations modifiantes
 */
export function protectionCSRF(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  // En mode développement, vérification moins stricte
  if (estDeveloppement()) {
    return done();
  }

  // Ne vérifier que les méthodes modifiantes
  if (!METHODES_MODIFIANTES.includes(request.method)) {
    return done();
  }

  // Exempter certaines routes
  const routeSansParams = request.url.split('?')[0] ?? '';
  if (ROUTES_EXEMPTEES.some(route => routeSansParams.startsWith(route))) {
    return done();
  }

  // Récupérer l'origine de la requête
  const origine = request.headers.origin;
  const referer = request.headers.referer;

  // Extraire l'origine du header Referer si Origin n'est pas présent
  const origineEffective = origine || extraireOrigine(referer);

  // Pour les requêtes API directes (sans navigateur), pas d'origine
  // Elles sont protégées par le token JWT
  if (!origineEffective && request.headers.authorization) {
    return done();
  }

  // Vérifier que l'origine est autorisée
  if (!origineEffective || !estOrigineAutorisee(origineEffective)) {
    logger.warn(
      {
        url: request.url,
        method: request.method,
        origine: origineEffective,
        ip: request.ip,
      },
      'Requête CSRF bloquée - origine non autorisée',
    );

    reply.status(403).send({
      erreur: 'CSRF_ORIGINE_INVALIDE',
      message: 'Origine de la requête non autorisée',
    });
    return;
  }

  done();
}

/**
 * Hook pour ajouter le header X-Content-Type-Options
 * Empêche le MIME sniffing qui pourrait contourner la protection CSRF
 */
export function ajouterHeadersSecurite(
  _request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  // Ces headers sont déjà gérés par Helmet, mais on les renforce ici
  reply.header('X-Content-Type-Options', 'nosniff');
  done();
}
