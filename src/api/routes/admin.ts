/**
 * Veilleur - Routes d'administration (rôle admin requis)
 * GET    /api/v1/admin/tableau-de-bord         — statistiques anonymes et séries
 * GET    /api/v1/admin/systeme                 — état du processus, de Redis, de la base, des files
 * GET    /api/v1/admin/utilisateurs            — comptes paginés (recherche par courriel)
 * PATCH  /api/v1/admin/utilisateurs/:id        — rôle / activation
 * DELETE /api/v1/admin/utilisateurs/:id        — suppression complète d'un compte
 * GET    /api/v1/admin/sources                 — sources paginées avec abonnés et articles
 * PATCH  /api/v1/admin/sources/:id             — statut (active / inactive), remet les échecs à zéro
 * POST   /api/v1/admin/sources/:id/synchroniser — enfile une synchronisation prioritaire
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import { verifierAdmin } from '@/api/middlewares/authentification';
import { ErreurAdministration, ServiceAdministration } from '@/domaine/services/ServiceAdministration';
import { ROLES_UTILISATEUR } from '@/domaine/entites/Utilisateur';
import { DepotAdministrationMariaDB } from '@/infrastructure/persistence/DepotAdministrationMariaDB';
import { DepotSourcesMariaDB } from '@/infrastructure/persistence/DepotSourcesMariaDB';
import { obtenirRedis } from '@/infrastructure/cache/connexionRedis';
import { creerQueueSynchro, ajouterJobSynchroSource, type DonneesJob } from '@/infrastructure/workers/WorkerSynchro';
import { creerQueueImages } from '@/infrastructure/workers/WorkerImages';
import type { DonneesJobImage } from '@/infrastructure/images';
import { VERSION } from '@/config/version';
import { loggerHttp } from '@/infrastructure/logging/logger';

const schemaListe = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
  recherche: z.string().trim().max(200).optional(),
});

const schemaChangementsUtilisateur = z.object({
  role: z.enum(ROLES_UTILISATEUR).optional(),
  estActif: z.boolean().optional(),
}).refine(c => c.role !== undefined || c.estActif !== undefined, { message: 'Aucun changement' });

const schemaChangementSource = z.object({ statut: z.enum(['active', 'inactive']) });

let depotAdministration: DepotAdministrationMariaDB | null = null;
let serviceAdministration: ServiceAdministration | null = null;
let queueSynchro: Queue<DonneesJob> | null = null;
let queueImages: Queue<DonneesJobImage> | null = null;

function obtenirDepot(): DepotAdministrationMariaDB {
  if (!depotAdministration) depotAdministration = new DepotAdministrationMariaDB();
  return depotAdministration;
}

function obtenirService(): ServiceAdministration {
  if (!serviceAdministration) serviceAdministration = new ServiceAdministration(obtenirDepot());
  return serviceAdministration;
}

function obtenirQueues(): { synchro: Queue<DonneesJob>; images: Queue<DonneesJobImage> } {
  if (!queueSynchro) queueSynchro = creerQueueSynchro();
  if (!queueImages) queueImages = creerQueueImages();
  return { synchro: queueSynchro, images: queueImages };
}

/** Compteurs d'une file BullMQ, à zéro si Redis ne répond pas */
async function compteursFile(queue: Queue): Promise<{ attente: number; actifs: number; termines: number; echoues: number; differes: number }> {
  try {
    const c = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return { attente: c.waiting ?? 0, actifs: c.active ?? 0, termines: c.completed ?? 0, echoues: c.failed ?? 0, differes: c.delayed ?? 0 };
  } catch {
    return { attente: 0, actifs: 0, termines: 0, echoues: 0, differes: 0 };
  }
}

async function etatRedis(): Promise<{ ok: boolean; memoireOctets: number | null }> {
  try {
    const redis = obtenirRedis();
    const [pong, info] = await Promise.all([redis.ping(), redis.info('memory')]);
    const memoire = /used_memory:(\d+)/.exec(info)?.[1];
    return { ok: pong === 'PONG', memoireOctets: memoire ? Number(memoire) : null };
  } catch {
    return { ok: false, memoireOctets: null };
  }
}

function gererErreur(erreur: unknown, reply: FastifyReply, contexte: string): FastifyReply {
  if (erreur instanceof ErreurAdministration) {
    const statut = erreur.code === 'UTILISATEUR_INTROUVABLE' ? 404 : 409;
    return reply.status(statut).send({ erreur: erreur.code, message: erreur.message });
  }
  if (erreur instanceof z.ZodError) {
    return reply.status(400).send({ erreur: 'VALIDATION', message: erreur.errors.map(e => e.message).join(', ') });
  }
  loggerHttp.error({ erreur }, contexte);
  return reply.status(500).send({ erreur: 'ERREUR_INTERNE', message: 'Une erreur est survenue' });
}

