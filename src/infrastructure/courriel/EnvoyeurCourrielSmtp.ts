/**
 * Veilleur - Envoi de courriels par SMTP (nodemailer)
 */

import nodemailer, { type Transporter } from 'nodemailer';
import type { Courriel, EnvoyeurCourriel } from '@/domaine/ports/EnvoyeurCourriel';

export interface ConfigSmtp {
  hote?: string;
  port: number;
  secure: boolean;
  utilisateur?: string;
  motDePasse?: string;
  expediteur: string;
}

const HOTES_LOCAUX = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Options nodemailer : un relais en boucle locale (Postfix) présente souvent un certificat
 * auto-signé en STARTTLS ; on lui parle en clair, le trafic ne quitte pas la machine.
 */
export function creerOptionsTransport(config: ConfigSmtp): {
  host: string;
  port: number;
  secure: boolean;
  ignoreTLS: boolean;
  auth?: { user: string; pass: string };
} {
  const hote = config.hote ?? '';
  return {
    host: hote,
    port: config.port,
    secure: config.secure,
    ignoreTLS: !config.secure && HOTES_LOCAUX.has(hote),
    ...(config.utilisateur ? { auth: { user: config.utilisateur, pass: config.motDePasse ?? '' } } : {}),
  };
}

export class EnvoyeurCourrielSmtp implements EnvoyeurCourriel {
  private transport: Transporter | null = null;

  constructor(private readonly config: ConfigSmtp) {}

  estConfigure(): boolean {
    return Boolean(this.config.hote);
  }

  async envoyer(courriel: Courriel): Promise<void> {
    if (!this.config.hote) throw new Error('SMTP non configuré');
    if (!this.transport) {
      this.transport = nodemailer.createTransport(creerOptionsTransport(this.config));
    }
    await this.transport.sendMail({
      from: this.config.expediteur,
      to: courriel.a,
      subject: courriel.sujet,
      text: courriel.texte,
      html: courriel.html,
    });
  }
}
