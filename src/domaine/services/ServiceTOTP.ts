/**
 * Veilleur - Service TOTP (Time-based One-Time Password)
 * Gère l'authentification à deux facteurs
 */

import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

const APP_NAME = 'Veilleur';

/**
 * Génère un secret TOTP aléatoire
 */
export function genererSecret(): string {
  // Génère un secret de 20 bytes encodé en base32
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/**
 * Crée un objet TOTP pour un utilisateur
 */
function creerTOTP(email: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/**
 * Génère l'URI otpauth pour configurer l'app d'authentification
 */
export function genererURI(email: string, secret: string): string {
  const totp = creerTOTP(email, secret);
  return totp.toString();
}

/**
 * Génère un QR code en base64 pour l'URI TOTP
 */
export async function genererQRCode(email: string, secret: string): Promise<string> {
  const uri = genererURI(email, secret);
  return QRCode.toDataURL(uri);
}

/**
 * Vérifie un code TOTP
 * @param secret Le secret base32
 * @param code Le code à 6 chiffres fourni par l'utilisateur
 * @param fenetre Nombre de périodes de tolérance (défaut: 1)
 * @returns true si le code est valide
 */
export function verifierCode(secret: string, code: string, fenetre = 1): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Vérifie le code avec une fenêtre de tolérance
  const delta = totp.validate({ token: code, window: fenetre });

  // delta est null si invalide, ou le décalage temporel si valide
  return delta !== null;
}

/**
 * Génère un code TOTP (pour les tests)
 */
export function genererCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.generate();
}
