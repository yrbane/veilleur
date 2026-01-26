/**
 * Veilleur - Routes d'authentification
 * Inscription, connexion, déconnexion et rafraîchissement de tokens
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { schemaCreationUtilisateur, schemaConnexion } from '@/domaine/entites/Utilisateur';
import { obtenirServiceAuth, verifierAuthentification } from '@/api/middlewares/authentification';
import { ErreurAuthentification } from '@/domaine/services/ServiceAuthentification';
import { loggerHttp } from '@/infrastructure/logging/logger';
import * as ServiceTOTP from '@/domaine/services/ServiceTOTP';

/**
 * Schémas de validation
 */
const schemaInscription = schemaCreationUtilisateur;

// schemaConnexion est utilisé via schemaConnexionAvec2FA

const schemaRafraichissement = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

const schemaChangementMotDePasse = z.object({
  motDePasseActuel: z.string().min(1, 'Mot de passe actuel requis'),
  nouveauMotDePasse: z
    .string()
    .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
});

const schemaMiseAJourProfil = z.object({
  preferences: z.object({
    langue: z.enum(['fr', 'en']).optional(),
    theme: z.enum(['clair', 'sombre', 'auto']).optional(),
    frequenceRafraichissement: z.number().min(5).max(120).optional(),
  }).optional(),
});

const schemaVerifierTOTP = z.object({
  code: z.string().length(6, 'Le code doit contenir 6 chiffres'),
});

const schemaConnexionAvec2FA = schemaConnexion.extend({
  codeTOTP: z.string().length(6).optional(),
});

/**
 * Gère les erreurs d'authentification
 */
