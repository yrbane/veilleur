/**
 * Veilleur - Service d'authentification
 * Gestion des JWT et des tokens de rafraîchissement
 */

import * as jose from 'jose';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import type { DepotUtilisateurs, DepotRefreshTokens } from '@/domaine/ports/DepotUtilisateurs';
import type { Utilisateur, UtilisateurPublic } from '@/domaine/entites/Utilisateur';
import { versUtilisateurPublic } from '@/domaine/entites/Utilisateur';
import { env } from '@/config/environnement';

const scryptAsync = promisify(scrypt);

/**
 * Payload du token JWT d'accès
 */
export interface PayloadAccessToken {
  sub: string;
  email: string;
  type: 'access';
}

/**
 * Payload du token JWT de rafraîchissement
 */
export interface PayloadRefreshToken {
  sub: string;
  type: 'refresh';
  jti: string;
}

/**
 * Résultat d'une authentification réussie
 */
export interface ResultatAuthentification {
  utilisateur: UtilisateurPublic;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Erreurs d'authentification
 */
export class ErreurAuthentification extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'EMAIL_EXISTANT'
      | 'IDENTIFIANTS_INVALIDES'
      | 'COMPTE_INACTIF'
      | 'TOKEN_INVALIDE'
      | 'TOKEN_EXPIRE'
      | 'TOKEN_REVOQUE'
      | 'TOTP_REQUIS'
      | 'TOTP_INVALIDE'
      | 'TOTP_DEJA_ACTIF',
  ) {
    super(message);
    this.name = 'ErreurAuthentification';
  }
}

/**
 * Service d'authentification
 */