export async function routesAdmin(fastify: FastifyInstance): Promise<void> {
  // Toutes les routes de ce module exigent le rôle admin
  fastify.addHook('preHandler', verifierAdmin);

  fastify.get('/tableau-de-bord', {
    schema: { tags: ['Administration'], summary: 'Statistiques anonymes de l\'instance', security: [{ bearerAuth: [] }] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(await obtenirService().tableauDeBord());
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur tableau de bord admin');
    }
  });

  fastify.get('/systeme', {
    schema: { tags: ['Administration'], summary: 'État du serveur, de Redis, de la base et des files', security: [{ bearerAuth: [] }] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const queues = obtenirQueues();
      const [redis, octetsBdd, synchro, images] = await Promise.all([
        etatRedis(),
        obtenirDepot().tailleBaseDonnees().catch(() => 0),
        compteursFile(queues.synchro),
        compteursFile(queues.images),
      ]);
      const memoire = process.memoryUsage();
      return reply.send({
        version: VERSION,
        node: process.version,
        uptimeSecondes: Math.round(process.uptime()),
        memoire: { rss: memoire.rss, heapUtilise: memoire.heapUsed },
        redis,
        baseDonnees: { octets: octetsBdd },
        files: { synchro, images },
      });
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur état système admin');
    }
  });

  fastify.get('/utilisateurs', {
    schema: {
      tags: ['Administration'], summary: 'Liste paginée des comptes', security: [{ bearerAuth: [] }],
      querystring: { type: 'object', properties: { page: { type: 'number' }, limite: { type: 'number' }, recherche: { type: 'string' } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = schemaListe.parse(request.query);
      const resultat = await obtenirService().listerUtilisateurs(options);
      return reply.send({ ...resultat, page: options.page, limite: options.limite });
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur liste utilisateurs admin');
    }
  });

  fastify.patch<{ Params: { id: string } }>('/utilisateurs/:id', {
    schema: {
      tags: ['Administration'], summary: 'Change le rôle ou l\'activation d\'un compte', security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: { role: { type: 'string', enum: [...ROLES_UTILISATEUR] }, estActif: { type: 'boolean' } } },
    },
  }, async (request, reply) => {
    try {
      const changements = schemaChangementsUtilisateur.parse(request.body ?? {});
      const utilisateur = await obtenirService().modifierUtilisateur(request.utilisateur!.sub, request.params.id, changements);
      loggerHttp.info({ adminId: request.utilisateur!.sub, cibleId: request.params.id, changements }, 'Compte modifié par un administrateur');
      return reply.send(utilisateur);
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur modification utilisateur admin');
    }
  });

  fastify.delete<{ Params: { id: string } }>('/utilisateurs/:id', {
    schema: {
      tags: ['Administration'], summary: 'Supprime un compte et toutes ses données', security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    try {
      await obtenirService().supprimerUtilisateur(request.utilisateur!.sub, request.params.id);
      loggerHttp.info({ adminId: request.utilisateur!.sub, cibleId: request.params.id }, 'Compte supprimé par un administrateur');
      return reply.status(204).send();
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur suppression utilisateur admin');
    }
  });

  fastify.get('/sources', {
    schema: {
      tags: ['Administration'], summary: 'Liste paginée des sources, abonnés et articles', security: [{ bearerAuth: [] }],
      querystring: { type: 'object', properties: { page: { type: 'number' }, limite: { type: 'number' }, recherche: { type: 'string' } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = schemaListe.parse(request.query);
      const resultat = await obtenirService().listerSources(options);
      return reply.send({ ...resultat, page: options.page, limite: options.limite });
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur liste sources admin');
    }
  });

  fastify.patch<{ Params: { id: string } }>('/sources/:id', {
    schema: {
      tags: ['Administration'], summary: 'Active ou désactive une source (remet les échecs à zéro)', security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: { statut: { type: 'string', enum: ['active', 'inactive'] } }, required: ['statut'] },
    },
  }, async (request, reply) => {
    try {
      const { statut } = schemaChangementSource.parse(request.body);
      const source = await new DepotSourcesMariaDB().mettreAJour(request.params.id, { statut, nombreEchecs: 0 });
      if (!source) return reply.status(404).send({ erreur: 'SOURCE_INTROUVABLE', message: 'Source introuvable' });
      loggerHttp.info({ adminId: request.utilisateur!.sub, sourceId: request.params.id, statut }, 'Source modifiée par un administrateur');
      return reply.send({ id: source.id, statut: source.statut, nombreEchecs: source.nombreEchecs });
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur modification source admin');
    }
  });

  fastify.post<{ Params: { id: string } }>('/sources/:id/synchroniser', {
    schema: {
      tags: ['Administration'], summary: 'Enfile une synchronisation prioritaire de la source', security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    try {
      const jobId = await ajouterJobSynchroSource(obtenirQueues().synchro, request.params.id);
      return reply.status(202).send({ jobId: jobId ?? null });
    } catch (erreur) {
      return gererErreur(erreur, reply, 'Erreur synchronisation source admin');
    }
  });
}