function gererErreurAuth(erreur: unknown, reply: FastifyReply): FastifyReply {
  if (erreur instanceof ErreurAuthentification) {
    const statusCodes: Record<string, number> = {
      EMAIL_EXISTANT: 409,
      IDENTIFIANTS_INVALIDES: 401,
      COMPTE_INACTIF: 403,
      TOKEN_INVALIDE: 401,
      TOKEN_EXPIRE: 401,
      TOKEN_REVOQUE: 401,
      TOTP_REQUIS: 403,
      TOTP_INVALIDE: 401,
      TOTP_DEJA_ACTIF: 409,
    };

    return reply.status(statusCodes[erreur.code] ?? 400).send({
      erreur: erreur.code,
      message: erreur.message,
    });
  }

  if (erreur instanceof z.ZodError) {
    return reply.status(400).send({
      erreur: 'VALIDATION_ERREUR',
      message: 'Données invalides',
      details: erreur.errors.map(e => ({
        champ: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  loggerHttp.error({ erreur }, 'Erreur inattendue dans auth');
  return reply.status(500).send({
    erreur: 'ERREUR_INTERNE',
    message: 'Une erreur est survenue',
  });
}

/**
 * Enregistre les routes d'authentification
 */
export async function routesAuth(fastify: FastifyInstance): Promise<void> {
  const serviceAuth = obtenirServiceAuth();

  /**
   * POST /api/v1/auth/inscription
   * Inscrit un nouvel utilisateur
   */
  fastify.post('/inscription', {
    schema: {
      tags: ['Authentification'],
      summary: 'Inscrit un nouvel utilisateur',
      body: {
        type: 'object',
        required: ['email', 'motDePasse'],
        properties: {
          email: { type: 'string', format: 'email' },
          motDePasse: { type: 'string', minLength: 10 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            utilisateur: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                dateCreation: { type: 'string' },
                preferences: { type: 'object' },
              },
            },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donnees = schemaInscription.parse(request.body);
      const resultat = await serviceAuth.inscrire(donnees.email, donnees.motDePasse);

      loggerHttp.info({ email: donnees.email }, 'Nouvel utilisateur inscrit');

      return reply.status(201).send(resultat);
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * POST /api/v1/auth/connexion
   * Connecte un utilisateur existant (avec support 2FA)
   */
  fastify.post('/connexion', {
    schema: {
      tags: ['Authentification'],
      summary: 'Connecte un utilisateur',
      body: {
        type: 'object',
        required: ['email', 'motDePasse'],
        properties: {
          email: { type: 'string', format: 'email' },
          motDePasse: { type: 'string' },
          codeTOTP: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            utilisateur: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                dateCreation: { type: 'string' },
                preferences: { type: 'object' },
                totpActif: { type: 'boolean' },
              },
            },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
            totpRequis: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donnees = schemaConnexionAvec2FA.parse(request.body);

      // Vérifier d'abord les identifiants
      const { DepotUtilisateursMariaDB } = await import('@/infrastructure/persistence/DepotUtilisateursMariaDB');
      const depotUtilisateurs = new DepotUtilisateursMariaDB();
      const utilisateur = await depotUtilisateurs.trouverParEmail(donnees.email);

      if (!utilisateur) {
        throw new ErreurAuthentification('Email ou mot de passe incorrect', 'IDENTIFIANTS_INVALIDES');
      }

      // Vérifier si 2FA est actif et si le code est fourni
      if (utilisateur.totpActif && utilisateur.totpSecret) {
        if (!donnees.codeTOTP) {
          // Pas de code fourni, demander le 2FA
          return reply.status(200).send({
            totpRequis: true,
            message: 'Code 2FA requis',
          });
        }

        // Vérifier le code TOTP
        const valide = ServiceTOTP.verifierCode(utilisateur.totpSecret, donnees.codeTOTP);
        if (!valide) {
          throw new ErreurAuthentification('Code 2FA invalide', 'TOTP_INVALIDE');
        }
      }

      // Connecter normalement
      const resultat = await serviceAuth.connecter(donnees.email, donnees.motDePasse);

      loggerHttp.info({ email: donnees.email }, 'Utilisateur connecté');

      return reply.send(resultat);
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * POST /api/v1/auth/rafraichir
   * Rafraîchit les tokens avec un refresh token
   */
  fastify.post('/rafraichir', {
    schema: {
      tags: ['Authentification'],
      summary: 'Rafraîchit les tokens',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            utilisateur: { type: 'object' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donnees = schemaRafraichissement.parse(request.body);
      const resultat = await serviceAuth.rafraichirTokens(donnees.refreshToken);

      return reply.send(resultat);
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * POST /api/v1/auth/deconnexion
   * Déconnecte l'utilisateur (révoque le refresh token)
   */
  fastify.post('/deconnexion', {
    schema: {
      tags: ['Authentification'],
      summary: 'Déconnecte l\'utilisateur',
      body: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { refreshToken?: string };
      if (body.refreshToken) {
        await serviceAuth.deconnecter(body.refreshToken);
      }

      return reply.send({ message: 'Déconnexion réussie' });
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * POST /api/v1/auth/deconnexion-globale
   * Déconnecte toutes les sessions de l'utilisateur
   */
  fastify.post('/deconnexion-globale', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification'],
      summary: 'Déconnecte toutes les sessions',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            sessionsRevoquees: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const sessionsRevoquees = await serviceAuth.deconnecterPartout(request.utilisateur.sub);

      loggerHttp.info(
        { utilisateurId: request.utilisateur.sub, sessionsRevoquees },
        'Déconnexion globale',
      );

      return reply.send({
        message: 'Toutes les sessions ont été révoquées',
        sessionsRevoquees,
      });
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * PUT /api/v1/auth/mot-de-passe
   * Change le mot de passe de l'utilisateur
   */
  fastify.put('/mot-de-passe', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification'],
      summary: 'Change le mot de passe',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['motDePasseActuel', 'nouveauMotDePasse'],
        properties: {
          motDePasseActuel: { type: 'string' },
          nouveauMotDePasse: { type: 'string', minLength: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const donnees = schemaChangementMotDePasse.parse(request.body);

      await serviceAuth.changerMotDePasse(
        request.utilisateur.sub,
        donnees.motDePasseActuel,
        donnees.nouveauMotDePasse,
      );

      loggerHttp.info({ utilisateurId: request.utilisateur.sub }, 'Mot de passe changé');

      return reply.send({ message: 'Mot de passe modifié avec succès' });
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * GET /api/v1/auth/profil
   * Récupère le profil de l'utilisateur connecté
   */
  fastify.get('/profil', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification'],
      summary: 'Récupère le profil utilisateur',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            dateCreation: { type: 'string' },
            preferences: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const { DepotUtilisateursMariaDB } = await import('@/infrastructure/persistence/DepotUtilisateursMariaDB');
      const depotUtilisateurs = new DepotUtilisateursMariaDB();
      const utilisateur = await depotUtilisateurs.trouverParId(request.utilisateur.sub);

      if (!utilisateur) {
        return reply.status(404).send({ erreur: 'Utilisateur introuvable' });
      }

      const { versUtilisateurPublic } = await import('@/domaine/entites/Utilisateur');
      return reply.send(versUtilisateurPublic(utilisateur));
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * PATCH /api/v1/auth/profil
   * Met à jour le profil et les préférences de l'utilisateur
   */
  fastify.patch('/profil', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification'],
      summary: 'Met à jour le profil utilisateur',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          preferences: {
            type: 'object',
            properties: {
              langue: { type: 'string', enum: ['fr', 'en'] },
              theme: { type: 'string', enum: ['clair', 'sombre', 'auto'] },
              frequenceRafraichissement: { type: 'number', minimum: 5, maximum: 120 },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            dateCreation: { type: 'string' },
            preferences: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' });
      }

      const donnees = schemaMiseAJourProfil.parse(request.body);

      const { DepotUtilisateursMariaDB } = await import('@/infrastructure/persistence/DepotUtilisateursMariaDB');
      const depotUtilisateurs = new DepotUtilisateursMariaDB();

      // Récupérer l'utilisateur actuel pour fusionner les préférences
      const utilisateurActuel = await depotUtilisateurs.trouverParId(request.utilisateur.sub);
      if (!utilisateurActuel) {
        return reply.status(404).send({ erreur: 'Utilisateur introuvable' });
      }

      // Fusionner les préférences existantes avec les nouvelles
      const nouvellesPreferences = {
        ...utilisateurActuel.preferences,
        ...donnees.preferences,
      };

      const utilisateurMisAJour = await depotUtilisateurs.mettreAJour(
        request.utilisateur.sub,
        { preferences: nouvellesPreferences },
      );

      if (!utilisateurMisAJour) {
        return reply.status(404).send({ erreur: 'Utilisateur introuvable' });
      }

      loggerHttp.info({ utilisateurId: request.utilisateur.sub }, 'Profil mis à jour');

      const { versUtilisateurPublic } = await import('@/domaine/entites/Utilisateur');
      return reply.send(versUtilisateurPublic(utilisateurMisAJour));
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  // ============================================
  // Routes 2FA TOTP
  // ============================================

  /**
   * POST /api/v1/auth/2fa/activer
   * Génère un secret TOTP et retourne le QR code
   */
  fastify.post('/2fa/activer', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification', '2FA'],
      summary: 'Génère un secret TOTP pour activer la 2FA',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' } as never);
      }

      const { DepotUtilisateursMariaDB } = await import('@/infrastructure/persistence/DepotUtilisateursMariaDB');
      const depotUtilisateurs = new DepotUtilisateursMariaDB();

      const utilisateur = await depotUtilisateurs.trouverParId(request.utilisateur.sub);
      if (!utilisateur) {
        return reply.status(404).send({ erreur: 'Utilisateur introuvable' } as never);
      }

      if (utilisateur.totpActif) {
        throw new ErreurAuthentification('La 2FA est déjà activée', 'TOTP_DEJA_ACTIF');
      }

      // Générer un nouveau secret
      const secret = ServiceTOTP.genererSecret();
      const qrCode = await ServiceTOTP.genererQRCode(utilisateur.email, secret);

      // Stocker le secret temporairement (pas encore actif)
      await depotUtilisateurs.mettreAJour(request.utilisateur.sub, { totpSecret: secret });

      loggerHttp.info({ utilisateurId: request.utilisateur.sub }, 'Secret TOTP généré');

      return reply.send({
        secret,
        qrCode,
        message: 'Scannez le QR code avec votre application d\'authentification, puis confirmez avec un code',
      });
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * POST /api/v1/auth/2fa/confirmer
   * Confirme l'activation de la 2FA avec un code TOTP
   */
  fastify.post('/2fa/confirmer', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification', '2FA'],
      summary: 'Confirme l\'activation de la 2FA avec un code',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' } as never);
      }

      const donnees = schemaVerifierTOTP.parse(request.body);

      const { DepotUtilisateursMariaDB } = await import('@/infrastructure/persistence/DepotUtilisateursMariaDB');
      const depotUtilisateurs = new DepotUtilisateursMariaDB();

      const utilisateur = await depotUtilisateurs.trouverParId(request.utilisateur.sub);
      if (!utilisateur) {
        return reply.status(404).send({ erreur: 'Utilisateur introuvable' } as never);
      }

      if (!utilisateur.totpSecret) {
        return reply.status(400).send({
          erreur: 'TOTP_NON_CONFIGURE',
          message: 'Générez d\'abord un secret TOTP avec POST /2fa/activer',
        } as never);
      }

      if (utilisateur.totpActif) {
        throw new ErreurAuthentification('La 2FA est déjà activée', 'TOTP_DEJA_ACTIF');
      }

      // Vérifier le code
      const valide = ServiceTOTP.verifierCode(utilisateur.totpSecret, donnees.code);
      if (!valide) {
        throw new ErreurAuthentification('Code TOTP invalide', 'TOTP_INVALIDE');
      }

      // Activer la 2FA
      await depotUtilisateurs.mettreAJour(request.utilisateur.sub, { totpActif: true });

      loggerHttp.info({ utilisateurId: request.utilisateur.sub }, '2FA activée');

      return reply.send({ message: 'Authentification à deux facteurs activée avec succès' });
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * POST /api/v1/auth/2fa/desactiver
   * Désactive la 2FA après vérification du code
   */
  fastify.post('/2fa/desactiver', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification', '2FA'],
      summary: 'Désactive la 2FA',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' } as never);
      }

      const donnees = schemaVerifierTOTP.parse(request.body);

      const { DepotUtilisateursMariaDB } = await import('@/infrastructure/persistence/DepotUtilisateursMariaDB');
      const depotUtilisateurs = new DepotUtilisateursMariaDB();

      const utilisateur = await depotUtilisateurs.trouverParId(request.utilisateur.sub);
      if (!utilisateur) {
        return reply.status(404).send({ erreur: 'Utilisateur introuvable' } as never);
      }

      if (!utilisateur.totpActif || !utilisateur.totpSecret) {
        return reply.status(400).send({
          erreur: 'TOTP_NON_ACTIF',
          message: 'La 2FA n\'est pas activée',
        } as never);
      }

      // Vérifier le code
      const valide = ServiceTOTP.verifierCode(utilisateur.totpSecret, donnees.code);
      if (!valide) {
        throw new ErreurAuthentification('Code TOTP invalide', 'TOTP_INVALIDE');
      }

      // Désactiver la 2FA
      await depotUtilisateurs.mettreAJour(request.utilisateur.sub, {
        totpSecret: null,
        totpActif: false,
      });

      loggerHttp.info({ utilisateurId: request.utilisateur.sub }, '2FA désactivée');

      return reply.send({ message: 'Authentification à deux facteurs désactivée' });
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });

  /**
   * GET /api/v1/auth/2fa/statut
   * Retourne le statut de la 2FA pour l'utilisateur
   */
  fastify.get('/2fa/statut', {
    preHandler: verifierAuthentification,
    schema: {
      tags: ['Authentification', '2FA'],
      summary: 'Retourne le statut de la 2FA',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.utilisateur) {
        return reply.status(401).send({ erreur: 'Non authentifié' } as never);
      }

      const { DepotUtilisateursMariaDB } = await import('@/infrastructure/persistence/DepotUtilisateursMariaDB');
      const depotUtilisateurs = new DepotUtilisateursMariaDB();

      const utilisateur = await depotUtilisateurs.trouverParId(request.utilisateur.sub);
      if (!utilisateur) {
        return reply.status(404).send({ erreur: 'Utilisateur introuvable' } as never);
      }

      return reply.send({
        actif: utilisateur.totpActif ?? false,
        configure: !!utilisateur.totpSecret,
      });
    } catch (erreur) {
      return gererErreurAuth(erreur, reply);
    }
  });
}
