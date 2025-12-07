/**
 * Veilleur - Service d'authentification
 * Gestion des JWT et des tokens de rafraîchissement
 */

import * as jose from 'jose';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, ScryptOptions } from 'crypto';
import type { DepotUtilisateurs, DepotRefreshTokens } from '@/domaine/ports/DepotUtilisateurs';
import type { Utilisateur, UtilisateurPublic } from '@/domaine/entites/Utilisateur';
import { versUtilisateurPublic } from '@/domaine/entites/Utilisateur';
import { env } from '@/config/environnement';
import { ajouterABlacklist, estDansBlacklist } from '@/infrastructure/cache/blacklistJwt';
import {
  verifierVerrouillage,
  enregistrerEchec,
  reinitialiserTentatives,
} from '@/infrastructure/cache/verrouillageCompte';

/**
 * Wrapper promisifié de scrypt avec support des options
 */
function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options?: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options ?? {}, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Paramètres de scrypt pour le hachage sécurisé
 * N=16384 (2^14), r=8, p=1 - recommandé par OWASP
 * keylen=64 octets pour une sécurité post-quantique
 */
const SCRYPT_PARAMS = {
  N: 16384,        // Coût CPU (mémoire = 128 * N * r octets)
  r: 8,            // Taille de bloc
  p: 1,            // Parallélisme
  keylen: 64,      // Longueur de la clé dérivée
  saltlen: 32,     // Longueur du sel (256 bits)
};

/**
 * Règles de validation du mot de passe
 */
const REGLES_MOT_DE_PASSE = {
  longueurMin: 8,
  longueurMax: 128,
  requiertMajuscule: true,
  requiertMinuscule: true,
  requiertChiffre: true,
  requiertSpecial: true,
};

/**
 * Valide la force d'un mot de passe
 */
export function validerForceMotDePasse(motDePasse: string): { valide: boolean; erreurs: string[] } {
  const erreurs: string[] = [];

  if (motDePasse.length < REGLES_MOT_DE_PASSE.longueurMin) {
    erreurs.push(`Le mot de passe doit contenir au moins ${REGLES_MOT_DE_PASSE.longueurMin} caractères`);
  }

  if (motDePasse.length > REGLES_MOT_DE_PASSE.longueurMax) {
    erreurs.push(`Le mot de passe ne doit pas dépasser ${REGLES_MOT_DE_PASSE.longueurMax} caractères`);
  }

  if (REGLES_MOT_DE_PASSE.requiertMajuscule && !/[A-Z]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins une majuscule');
  }

  if (REGLES_MOT_DE_PASSE.requiertMinuscule && !/[a-z]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins une minuscule');
  }

  if (REGLES_MOT_DE_PASSE.requiertChiffre && !/[0-9]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins un chiffre');
  }

  if (REGLES_MOT_DE_PASSE.requiertSpecial && !/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]/.test(motDePasse)) {
    erreurs.push('Le mot de passe doit contenir au moins un caractère spécial');
  }

  return { valide: erreurs.length === 0, erreurs };
}

/**
 * Payload du token JWT d'accès
 */
export interface PayloadAccessToken {
  sub: string;
  email: string;
  type: 'access';
  jti: string;  // Identifiant unique pour la révocation
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
      | 'COMPTE_VERROUILLE'
      | 'TOKEN_INVALIDE'
      | 'TOKEN_EXPIRE'
      | 'TOKEN_REVOQUE'
      | 'TOTP_REQUIS'
      | 'TOTP_INVALIDE'
      | 'TOTP_DEJA_ACTIF'
      | 'MOT_DE_PASSE_FAIBLE',
    public readonly details?: {
      tentativesRestantes?: number;
      tempsRestant?: number;
    },
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
    // Valider la force du mot de passe
    const validation = validerForceMotDePasse(motDePasse);
    if (!validation.valide) {
      throw new ErreurAuthentification(
        validation.erreurs.join('. '),
        'MOT_DE_PASSE_FAIBLE',
      );
    }

