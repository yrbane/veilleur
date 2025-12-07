/**
 * Veilleur - Signature HMAC des requêtes API
 * Authentification et intégrité des requêtes API-to-API
 *
 * Utilisé pour sécuriser les communications entre services
 * ou valider les webhooks entrants.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { env } from '@/config/environnement';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Configuration de la signature HMAC
 */
const CONFIG_HMAC = {
  // Algorithme de hachage
  algorithme: 'sha256' as const,
  // Durée de validité d'une signature (5 minutes)
  dureeValiditeSecondes: 5 * 60,
  // Header pour la signature
  headerSignature: 'x-signature',
  // Header pour le timestamp
  headerTimestamp: 'x-timestamp',
  // Header pour l'identifiant du client API
  headerClientId: 'x-client-id',
};

/**
 * Secrets des clients API (en production, à stocker en base ou vault)
 * Format: clientId -> secret
 */
const clientSecrets = new Map<string, string>();

/**
 * Initialise les secrets des clients API
 * En production, charger depuis une source sécurisée
 */
export function initialiserClientsApi(clients: Record<string, string>): void {
  clientSecrets.clear();
  for (const [clientId, secret] of Object.entries(clients)) {
    clientSecrets.set(clientId, secret);
  }
  logger.info({ nbClients: clientSecrets.size }, 'Clients API initialisés');
}

/**
 * Ajoute un client API
 */
export function ajouterClientApi(clientId: string, secret: string): void {
  clientSecrets.set(clientId, secret);
}

/**
 * Supprime un client API
 */
export function supprimerClientApi(clientId: string): void {
  clientSecrets.delete(clientId);
}

/**
 * Construit la chaîne à signer
 *
 * Format: METHOD|PATH|TIMESTAMP|BODY_HASH
 */
function construireChaineASignier(
  method: string,
  path: string,
  timestamp: string,
  body: string | undefined,
): string {
  const bodyHash = body
    ? createHmac('sha256', '').update(body).digest('hex')
    : '';

  return `${method}|${path}|${timestamp}|${bodyHash}`;
}

/**
 * Génère une signature HMAC pour une requête
 *
 * @param clientId - Identifiant du client API
 * @param method - Méthode HTTP
 * @param path - Chemin de l'URL (sans query string)
 * @param body - Corps de la requête (string JSON)
 * @returns Objet avec signature et timestamp, ou null si client inconnu
 */
export function genererSignature(
  clientId: string,
  method: string,
  path: string,
  body?: string,
): { signature: string; timestamp: string } | null {
  const secret = clientSecrets.get(clientId);
  if (!secret) {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const chaineASignier = construireChaineASignier(method, path, timestamp, body);

  const signature = createHmac(CONFIG_HMAC.algorithme, secret)
    .update(chaineASignier)
    .digest('hex');

  return { signature, timestamp };
}

/**
 * Vérifie une signature HMAC
 *
 * @param clientId - Identifiant du client API
 * @param signatureRecue - Signature reçue dans les headers
 * @param timestamp - Timestamp de la requête
 * @param method - Méthode HTTP
 * @param path - Chemin de l'URL
 * @param body - Corps de la requête
 * @returns true si la signature est valide
 */
export function verifierSignature(
  clientId: string,
  signatureRecue: string,
  timestamp: string,
  method: string,
  path: string,
  body?: string,
): boolean {
  const secret = clientSecrets.get(clientId);
  if (!secret) {
    logger.warn({ clientId }, 'Client API inconnu');
    return false;
  }

  // Vérifier que le timestamp n'est pas trop vieux (replay attack)
  const timestampNum = parseInt(timestamp, 10);
  const maintenant = Math.floor(Date.now() / 1000);

  if (isNaN(timestampNum) || Math.abs(maintenant - timestampNum) > CONFIG_HMAC.dureeValiditeSecondes) {
    logger.warn(
      { clientId, timestamp, maintenant },
      'Signature HMAC expirée ou timestamp invalide',
    );
    return false;
  }

  // Recalculer la signature
  const chaineASignier = construireChaineASignier(method, path, timestamp, body);
  const signatureCalculee = createHmac(CONFIG_HMAC.algorithme, secret)
    .update(chaineASignier)
    .digest('hex');

  // Comparaison timing-safe
  try {
    const bufferRecu = Buffer.from(signatureRecue, 'hex');
    const bufferCalcule = Buffer.from(signatureCalculee, 'hex');

    if (bufferRecu.length !== bufferCalcule.length) {
      return false;
    }

    return timingSafeEqual(bufferRecu, bufferCalcule);
  } catch {
    return false;
  }
}

/**
 * Middleware Fastify pour vérifier la signature HMAC
 *
 * Usage:
 * ```
 * fastify.post('/webhook', {
 *   preHandler: verifierSignatureHmac
 * }, handler);
 * ```
 */
export function verifierSignatureHmac(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const clientId = request.headers[CONFIG_HMAC.headerClientId] as string | undefined;
  const signature = request.headers[CONFIG_HMAC.headerSignature] as string | undefined;
  const timestamp = request.headers[CONFIG_HMAC.headerTimestamp] as string | undefined;

  // Vérifier la présence des headers requis
  if (!clientId || !signature || !timestamp) {
    logger.warn(
      { url: request.url, clientId: !!clientId, signature: !!signature, timestamp: !!timestamp },
      'Headers de signature HMAC manquants',
    );

    reply.status(401).send({
      erreur: 'SIGNATURE_MANQUANTE',
      message: 'Headers de signature requis: x-client-id, x-signature, x-timestamp',
    });
    return;
  }

  // Extraire le path sans query string
  const path = request.url.split('?')[0] ?? request.url;

  // Récupérer le body comme string
  const body = typeof request.body === 'string'
    ? request.body
    : request.body
      ? JSON.stringify(request.body)
      : undefined;

  // Vérifier la signature
  const valide = verifierSignature(clientId, signature, timestamp, request.method, path, body);

  if (!valide) {
    logger.warn(
      { url: request.url, clientId, method: request.method },
      'Signature HMAC invalide',
    );

    reply.status(401).send({
      erreur: 'SIGNATURE_INVALIDE',
      message: 'Signature HMAC invalide ou expirée',
    });
    return;
  }

  // Attacher le clientId à la requête pour usage ultérieur
  (request as FastifyRequest & { clientApiId?: string }).clientApiId = clientId;

  done();
}

/**
 * Génère les headers de signature pour une requête sortante
 *
 * @param clientId - Identifiant du client API
 * @param method - Méthode HTTP
 * @param path - Chemin de l'URL
 * @param body - Corps de la requête (optionnel)
 * @returns Headers à ajouter à la requête
 */
export function genererHeadersSignature(
  clientId: string,
  method: string,
  path: string,
  body?: string,
): Record<string, string> | null {
  const resultat = genererSignature(clientId, method, path, body);
  if (!resultat) {
    return null;
  }

  return {
    [CONFIG_HMAC.headerClientId]: clientId,
    [CONFIG_HMAC.headerSignature]: resultat.signature,
    [CONFIG_HMAC.headerTimestamp]: resultat.timestamp,
  };
}

// Initialiser avec le secret de l'environnement si disponible
if (env.API_HMAC_SECRET) {
  initialiserClientsApi({
    'internal': env.API_HMAC_SECRET,
  });
}
