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

export class EnvoyeurCourrielSmtp implements EnvoyeurCourriel {
  private transport: Transporter | null = null;

  constructor(private readonly config: ConfigSmtp) {}

  estConfigure(): boolean {
    return Boolean(this.config.hote);
  }

  async envoyer(courriel: Courriel): Promise<void> {
    if (!this.config.hote) throw new Error('SMTP non configuré');
    if (!this.transport) {
      this.transport = nodemailer.createTransport({
        host: this.config.hote,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.utilisateur ? { user: this.config.utilisateur, pass: this.config.motDePasse ?? '' } : undefined,
      });
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
