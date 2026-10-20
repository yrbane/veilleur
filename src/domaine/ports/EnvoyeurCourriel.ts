/**
 * Veilleur - Port : envoi d'un courriel
 */

export interface Courriel {
  a: string;
  sujet: string;
  html: string;
  texte: string;
}

export interface EnvoyeurCourriel {
  estConfigure(): boolean;
  envoyer(courriel: Courriel): Promise<void>;
}