    // Vérifier si l'email existe déjà
    if (await this.depotUtilisateurs.emailExiste(email)) {
      throw new ErreurAuthentification('Cet email est déjà utilisé', 'EMAIL_EXISTANT');
    }

    // Hasher le mot de passe avec paramètres sécurisés
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
    // Vérifier si le compte est verrouillé
    const verrouillage = await verifierVerrouillage(email);
    if (verrouillage.estVerrouille) {
      const minutesRestantes = Math.ceil((verrouillage.tempsRestant ?? 0) / 60);
      throw new ErreurAuthentification(
        `Compte temporairement verrouillé. Réessayez dans ${minutesRestantes} minute(s).`,
        'COMPTE_VERROUILLE',
        { tempsRestant: verrouillage.tempsRestant ?? undefined },
      );
    }

    // Récupérer l'utilisateur
    const utilisateur = await this.depotUtilisateurs.trouverParEmail(email);

    if (!utilisateur) {
      // Enregistrer l'échec même si l'email n'existe pas (évite l'énumération)
      const resultat = await enregistrerEchec(email);
      if (resultat.estVerrouille) {
        throw new ErreurAuthentification(
          'Trop de tentatives. Compte temporairement verrouillé.',
          'COMPTE_VERROUILLE',
          { tempsRestant: resultat.tempsRestant ?? undefined },
        );
      }
      throw new ErreurAuthentification(
        'Email ou mot de passe incorrect',
        'IDENTIFIANTS_INVALIDES',
        { tentativesRestantes: resultat.tentativesRestantes },
      );
    }

    // Vérifier le compte actif
    if (!utilisateur.estActif) {
      throw new ErreurAuthentification('Ce compte a été désactivé', 'COMPTE_INACTIF');
    }

    // Vérifier le mot de passe
    const motDePasseValide = await this.verifierMotDePasse(motDePasse, utilisateur.motDePasseHash);

    if (!motDePasseValide) {
      // Enregistrer l'échec
      const resultat = await enregistrerEchec(email);
      if (resultat.estVerrouille) {
        throw new ErreurAuthentification(
          'Trop de tentatives. Compte temporairement verrouillé.',
          'COMPTE_VERROUILLE',
          { tempsRestant: resultat.tempsRestant ?? undefined },
        );
      }
      throw new ErreurAuthentification(
        'Email ou mot de passe incorrect',
        'IDENTIFIANTS_INVALIDES',
        { tentativesRestantes: resultat.tentativesRestantes },
      );
    }

