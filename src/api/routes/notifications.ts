/**
 * Veilleur - Routes des notifications (Web Push et résumé courriel)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { verifierAuthentification } from '@/api/middlewares/authentification';
import { DepotNotificationsMariaDB } from '@/infrastructure/persistence/DepotNotificationsMariaDB';
import { DepotUtilisateursMariaDB } from '@/infrastructure/persistence/DepotUtilisateursMariaDB';
import { obtenirEnvoyeurPush, obtenirEnvoyeurCourriel, obtenirServiceNotifications } from '@/infrastructure/notifications/fabrique';
import { loggerHttp } from '@/infrastructure/logging/logger';

const schemaAbonnement = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }),
});

const schemaDesabonnement = z.object({ endpoint: z.string().url().max(1024) });

export async function routesNotifications(fastify: FastifyInstance): Promise<void> {
  const depot = new DepotNotificationsMariaDB();
  const depotUtilisateurs = new DepotUtilisateursMariaDB();

  /** Clé publique VAPID (public) ; 404 si le push n'est pas configuré */
  fastify.get('/push/cle-publique', {
    schema: { tags: ['Notifications'], summary: 'Clé publique VAPID du serveur' },
    config: { rateLimit: false },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const cle = obtenirEnvoyeurPush().clePublique();
    if (!cle) return reply.status(404).send({ erreur: 'PUSH_NON_CONFIGURE', message: 'Les notifications push ne sont pas activées sur ce serveur' });
    return reply.send({ clePublique: cle });
  });

  fastify.register(async (prive) => {
    prive.addHook('preHandler', verifierAuthentification);

    prive.get('/etat', {
      schema: { tags: ['Notifications'], summary: 'État des notifications de l\'utilisateur', security: [{ bearerAuth: [] }] },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const appareils = await depot.compterAbonnementsPush(request.utilisateur!.sub);
      return reply.send({
        push: { configure: obtenirEnvoyeurPush().estConfigure(), appareils },
        courriel: { configure: obtenirEnvoyeurCourriel().estConfigure() },
      });
    });

    prive.post('/push/abonnements', {
      schema: { tags: ['Notifications'], summary: 'Enregistrer l\'abonnement push de ce navigateur', security: [{ bearerAuth: [] }] },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const analyse = schemaAbonnement.safeParse(request.body);
      if (!analyse.success) return reply.status(400).send({ erreur: 'VALIDATION_ECHOUEE', message: 'Abonnement push invalide' });
      const { endpoint, keys } = analyse.data;
      await depot.enregistrerAbonnementPush(request.utilisateur!.sub, { endpoint, clePublique: keys.p256dh, secretAuth: keys.auth }, request.headers['user-agent'] ?? null);
      return reply.status(201).send({ enregistre: true });
    });

    prive.delete('/push/abonnements', {
      schema: { tags: ['Notifications'], summary: 'Retirer l\'abonnement push de ce navigateur', security: [{ bearerAuth: [] }] },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const analyse = schemaDesabonnement.safeParse(request.body);
      if (!analyse.success) return reply.status(400).send({ erreur: 'VALIDATION_ECHOUEE', message: 'Point de terminaison invalide' });
      const supprime = await depot.supprimerAbonnementPush(request.utilisateur!.sub, analyse.data.endpoint);
      return reply.send({ supprime });
    });

    prive.post('/push/test', {
      schema: { tags: ['Notifications'], summary: 'Envoyer une notification de test à tous ses appareils', security: [{ bearerAuth: [] }] },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const envoyes = await obtenirServiceNotifications().envoyerPushTest(request.utilisateur!.sub);
      return reply.send({ envoyes });
    });

    /** Envoie immédiatement le résumé (aperçu) à l'adresse du compte */
    prive.post('/resume/test', {
      schema: {
        tags: ['Notifications'],
        summary: 'Recevoir tout de suite le résumé courriel',
        security: [{ bearerAuth: [] }],
        body: { type: 'object', properties: { frequence: { type: 'string', enum: ['quotidien', 'hebdomadaire'] } } },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!obtenirEnvoyeurCourriel().estConfigure()) {
          return reply.status(409).send({ erreur: 'COURRIEL_NON_CONFIGURE', message: 'L\'envoi de courriels n\'est pas activé sur ce serveur' });
        }
        const utilisateur = await depotUtilisateurs.trouverParId(request.utilisateur!.sub);
        if (!utilisateur) return reply.status(404).send({ erreur: 'UTILISATEUR_INTROUVABLE', message: 'Utilisateur introuvable' });
        const frequence = (request.body as { frequence?: 'quotidien' | 'hebdomadaire' } | null)?.frequence ?? 'quotidien';
        const envoye = await obtenirServiceNotifications().envoyerResume(utilisateur.id, utilisateur.email, frequence);
        return reply.send({ envoye, email: utilisateur.email });
      } catch (erreur) {
        loggerHttp.error({ erreur }, 'Erreur envoi du résumé de test');
        return reply.status(500).send({ erreur: 'ERREUR_INTERNE', message: 'Impossible d\'envoyer le résumé' });
      }
    });
  });
}