export class ServiceAuthentification {
  private readonly secretAccess: Uint8Array;
  private readonly secretRefresh: Uint8Array;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly depotUtilisateurs: DepotUtilisateurs,
    private readonly depotRefreshTokens: DepotRefreshTokens,
  ) {
    this.secretAccess = new TextEncoder().encode(env.JWT_SECRET);
    this.secretRefresh = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
    this.accessExpiresIn = env.JWT_ACCESS_EXPIRES_IN;
    this.refreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN;
  }

  /**
   * Inscrit un nouvel utilisateur
   */
  async inscrire(email: string, motDePasse: string): Promise<ResultatAuthentification> {
    // Vérifier si l'email existe déjà
    if (await this.depotUtilisateurs.emailExiste(email)) {
      throw new ErreurAuthentification('Cet email est déjà utilisé', 'EMAIL_EXISTANT');
    }

    // Hasher le mot de passe
    const motDePasseHash = await this.hasherMotDePasse(motDePasse);

    // Créer l'utilisateur
    const utilisateur = await this.depotUtilisateurs.creer({
      email,
      motDePasseHash,
      dateDerniereConnexion: new Date(),
      preferences: {
        langue: 'fr',
        theme: 'auto',
        frequenceRafraichissement: 30,
      },
      estActif: true,
      totpSecret: null,
      totpActif: false,
    });

    // Générer les tokens
    return this.genererTokens(utilisateur);
  }

  /**
   * Connecte un utilisateur existant
   */
  async connecter(email: string, motDePasse: string): Promise<ResultatAuthentification> {
    // Récupérer l'utilisateur
    const utilisateur = await this.depotUtilisateurs.trouverParEmail(email);

    if (!utilisateur) {
      throw new ErreurAuthentification('Email ou mot de passe incorrect', 'IDENTIFIANTS_INVALIDES');
    }

    // Vérifier le compte actif
    if (!utilisateur.estActif) {
      throw new ErreurAuthentification('Ce compte a été désactivé', 'COMPTE_INACTIF');
    }

    // Vérifier le mot de passe
    const motDePasseValide = await this.verifierMotDePasse(motDePasse, utilisateur.motDePasseHash);

    if (!motDePasseValide) {
      throw new ErreurAuthentification('Email ou mot de passe incorrect', 'IDENTIFIANTS_INVALIDES');
    }

    // Mettre à jour la dernière connexion
    await this.depotUtilisateurs.mettreAJourDerniereConnexion(utilisateur.id);

    // Générer les tokens
    return this.genererTokens(utilisateur);
  }

  /**
   * Rafraîchit les tokens avec un refresh token
   */
  async rafraichirTokens(refreshToken: string): Promise<ResultatAuthentification> {
    // Vérifier et décoder le token
    let payload: PayloadRefreshToken;
    try {
      const { payload: decoded } = await jose.jwtVerify(refreshToken, this.secretRefresh, {
        algorithms: ['HS256'],
      });
      payload = decoded as unknown as PayloadRefreshToken;
    } catch (erreur) {
      if (erreur instanceof jose.errors.JWTExpired) {
        throw new ErreurAuthentification('Le token a expiré', 'TOKEN_EXPIRE');
      }
      throw new ErreurAuthentification('Token invalide', 'TOKEN_INVALIDE');
    }

    if (payload.type !== 'refresh') {
      throw new ErreurAuthentification('Token invalide', 'TOKEN_INVALIDE');
    }

    // Vérifier le token dans la base
    const tokenValide = await this.depotRefreshTokens.trouverTokenValide(payload.jti);

    if (!tokenValide) {
      throw new ErreurAuthentification('Token révoqué ou invalide', 'TOKEN_REVOQUE');
    }

    // Révoquer l'ancien token (rotation)
    await this.depotRefreshTokens.revoquer(payload.jti);

    // Récupérer l'utilisateur
    const utilisateur = await this.depotUtilisateurs.trouverParId(payload.sub);

    if (!utilisateur || !utilisateur.estActif) {
      throw new ErreurAuthentification('Utilisateur invalide', 'COMPTE_INACTIF');
    }

    // Générer de nouveaux tokens
    return this.genererTokens(utilisateur);
  }

  /**
   * Déconnecte un utilisateur (révoque le refresh token)
   */
  async deconnecter(refreshToken: string): Promise<void> {
    try {
      const { payload } = await jose.jwtVerify(refreshToken, this.secretRefresh, {
        algorithms: ['HS256'],
      });
      const typedPayload = payload as unknown as PayloadRefreshToken;
      await this.depotRefreshTokens.revoquer(typedPayload.jti);
    } catch {
      // Ignorer les erreurs si le token est déjà invalide
    }
  }

  /**
   * Déconnecte toutes les sessions d'un utilisateur
   */
  async deconnecterPartout(utilisateurId: string): Promise<number> {
    return this.depotRefreshTokens.revoquerTousTokensUtilisateur(utilisateurId);
  }

  /**
   * Vérifie un access token et retourne le payload
   */
  async verifierAccessToken(token: string): Promise<PayloadAccessToken> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secretAccess, {
        algorithms: ['HS256'],
      });
      const typedPayload = payload as unknown as PayloadAccessToken;

      if (typedPayload.type !== 'access') {
        throw new ErreurAuthentification('Token invalide', 'TOKEN_INVALIDE');
      }

      return typedPayload;
    } catch (erreur) {
      if (erreur instanceof jose.errors.JWTExpired) {
        throw new ErreurAuthentification('Le token a expiré', 'TOKEN_EXPIRE');
      }
      if (erreur instanceof ErreurAuthentification) {
        throw erreur;
      }
      throw new ErreurAuthentification('Token invalide', 'TOKEN_INVALIDE');
    }
  }

  /**
   * Change le mot de passe d'un utilisateur
   */
  async changerMotDePasse(
    utilisateurId: string,
    ancienMotDePasse: string,
    nouveauMotDePasse: string,
  ): Promise<void> {
    const utilisateur = await this.depotUtilisateurs.trouverParId(utilisateurId);

    if (!utilisateur) {
      throw new ErreurAuthentification('Utilisateur introuvable', 'IDENTIFIANTS_INVALIDES');
    }

    // Vérifier l'ancien mot de passe
    const motDePasseValide = await this.verifierMotDePasse(
      ancienMotDePasse,
      utilisateur.motDePasseHash,
    );

    if (!motDePasseValide) {
      throw new ErreurAuthentification('Mot de passe actuel incorrect', 'IDENTIFIANTS_INVALIDES');
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const nouveauHash = await this.hasherMotDePasse(nouveauMotDePasse);
    await this.depotUtilisateurs.mettreAJour(utilisateurId, { motDePasseHash: nouveauHash });

    // Révoquer tous les refresh tokens (force la reconnexion partout)
    await this.depotRefreshTokens.revoquerTousTokensUtilisateur(utilisateurId);
  }

  /**
   * Génère les tokens d'authentification
   */
  private async genererTokens(utilisateur: Utilisateur): Promise<ResultatAuthentification> {
    // Générer l'access token
    const accessToken = await new jose.SignJWT({
      sub: utilisateur.id,
      email: utilisateur.email,
      type: 'access',
    } satisfies PayloadAccessToken)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.accessExpiresIn)
      .sign(this.secretAccess);

    // Générer l'identifiant unique du refresh token
    const jti = randomBytes(32).toString('hex');

    // Calculer la date d'expiration
    const dateExpiration = this.calculerExpiration(this.refreshExpiresIn);

    // Générer le refresh token
    const refreshToken = await new jose.SignJWT({
      sub: utilisateur.id,
      type: 'refresh',
      jti,
    } satisfies PayloadRefreshToken)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.refreshExpiresIn)
      .sign(this.secretRefresh);

    // Stocker le refresh token en base
    await this.depotRefreshTokens.creer(utilisateur.id, jti, dateExpiration);

    return {
      utilisateur: versUtilisateurPublic(utilisateur),
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(this.accessExpiresIn),
    };
  }

  /**
   * Hash un mot de passe avec scrypt
   */
  private async hasherMotDePasse(motDePasse: string): Promise<string> {
    const sel = randomBytes(16).toString('hex');
    const hash = (await scryptAsync(motDePasse, sel, 64)) as Buffer;
    return `${sel}:${hash.toString('hex')}`;
  }

  /**
   * Vérifie un mot de passe contre son hash
   */
  private async verifierMotDePasse(motDePasse: string, hash: string): Promise<boolean> {
    const parts = hash.split(':');
    if (parts.length !== 2) {
      return false;
    }
    const [sel, hashStocke] = parts;
    if (!sel || !hashStocke) {
      return false;
    }
    const hashCalcule = (await scryptAsync(motDePasse, sel, 64)) as Buffer;
    const hashStockeBuffer = Buffer.from(hashStocke, 'hex');
    return timingSafeEqual(hashCalcule, hashStockeBuffer);
  }

  /**
   * Calcule une date d'expiration à partir d'une chaîne
   */
  private calculerExpiration(duree: string): Date {
    const secondes = this.parseExpiration(duree);
    return new Date(Date.now() + secondes * 1000);
  }

  /**
   * Parse une durée en secondes
   */
  private parseExpiration(duree: string): number {
    const match = duree.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // 15 minutes par défaut
    }

    const valeur = match[1];
    const unite = match[2];
    if (!valeur) {
      return 900;
    }
    const nombre = parseInt(valeur, 10);

    switch (unite) {
      case 's':
        return nombre;
      case 'm':
        return nombre * 60;
      case 'h':
        return nombre * 3600;
      case 'd':
        return nombre * 86400;
      default:
        return 900;
    }
  }
}