    // Réinitialiser le compteur de tentatives après connexion réussie
    await reinitialiserTentatives(email);

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
   * Déconnecte un utilisateur (révoque le refresh token et l'access token)
   */
  async deconnecter(refreshToken: string, accessToken?: string): Promise<void> {
    try {
      const { payload } = await jose.jwtVerify(refreshToken, this.secretRefresh, {
        algorithms: ['HS256'],
      });
      const typedPayload = payload as unknown as PayloadRefreshToken;
      await this.depotRefreshTokens.revoquer(typedPayload.jti);
    } catch {
      // Ignorer les erreurs si le token est déjà invalide
    }

    // Révoquer l'access token si fourni
    if (accessToken) {
      await this.revoquerAccessToken(accessToken);
    }
  }

  /**
   * Révoque un access token (l'ajoute à la blacklist)
   */
  async revoquerAccessToken(accessToken: string): Promise<void> {
    try {
      const { payload } = await jose.jwtVerify(accessToken, this.secretAccess, {
        algorithms: ['HS256'],
      });
      const typedPayload = payload as unknown as PayloadAccessToken;
      const exp = payload.exp;  // Claim standard JWT

      if (typedPayload.jti && exp) {
        // Calculer le TTL restant
        const ttlRestant = exp - Math.floor(Date.now() / 1000);
        if (ttlRestant > 0) {
          await ajouterABlacklist(typedPayload.jti, ttlRestant);
        }
      }
    } catch {
      // Ignorer si le token est déjà invalide ou expiré
    }
  }

  /**
   * Déconnecte toutes les sessions d'un utilisateur
   * Note: Les access tokens existants restent valides jusqu'à expiration
   * Pour une révocation immédiate, utiliser revoquerAccessToken sur chaque token
   */
  async deconnecterPartout(utilisateurId: string): Promise<number> {
    return this.depotRefreshTokens.revoquerTousTokensUtilisateur(utilisateurId);
  }

  /**
   * Vérifie un access token et retourne le payload
   * Vérifie également que le token n'est pas dans la blacklist
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

      // Vérifier si le token est dans la blacklist (révoqué)
      if (typedPayload.jti && await estDansBlacklist(typedPayload.jti)) {
        throw new ErreurAuthentification('Token révoqué', 'TOKEN_REVOQUE');
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
    // Valider la force du nouveau mot de passe
    const validation = validerForceMotDePasse(nouveauMotDePasse);
    if (!validation.valide) {
      throw new ErreurAuthentification(
        validation.erreurs.join('. '),
        'MOT_DE_PASSE_FAIBLE',
      );
    }

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

    // Hasher et sauvegarder le nouveau mot de passe avec les paramètres sécurisés
    const nouveauHash = await this.hasherMotDePasse(nouveauMotDePasse);
    await this.depotUtilisateurs.mettreAJour(utilisateurId, { motDePasseHash: nouveauHash });

    // Révoquer tous les refresh tokens (force la reconnexion partout)
    await this.depotRefreshTokens.revoquerTousTokensUtilisateur(utilisateurId);
  }

  /**
   * Génère les tokens d'authentification
   */
  private async genererTokens(utilisateur: Utilisateur): Promise<ResultatAuthentification> {
    // Générer un JTI unique pour l'access token (permet la révocation)
    const accessJti = randomBytes(16).toString('hex');

    // Générer l'access token
    const accessToken = await new jose.SignJWT({
      sub: utilisateur.id,
      email: utilisateur.email,
      type: 'access',
      jti: accessJti,
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
   * Hash un mot de passe avec scrypt (paramètres OWASP)
   * Format: version:N:r:p:sel:hash
   */
  private async hasherMotDePasse(motDePasse: string): Promise<string> {
    const sel = randomBytes(SCRYPT_PARAMS.saltlen).toString('hex');
    const hash = await scryptAsync(motDePasse, sel, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    });
    // Format versionné pour permettre les upgrades futurs
    return `v2:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${sel}:${hash.toString('hex')}`;
  }

  /**
   * Vérifie un mot de passe contre son hash
   * Supporte l'ancien format (sel:hash) et le nouveau (v2:N:r:p:sel:hash)
   */
  private async verifierMotDePasse(motDePasse: string, hash: string): Promise<boolean> {
    const parts = hash.split(':');

    // Nouveau format v2: version:N:r:p:sel:hash
    if (parts[0] === 'v2' && parts.length === 6) {
      const [, nStr, rStr, pStr, sel, hashStocke] = parts;
      const N = parseInt(nStr!, 10);
      const r = parseInt(rStr!, 10);
      const p = parseInt(pStr!, 10);

      if (!sel || !hashStocke || isNaN(N) || isNaN(r) || isNaN(p)) {
        return false;
      }

      const hashCalcule = await scryptAsync(motDePasse, sel, SCRYPT_PARAMS.keylen, {
        N,
        r,
        p,
      });
      const hashStockeBuffer = Buffer.from(hashStocke, 'hex');

      if (hashCalcule.length !== hashStockeBuffer.length) {
        return false;
      }

      return timingSafeEqual(hashCalcule, hashStockeBuffer);
    }

    // Ancien format: sel:hash (rétrocompatibilité)
    if (parts.length === 2) {
      const [sel, hashStocke] = parts;
      if (!sel || !hashStocke) {
        return false;
      }
      const hashCalcule = await scryptAsync(motDePasse, sel, 64);
      const hashStockeBuffer = Buffer.from(hashStocke, 'hex');

      if (hashCalcule.length !== hashStockeBuffer.length) {
        return false;
      }

      return timingSafeEqual(hashCalcule, hashStockeBuffer);
    }

    return false;
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
